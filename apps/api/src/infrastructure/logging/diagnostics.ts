// Never serialize raw Error messages: Drizzle and drivers may embed SQL/values.
export function errorDiagnostics(
  error: unknown,
  depth = 0,
): Record<string, unknown> {
  if (!(error instanceof Error)) return { type: "UnknownError" };
  const code =
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z0-9_]{2,40}$/.test(error.code)
      ? error.code
      : undefined;
  return {
    type: /^[A-Za-z0-9_]{1,60}$/.test(error.name) ? error.name : "Error",
    code,
    // Keep source locations only; omit the message and function names.
    locations: error.stack
      ?.split("\n")
      .flatMap((line) => {
        const location =
          /^\s+at /.test(line) &&
          line.match(/(?:\/|file:\/\/\/)([^\s()]+:\d+:\d+)\)?$/);
        return location ? [location[1]] : [];
      })
      .slice(0, 8),
    cause:
      depth < 2 && error.cause
        ? errorDiagnostics(error.cause, depth + 1)
        : undefined,
  };
}

export function databaseFailureCode(
  error: unknown,
  depth = 0,
): string | undefined {
  if (!(error instanceof Error) || depth > 3) return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  if (
    [
      "timeout exceeded when trying to connect",
      "Connection terminated due to connection timeout",
      "Query read timeout",
      "Connection terminated unexpectedly",
      "Client has encountered a connection error and is not queryable",
    ].includes(error.message)
  )
    return "DATABASE_TIMEOUT";
  return databaseFailureCode(error.cause, depth + 1);
}
