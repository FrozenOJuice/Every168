import { sql, type SQLWrapper } from "drizzle-orm";
import { z } from "zod";
import type { Page, PageQuery } from "@168hours/contracts";
import { AppError } from "../errors/app-error.js";
const cursorSchema = z.object({ createdAt: z.iso.datetime(), id: z.uuid() });
export function cursorCondition(
  query: PageQuery,
  createdAt: SQLWrapper,
  id: SQLWrapper,
) {
  if (!query.cursor) return undefined;
  try {
    const cursor = cursorSchema.parse(
      JSON.parse(Buffer.from(query.cursor, "base64url").toString()),
    );
    return sql`(${createdAt},${id}) < (${new Date(cursor.createdAt)},${cursor.id}::uuid)`;
  } catch {
    throw new AppError(422, "VALIDATION_ERROR", "Invalid history cursor.");
  }
}
export function pageResult<T extends { id: string; createdAt: Date }>(
  rows: T[],
  limit: number,
): Page<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > limit && last
        ? Buffer.from(
            JSON.stringify({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            }),
          ).toString("base64url")
        : null,
  };
}
