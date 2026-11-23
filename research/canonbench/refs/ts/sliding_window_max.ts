type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function sliding_window_max(xs: number[], k: number): Result<number[]> {
  if (k < 1) return { ok: false, error: "window must be positive" };
  if (k > xs.length) return { ok: false, error: "window larger than input" };
  const out: number[] = [];
  for (let i = 0; i + k <= xs.length; i++) out.push(Math.max(...xs.slice(i, i + k)));
  return { ok: true, value: out };
}
