import type { RequestHandler } from "express";
import { z } from "zod";
import { idSchema } from "@168hours/contracts";
import type { WritesService } from "../../infrastructure/writes/writes.service.js";
import type { TransactionContext } from "../transactions.js";
import { currentUser } from "../auth/middleware.js";
import { AppError } from "../errors/app-error.js";

export const emptyInput = z.object({}).strict();
export function mutation<T>(
  writes: WritesService,
  schema: z.ZodType<T>,
  action: (command: {
    userId: string;
    id: string;
    input: T;
    version: number;
    context: TransactionContext;
  }) => Promise<unknown>,
  options: { versioned?: boolean; status?: number } = {},
): RequestHandler {
  return async (req, res) => {
    const userId = currentUser(res).id;
    const input = schema.parse(req.body ?? {});
    const id = req.params.id === undefined ? "" : idSchema.parse(req.params.id);
    const key = idSchema.safeParse(req.get("Idempotency-Key"));
    if (!key.success)
      throw new AppError(
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "Supply a UUID Idempotency-Key for this change.",
      );
    const match = req.get("If-Match");
    if (
      options.versioned &&
      (!match ||
        !/^"[1-9][0-9]*"$/.test(match) ||
        !Number.isSafeInteger(Number(match.slice(1, -1))) ||
        Number(match.slice(1, -1)) > 2147483647)
    )
      throw new AppError(
        428,
        "REVISION_REQUIRED",
        "Supply the record's version in If-Match before changing it.",
      );
    const version = options.versioned ? Number(match!.slice(1, -1)) : 0;
    const response = await writes.execute(
      userId,
      key.data.toLowerCase(),
      { method: req.method, path: req.baseUrl + req.path, input, version },
      (context) => action({ userId, id, input, version, context }),
    );
    res.status(options.status ?? 200).json(response);
  };
}
