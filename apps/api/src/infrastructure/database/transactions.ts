import type {
  RunInTransaction,
  TransactionContext,
} from "../../shared/transactions.js";
import type { Database, Transaction } from "./client.js";

const active = new WeakMap<
  TransactionContext,
  { db: Database; tx: Transaction }
>();
export function transactionRunner(db: Database): RunInTransaction {
  return (work, existing) => {
    if (existing) {
      databaseFor(db, existing);
      return work(existing);
    }
    return db.transaction(async (tx) => {
      const context = Object.freeze({}) as TransactionContext;
      active.set(context, { db, tx });
      try {
        return await work(context);
      } finally {
        active.delete(context);
      }
    });
  };
}
/** Only persistence code may resolve a scope to the underlying transaction. */
export function databaseFor(db: Database, context?: TransactionContext) {
  if (!context) return db;
  const value = active.get(context);
  if (!value || value.db !== db)
    throw new Error("Invalid or expired transaction scope");
  return value.tx;
}
