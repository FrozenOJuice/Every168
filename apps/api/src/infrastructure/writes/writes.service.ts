import { createHash } from "node:crypto";
import type { writesRepository } from "./writes.repository.js";
import type {
  RunInTransaction,
  TransactionContext,
} from "../../shared/transactions.js";
import { AppError } from "../../shared/errors/app-error.js";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export function writesService(
  run: RunInTransaction,
  repo: ReturnType<typeof writesRepository>,
) {
  return {
    execute(
      userId: string,
      key: string,
      request: unknown,
      work: (context: TransactionContext) => Promise<unknown>,
    ) {
      const fingerprint = createHash("sha256")
        .update(canonical(request))
        .digest("hex");
      return run(async (context) => {
        await repo.lock(userId, key, context);
        const previous = await repo.get(userId, key, context);
        if (previous) {
          if (previous.fingerprint !== fingerprint)
            throw new AppError(
              409,
              "IDEMPOTENCY_CONFLICT",
              "This request key was already used for a different change.",
            );
          return previous.response;
        }
        // The effect and its JSON response commit together, including multi-domain writes.
        const response: unknown = JSON.parse(
          JSON.stringify(await work(context)),
        );
        await repo.save(userId, key, fingerprint, response, context);
        return response;
      });
    },
  };
}
export type WritesService = ReturnType<typeof writesService>;
