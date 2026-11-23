import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

/** The shop API, typed from the backend's OpenAPI schema (node generate-client.mjs). */
export function api(baseUrl: string) {
  return createClient<paths>({ baseUrl });
}

export type Schemas = components["schemas"];

/** Every error the API sends: {"error": {"kind": ...}}. */
export type ApiError = { kind: string } & Record<string, unknown>;

/** The error in a failed response's body, or a transport error. */
export function errorOf(body: unknown, status?: number): ApiError {
  const error = (body as { error?: ApiError } | null | undefined)?.error;
  return error ?? { kind: "TransportError", status };
}

/** Run a request; never throws. */
export async function attempt<T>(
  request: () => Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<{ ok: true; value: T } | { ok: false; error: ApiError }> {
  try {
    const { data, error, response } = await request();
    if (response.ok) return { ok: true, value: data as T };
    return { ok: false, error: errorOf(error, response.status) };
  } catch (e) {
    return { ok: false, error: { kind: "TransportError", message: String(e) } };
  }
}
