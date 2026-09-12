declare const transactionBrand: unique symbol;
/** An opaque scope: services may pass it, but cannot execute database queries. */
export interface TransactionContext {
  readonly [transactionBrand]: true;
}
export type RunInTransaction = <T>(
  work: (context: TransactionContext) => Promise<T>,
  existing?: TransactionContext,
) => Promise<T>;
