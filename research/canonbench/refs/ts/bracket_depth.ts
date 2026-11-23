type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function bracket_depth(s: string): Result<number> {
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: string[] = [];
  let best = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(" || c === "[" || c === "{") {
      stack.push(c);
      best = Math.max(best, stack.length);
    } else if (c in pairs) {
      if (stack.length === 0 || stack[stack.length - 1] !== pairs[c]) return { ok: false, error: "mismatch at " + i };
      stack.pop();
    }
  }
  if (stack.length > 0) return { ok: false, error: "unclosed at end" };
  return { ok: true, value: best };
}
