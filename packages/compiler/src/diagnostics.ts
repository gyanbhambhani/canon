export type Severity = "error" | "warning" | "info";

export interface Fix {
  kind: "patch";
  diff: string;
}

export interface Diagnostic {
  code: string;
  severity: Severity;
  message: string;
  line: number;
  col: number;
  fix?: Fix;
  data?: Record<string, unknown>;
}

export function diag(
  code: string,
  message: string,
  line = 0,
  col = 0,
  extra: { fix?: Fix; data?: Record<string, unknown>; severity?: Severity } = {},
): Diagnostic {
  const d: Diagnostic = { code, severity: extra.severity ?? "error", message, line, col };
  if (extra.fix !== undefined) d.fix = extra.fix;
  if (extra.data !== undefined) d.data = extra.data;
  return d;
}

export class CanonError extends Error {
  readonly diag: Diagnostic;
  constructor(d: Diagnostic) {
    super(d.message);
    this.name = "CanonError";
    this.diag = d;
  }
}
