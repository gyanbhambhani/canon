type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function flatten_nested(s: string): Result<[number[], number]> {
  const t = s.split(" ").join("");
  let i = 0;
  const ints: number[] = [];
  let maxDepth = 0;
  class Bad extends Error {}
  const bad = (): never => {
    throw new Bad("invalid at " + i);
  };
  const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";
  function list(depth: number): void {
    if (t[i] !== "[") bad();
    i++;
    maxDepth = Math.max(maxDepth, depth);
    if (t[i] === "]") {
      i++;
      return;
    }
    for (;;) {
      if (t[i] === "[") list(depth + 1);
      else {
        const start = i;
        if (t[i] === "-") i++;
        if (!isDigit(t[i])) bad();
        while (isDigit(t[i])) i++;
        ints.push(Number(t.slice(start, i)));
      }
      if (t[i] === ",") i++;
      else if (t[i] === "]") {
        i++;
        return;
      } else bad();
    }
  }
  try {
    list(1);
    if (i < t.length) bad();
    return { ok: true, value: [ints, maxDepth] };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
