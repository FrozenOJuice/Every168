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
export type ClientOptions = {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  headers?: HeadersInit;
};
export function createHttp(options: ClientOptions = {}) {
  return async function request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const headers = new Headers(options.headers);
    if (init.body) headers.set("Content-Type", "application/json");
    new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    let response: Response;
    try {
      response = await (options.fetch ?? globalThis.fetch)(
        (options.baseUrl ?? "") + path,
        { credentials: "include", cache: "no-store", ...init, headers },
      );
    } catch {
      throw new ApiError(
        0,
        "NETWORK_ERROR",
        "Unable to connect. Your input has been kept; please try again.",
      );
    }
    const data: unknown = await response.json().catch(() => null);
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
