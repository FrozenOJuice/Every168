import { AppError, found } from "./app-error.js";

export function assertRevision<T extends { version: number }>(
  row: T | undefined,
  expectedVersion: number,
): T {
  const value = found(row);
  if (value.version !== expectedVersion) throw staleRevision();
  return value;
}

export function staleRevision() {
  return new AppError(
    409,
    "STALE_REVISION",
    "This record changed since you opened it. Reload the latest version before editing again.",
  );
}

/** A failed compare-and-swap must still hide records belonging to other users. */
export async function changed<T>(
  row: T | undefined,
  getOwned: () => Promise<unknown | undefined>,
): Promise<T> {
  if (row !== undefined) return row;
  found(await getOwned());
  throw staleRevision();
}
