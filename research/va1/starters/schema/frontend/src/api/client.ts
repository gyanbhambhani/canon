import type { Outcome } from "../features/result";
import { validateSchema } from "./validate";

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

/**
 * Send a JSON body after checking it. First against the Pydantic model's generated validator
 * (`model` is the model's class name, as in components.schemas); then, if the schema cannot state a
 * rule (a rule over two fields, or a computed one), against `extra`, which returns a message when
 * the input is invalid. A rejected input is never sent.
 */
export async function send<T>(
  baseUrl: string,
  method: string,
  path: string,
  model: string,
  input: unknown,
  extra?: (input: never) => string | null,
): Promise<Outcome<T>> {
  const broken = validateSchema(model, input) ?? extra?.(input as never) ?? null;
  if (broken !== null) return invalid(broken);
  return call<T>(baseUrl, method, path, input);
}
