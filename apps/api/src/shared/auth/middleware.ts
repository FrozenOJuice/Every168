import type { RequestHandler, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { AppError } from "../errors/app-error.js";
import type { Auth } from "./auth.js";
export function requireSession(auth: Auth): RequestHandler {
  return async (req, res, next) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session)
      throw new AppError(401, "UNAUTHORIZED", "Please sign in to continue.");
    res.locals.user = session.user;
    res.setHeader("Cache-Control", "no-store");
    next();
  };
}
export function currentUser(res: Response): {
  id: string;
  name: string;
  email: string;
} {
  return res.locals.user;
}
export function requireOrigin(origin: string): RequestHandler {
  return (req, _res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin !== origin
    )
      throw new AppError(403, "FORBIDDEN", "Request origin is not allowed.");
    next();
  };
}
