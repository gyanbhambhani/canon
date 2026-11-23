import type { Outcome } from "../features/result";

/** A request the client refuses to send: the same shape as the server's 422. */
export function invalid(rule: string): Outcome<never> {
  return { ok: false, error: { kind: "ValidationError", rule } };
}

/** Call an endpoint with a JSON body; never throws. 2xx is a value, anything else an error with a kind. */
export async function call<T>(baseUrl: string, method: string, path: string, body?: unknown): Promise<Outcome<T>> {
  try {
    const response = await fetch(baseUrl + path, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload: unknown = await response.json();
    if (response.ok) return { ok: true, value: payload as T };
    const error = (payload as { error?: { kind: string } } | null)?.error;
    return { ok: false, error: error ?? { kind: "TransportError" } };
  } catch (e) {
    return { ok: false, error: { kind: "TransportError", message: String(e) } };
  }
}
