import type { ErrorRequestHandler } from "express";
import type { Logger } from "pino";
import { ZodError } from "zod";
import { AppError } from "./app-error.js";
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    let problem: AppError;
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
          errorType: error instanceof Error ? error.name : "unknown",
        },
        "Request failed",
      );
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
