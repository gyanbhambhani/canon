type Person = { name: string; age: number };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function age_histogram(people: Person[], width: number): Result<[string, number][]> {
  if (width < 1) return { ok: false, error: "bad width" };
  for (const p of people) {
    if (p.age < 0) return { ok: false, error: "negative age: " + p.name };
  }
  if (people.length === 0) return { ok: true, value: [] };
  const bs = people.map((p) => Math.floor(p.age / width));
  const lo = Math.min(...bs);
  const hi = Math.max(...bs);
  const out: [string, number][] = [];
  for (let b = lo; b <= hi; b++) {
    out.push([b * width + "-" + (b * width + width - 1), bs.filter((x) => x === b).length]);
  }
  return { ok: true, value: out };
}
