type Job = { name: string; deps: string[] };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function build_order(jobs: Job[]): Result<string[]> {
  const names = new Set<string>();
  for (const j of jobs) {
    if (names.has(j.name)) return { ok: false, error: "duplicate job: " + j.name };
    names.add(j.name);
  }
  for (const j of jobs) {
    for (const d of j.deps) {
      if (!names.has(d)) return { ok: false, error: "unknown dependency: " + d };
    }
  }
  const done: string[] = [];
  const placed = new Set<string>();
  while (done.length < jobs.length) {
    const next = jobs.find((j) => !placed.has(j.name) && j.deps.every((d) => placed.has(d)));
    if (!next) return { ok: false, error: "cycle detected" };
    placed.add(next.name);
    done.push(next.name);
  }
  return { ok: true, value: done };
}
