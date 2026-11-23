import type { ApiError } from "./types";

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: ApiError };

type Query = Record<string, string | number | boolean | null | undefined>;

/** Call the shop API. Never throws: network failures and error statuses come back as errors. */
export async function call<T>(
  baseUrl: string,
  method: string,
  path: string,
  options: { query?: Query; body?: unknown } = {},
): Promise<ApiResult<T>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== null && value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  try {
    const response = await fetch(`${baseUrl}${path}${qs ? `?${qs}` : ""}`, {
      method,
      headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (response.ok) return { ok: true, value: payload as T };
    const error = (payload as { error?: ApiError } | null)?.error;
    return { ok: false, error: error ?? { kind: "TransportError", status: response.status } };
  } catch (e) {
    return { ok: false, error: { kind: "TransportError", message: String(e) } };
  }
}
