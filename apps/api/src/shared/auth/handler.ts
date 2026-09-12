import type { RequestHandler } from "express";
import { getRequest, setResponse } from "better-call/node";
import { z } from "zod";
import type { Auth } from "./auth.js";
import { AppError } from "../errors/app-error.js";
const authError = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
});
export function authHandler(auth: Auth, base: string): RequestHandler {
  return async (req, res) => {
    let request: Request;
    try {
      request = getRequest({ base, request: req, bodySizeLimit: 256 * 1024 });
    } catch {
      throw new AppError(
        413,
        "PAYLOAD_TOO_LARGE",
        "Request must be smaller than 256 KB.",
      );
    }
    const response = await auth.handler(request);
    if (!response.ok) {
      if (response.status >= 500)
        throw new AppError(
          500,
          "INTERNAL",
          "Authentication is temporarily unavailable.",
        );
      const parsed = authError.safeParse(await response.json());
      throw new AppError(
        response.status,
        parsed.success ? (parsed.data.code ?? "AUTH_ERROR") : "AUTH_ERROR",
        parsed.success
          ? (parsed.data.message ?? "Authentication failed.")
          : "Authentication failed.",
      );
    }
    await setResponse(res, response);
  };
}
