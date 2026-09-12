import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import type { Logger } from "pino";
export function requestLog(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const requestId = randomUUID();
    res.locals.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    const started = performance.now();
    let recorded = false;
    const record = () => {
      if (recorded) return;
      recorded = true;
      const aborted = !res.writableFinished;
      const level = aborted || res.statusCode >= 400 ? "warn" : "info";
      logger[level](
        {
          requestId,
          method: req.method,
          // Matched route templates avoid logging arbitrary private URL segments.
          route: req.route ? req.baseUrl + req.route.path : "unmatched",
          statusCode: aborted ? 499 : res.statusCode,
          aborted,
          durationMs: Math.round(performance.now() - started),
        },
        aborted ? "Request aborted" : "Request completed",
      );
    };
    res.once("finish", record);
    res.once("close", record);
    next();
  };
}
