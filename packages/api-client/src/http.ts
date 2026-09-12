import { errorSchema } from "@168hours/contracts";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export function uncertainWrite(error: unknown) {
  return (
    error instanceof ApiError && (error.status === 0 || error.status >= 500)
  );
}
export function writeHeaders(
  key: string = crypto.randomUUID(),
  version?: number,
) {
  return {
    "Idempotency-Key": key,
    ...(version === undefined ? {} : { "If-Match": `"${version}"` }),
  };
}
export type ClientOptions = {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  headers?: HeadersInit;
};
export function createHttp(options: ClientOptions = {}) {
  // Keep the exact payload for an unresolved intent, including generated timestamps.
  // Deliberate new writes use a new key, even when their values are identical.
  const attempts = new Map<string, { path: string; init: RequestInit }>();
  return async function request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const headers = new Headers(options.headers);
    if (init.body) headers.set("Content-Type", "application/json");
    new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    const key = headers.get("Idempotency-Key")?.toLowerCase() ?? null;
    if (key) headers.set("Idempotency-Key", key);
    let attempt: { path: string; init: RequestInit } = {
      path,
      init: { ...init, headers },
    };
    if (key) {
      const previous = attempts.get(key);
      if (previous && previous.path !== path)
        throw new ApiError(
          400,
          "INVALID_REQUEST_KEY",
          "A pending change must be resolved before reusing its request key.",
        );
      attempt = previous ?? attempt;
      attempts.set(key, attempt);
    }
    let response: Response;
    try {
      response = await (options.fetch ?? globalThis.fetch)(
        (options.baseUrl ?? "") + attempt.path,
        { credentials: "include", cache: "no-store", ...attempt.init },
      );
    } catch {
      throw new ApiError(
        0,
        "NETWORK_ERROR",
        "Unable to connect. Your input has been kept; please try again.",
      );
    }
    const data: unknown = await response.json().catch(() => null);
    if (response.ok && data === null)
      throw new ApiError(
        0,
        "INCOMPLETE_RESPONSE",
        "The response was interrupted. Retry to confirm this same change.",
      );
    if (key && response.status < 500) attempts.delete(key);
    if (!response.ok) {
      const parsed = errorSchema.safeParse(data);
      const authError = data as { message?: string } | null;
      throw new ApiError(
        response.status,
        parsed.success ? parsed.data.error.code : "REQUEST_FAILED",
        parsed.success
          ? parsed.data.error.message
          : (authError?.message ?? "Request failed. Please try again."),
        parsed.success ? parsed.data.error.details : undefined,
      );
    }
    return data as T;
  };
}
export type Http = ReturnType<typeof createHttp>;
export const body = (value: unknown) => JSON.stringify(value);
export function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(values))
    if (v !== undefined) params.set(k, String(v));
  return params.size ? "?" + params.toString() : "";
}
