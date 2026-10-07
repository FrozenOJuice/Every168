import type { Request, RequestHandler, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { AppError } from "../errors/app-error.js";
import type { IdentityService } from "../../modules/identity/identity.service.js";
import type { Auth } from "./auth.js";
export function requireSession(
  auth: Auth,
  identity: IdentityService,
): RequestHandler {
  return async (req, res, next) => {
    const { response: session, headers } = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
      query: {
        disableCookieCache: true,
        // Server Components cannot forward Set-Cookie to the browser. Skipping
        // renewal is safe for any caller; it never extends session validity.
        disableRefresh: req.headers["x-168hours-session-refresh"] === "skip",
      },
      returnHeaders: true,
    });
    for (const cookie of headers.getSetCookie())
      res.append("Set-Cookie", cookie);
    if (!session)
      throw new AppError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const access = await identity.getAccess(session.user.id);
    if (!access || access.suspendedAt)
      throw new AppError(401, "UNAUTHORIZED", "Please sign in to continue.");
    await identity.touchActivity(session.user.id);
    res.locals.user = { ...session.user, accountType: access.accountType };
    res.setHeader("Cache-Control", "no-store");
    next();
  };
}
export function currentUser(res: Response): {
  id: string;
  name: string;
  email: string;
  accountType: "user" | "admin";
} {
  return res.locals.user;
}
export function requireOrigin(origin: string): RequestHandler {
  return (req, _res, next) => {
    checkOrigin(req, origin);
    next();
  };
}
export function checkOrigin(req: Request, origin: string) {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    (req.headers.origin !== origin ||
      req.headers["sec-fetch-site"] === "cross-site")
  )
    throw new AppError(403, "FORBIDDEN", "Request origin is not allowed.");
}
