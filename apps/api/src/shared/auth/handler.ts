import type { AccountSecurityService } from "../../modules/identity/account-security.service.js";
import { hashPassword } from "./password.js";
import type { RequestHandler } from "express";
import { setResponse } from "better-call/node";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import type { Auth } from "./auth.js";
import { AppError } from "../errors/app-error.js";
import { clientAddress } from "../http/client-address.js";
import {
  authInput,
  authSessionSchema,
  authUserSchema,
  signInInput,
  accountEmailInput,
  accountTokenInput,
  resetPasswordInput,
  changePasswordInput,
} from "@168hours/contracts";
import type { IdentityService } from "../../modules/identity/identity.service.js";
import { checkOrigin } from "./middleware.js";
const authError = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
});
const endpoints = new Map([
  ["/api/auth/sign-up/email", "POST"],
  ["/api/auth/sign-in/email", "POST"],
  ["/api/auth/sign-out", "POST"],
  ["/api/auth/get-session", "GET"],
  ...[
    "request-password-reset",
    "reset-password",
    "send-verification-email",
    "verify-email",
    "change-password",
  ].map((path) => [`/api/auth/${path}`, "POST"] as const),
]);
export function authHandler(
  auth: Auth,
  base: string,
  origin: string,
  identity: IdentityService,
  security: AccountSecurityService,
): RequestHandler {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const verificationRequired =
      auth.options.emailAndPassword?.requireEmailVerification !== false;
    const signupResult = { status: true, verificationRequired };
    if (endpoints.get(req.path) !== req.method)
      throw new AppError(404, "NOT_FOUND", "Route not found.");
    // Express has already bounded the raw body, including chunked transfers.
    const raw = Buffer.isBuffer(req.body)
      ? new Uint8Array(req.body)
      : undefined;
    let body: unknown = {};
    if (req.is("application/json") && raw?.length) {
      try {
        body = JSON.parse(Buffer.from(raw).toString("utf8"));
      } catch {
        throw new AppError(
          400,
          "INVALID_JSON",
          "Request body must contain valid JSON.",
        );
      }
    }
    checkOrigin(req, origin);
    if (req.method === "POST" && !req.is("application/json"))
      throw new AppError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Use application/json.",
      );
    z.object({}).strict().parse(req.query);
    if (
      [
        "/api/auth/request-password-reset",
        "/api/auth/send-verification-email",
      ].includes(req.path)
    ) {
      const input = accountEmailInput.parse(body);
      await security.request(
        input.email,
        req.path.endsWith("request-password-reset") ? "reset" : "verify",
      );
      res.json({ status: true });
      return;
    }
    if (req.path === "/api/auth/verify-email") {
      await security.verify(accountTokenInput.parse(body).token);
      res.json({ status: true });
      return;
    }
    if (req.path === "/api/auth/reset-password") {
      const input = resetPasswordInput.parse(body);
      await security.reset(input.token, input.newPassword);
      res.json({ status: true });
      return;
    }
    if (req.path === "/api/auth/change-password") {
      const input = changePasswordInput.parse(body);
      const active = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
        query: { disableRefresh: true, disableCookieCache: true },
      });
      if (!active || (verificationRequired && !active.user.emailVerified))
        throw new AppError(401, "UNAUTHORIZED", "Please sign in to continue.");
      await security.change(
        active.user.id,
        input.currentPassword,
        input.newPassword,
      );
      res.json({ status: true });
      return;
    }
    if (req.path === "/api/auth/sign-up/email") body = authInput.parse(body);
    else if (req.path === "/api/auth/sign-in/email")
      body = signInInput.parse(body);
    else z.object({}).strict().parse(body);
    if (
      req.path === "/api/auth/sign-in/email" &&
      (await identity.isSuspendedEmail(signInInput.parse(body).email))
    ) {
      // Match the library's unknown-user work and error without issuing a session.
      await hashPassword(signInInput.parse(body).password);
      throw new AppError(
        401,
        "INVALID_EMAIL_OR_PASSWORD",
        "Invalid email or password",
      );
    }
    const headers = fromNodeHeaders(req.headers);
    headers.delete("content-length");
    if (req.path === "/api/auth/sign-out") {
      // Better Auth's logout clears cookies even if its database delete fails.
      // Revoke through our service first so a 200 always means revocation worked.
      const active = await auth.api.getSession({
        headers,
        query: { disableRefresh: true, disableCookieCache: true },
      });
      if (active)
        await identity.revokeSession(active.user.id, active.session.token);
    }
    const request = new Request(new URL(req.path, base), {
      method: req.method,
      headers,
      body: req.method === "GET" ? undefined : JSON.stringify(body),
    });
    // Never let a caller choose Better Auth's rate-limit/session IP address.
    request.headers.set("x-168hours-client-ip", clientAddress(req));
    const response = await auth.handler(request);
    if (!response.ok) {
      const retry =
        response.headers.get("Retry-After") ??
        response.headers.get("X-Retry-After");
      if (retry && /^\d+$/.test(retry)) res.setHeader("Retry-After", retry);
      if (response.status >= 500)
        throw new AppError(
          503,
          "TEMPORARILY_UNAVAILABLE",
          "Authentication is temporarily unavailable.",
        );
      const parsed = authError.safeParse(
        await response.json().catch(() => null),
      );
      if (
        req.path === "/api/auth/sign-up/email" &&
        parsed.success &&
        [
          "USER_ALREADY_EXISTS",
          "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
        ].includes(parsed.data.code ?? "")
      ) {
        if (verificationRequired)
          await security.request(authInput.parse(body).email, "verify");
        res.json(signupResult);
        return;
      }
      if (response.status === 404)
        throw new AppError(404, "NOT_FOUND", "Route not found.");
      if (response.status === 429)
        throw new AppError(
          429,
          "RATE_LIMITED",
          "Too many requests. Please try again later.",
        );
      throw new AppError(
        response.status,
        parsed.success ? (parsed.data.code ?? "AUTH_ERROR") : "AUTH_ERROR",
        parsed.success
          ? (parsed.data.message ?? "Authentication failed.")
          : "Authentication failed.",
      );
    }
    const data: unknown = await response.json();
    if (req.path === "/api/auth/sign-up/email") {
      // Better Auth may return a synthetic user for duplicate signup. Never expose or authorize that placeholder.
      if (verificationRequired)
        await security.request(authInput.parse(body).email, "verify");
      res.json(signupResult);
      return;
    }
    let output: unknown;
    if (req.path === "/api/auth/get-session")
      output = authSessionSchema.parse(data);
    else if (req.path === "/api/auth/sign-out")
      output = z.object({ success: z.literal(true) }).parse(data);
    else output = z.object({ user: authUserSchema }).parse(data);
    if (req.path !== "/api/auth/sign-out") {
      const result = z
        .object({ user: authUserSchema })
        .nullable()
        .parse(output);
      if (result) {
        const access = await identity.getAccess(result.user.id);
        if (!access || access.suspendedAt) {
          if (req.path === "/api/auth/get-session") output = null;
          else
            throw new AppError(
              401,
              "INVALID_EMAIL_OR_PASSWORD",
              "Invalid email or password",
            );
        } else if (req.path !== "/api/auth/get-session")
          await identity.touchActivity(result.user.id);
      }
    }
    // Keep the signed HttpOnly cookie; never expose raw database session tokens.
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("content-length");
    responseHeaders.set("Cache-Control", "no-store");
    await setResponse(
      res,
      new Response(JSON.stringify(output), {
        status: response.status,
        headers: responseHeaders,
      }),
    );
  };
}
