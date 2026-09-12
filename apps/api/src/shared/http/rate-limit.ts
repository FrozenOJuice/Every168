import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { AppError } from "../errors/app-error.js";
import { clientAddress } from "./client-address.js";
export function apiRateLimit(limit: number) {
  return rateLimit({
    windowMs: 60000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(clientAddress(req)),
    handler: (_req, _res, next) =>
      next(
        new AppError(
          429,
          "RATE_LIMITED",
          "Too many requests. Please try again later.",
        ),
      ),
  });
}
