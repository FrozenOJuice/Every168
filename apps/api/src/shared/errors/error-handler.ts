import type { ErrorRequestHandler } from "express";
import type { Logger } from "pino";
import { ZodError } from "zod";
import { AppError } from "./app-error.js";
import {
  errorDiagnostics,
  databaseFailureCode,
} from "../../infrastructure/logging/diagnostics.js";
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    let problem: AppError;
    const databaseCode = databaseFailureCode(error);
    if (error instanceof AppError) problem = error;
    else if (error instanceof ZodError)
      problem = new AppError(
        422,
        "VALIDATION_ERROR",
        "Please check the highlighted fields.",
        error.flatten(),
      );
    else if (
      error instanceof Error &&
      "type" in error &&
      ["encoding.unsupported", "charset.unsupported"].includes(
        String(error.type),
      )
    )
      problem = new AppError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Request encoding is not supported.",
      );
    else if (
      error instanceof Error &&
      "type" in error &&
      error.type === "entity.too.large"
    )
      problem = new AppError(
        413,
        "PAYLOAD_TOO_LARGE",
        "Request must be smaller than 256 KB.",
      );
    else if (
      error instanceof SyntaxError &&
      "status" in error &&
      error.status === 400
    )
      problem = new AppError(
        400,
        "INVALID_JSON",
        "Request body must contain valid JSON.",
      );
    else if (
      databaseCode &&
      [
        "ECONNREFUSED",
        "ECONNRESET",
        "ETIMEDOUT",
        "EPIPE",
        "57P01",
        "57P02",
        "57P03",
        "25P03",
        "53300",
        "57014",
        "55P03",
        "DATABASE_TIMEOUT",
      ].includes(databaseCode)
    )
      problem = new AppError(
        503,
        "TEMPORARILY_UNAVAILABLE",
        "The service is temporarily unavailable. Please try again shortly.",
      );
    else if (
      databaseCode &&
      ["23503", "23505", "23514", "40001", "40P01"].includes(databaseCode)
    )
      problem = new AppError(
        409,
        "CONFLICT",
        "A related record changed. Please refresh and try again.",
      );
    else
      problem = new AppError(
        500,
        "INTERNAL",
        "Something went wrong. Please try again.",
      );
    if (problem.status >= 500)
      logger.error(
        {
          requestId: res.locals.requestId,
          code: problem.code,
          diagnostic: errorDiagnostics(error),
        },
        "Request failed",
      );
    res.setHeader("Cache-Control", "no-store");
    res.status(problem.status).json({
      error: {
        code: problem.code,
        message: problem.message,
        details: problem.details,
        requestId: res.locals.requestId,
      },
    });
  };
}
