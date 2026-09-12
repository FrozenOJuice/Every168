export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export function found<T>(value: T | undefined): T {
  if (value === undefined)
    throw new AppError(404, "NOT_FOUND", "Record not found.");
  return value;
}
