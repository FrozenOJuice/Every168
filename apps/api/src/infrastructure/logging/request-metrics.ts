/** Operational counters only; no request paths, account IDs or personal payloads. */
export function requestMetrics() {
  const since = new Date().toISOString();
  let total = 0,
    serverErrors = 0,
    aborted = 0;
  return {
    record(status: number, wasAborted: boolean) {
      total++;
      if (status >= 500) serverErrors++;
      if (wasAborted) aborted++;
    },
    snapshot: () => ({ total, serverErrors, aborted, since }),
  };
}
export type RequestMetrics = ReturnType<typeof requestMetrics>;
