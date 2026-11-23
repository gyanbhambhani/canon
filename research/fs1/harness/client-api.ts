/**
 * The API of FS-1's client tests. A client test imports an arm's feature modules
 * (frontend/src/features/<name>.ts, the same signature in every arm) and calls them against the
 * running backend. Tags: "client" (always), "probe" (a boundary probe: the server accepted what
 * the client sent, and the client parsed what the server returned), "regression".
 */
export interface Outcome {
  ok: boolean;
  value?: unknown;
  error?: { kind: string; [field: string]: unknown };
}

export interface Ctx {
  baseUrl: string;
  /** An arm's feature module, by file name (without .ts). */
  feature(name: string): Promise<Record<string, (...args: any[]) => Promise<Outcome>>>;
  /** Call the server directly (ground truth for probes). */
  http(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }>;
  /** A string no other test uses. */
  unique(prefix: string): string;
  equal(actual: unknown, expected: unknown, what?: string): void;
  /** The value of a successful outcome (fails the test otherwise). */
  ok<T = any>(o: Outcome, what?: string): T;
  /** A failed outcome with this error kind (fails the test otherwise). */
  fails(o: Outcome, kind: string, what?: string): Record<string, unknown>;
}

export interface ClientTest {
  id: string;
  tags: string[];
  run(t: Ctx): Promise<void>;
}

/** Validation agreement: random inputs to one feature, compared with the server's 422s. */
export interface ValidationSpec {
  feature: string;
  /** Generators for the feature's arguments after baseUrl, in order. */
  args: { name: string; gen: string }[];
  /** The request the feature should send, with $name for argument values. */
  request: { method: string; path: string; body?: unknown; query?: Record<string, string> };
  samples?: number;
}
