/**
 * Tests the input generator itself, with a toy oracle (no server): for each rule, the generator must
 * produce inputs just inside it and just outside it, changing only the named fields; it is
 * deterministic by seed; and it keeps its category mix.
 *   tsx harness/generator.test.ts
 */
import assert from "node:assert/strict";
import { generate, type GenSpec } from "./generator";

const spec: GenSpec = {
  id: "toy",
  base: { name: "=alnum(int(1, 10))", start: "=int(0, 100)", end: "=$start + int(1, 30)" },
  random: { name: "=pick(['', 'x'])", start: "=int(-5, 120)", end: "=int(-5, 150)" },
  rules: [
    { id: "name_len", kind: "single", desc: "", inside: [{ set: { name: "=rep('a', 10)" } }], outside: [{ set: { name: "=rep('a', 11)" } }, { set: { name: "" } }] },
    { id: "order", kind: "cross", desc: "", inside: [{ set: { end: "=$start + 1" } }], outside: [{ set: { end: "=$start" } }, { set: { end: "=$start - 1" } }] },
    { id: "stay", kind: "cross", desc: "", inside: [{ set: { end: "=$start + 30" } }], outside: [{ set: { end: "=$start + 31" } }] },
  ],
};

const rules: Record<string, (i: Record<string, any>) => boolean> = {
  name_len: (i) => i.name.length >= 1 && i.name.length <= 10,
  order: (i) => i.end > i.start,
  stay: (i) => i.end - i.start <= 30,
};
const all = (i: Record<string, any>) => Object.values(rules).every((f) => f(i));

const samples = generate(spec, 2026, 1000);
assert.equal(samples.length, 1000);
assert.deepEqual(samples, generate(spec, 2026, 1000), "deterministic by seed");
assert.notDeepEqual(samples, generate(spec, 7, 1000), "a different seed gives different inputs");

const count: Record<string, number> = {};
for (const s of samples) count[s.category.split(":")[0]] = (count[s.category.split(":")[0]] ?? 0) + 1;
assert.deepEqual(count, { base: 100, inside: 200, outside: 500, random: 200 });

const seen = new Set<string>();
for (const s of samples) {
  if (s.category === "base" || s.category.startsWith("inside:")) assert.ok(all(s.input), `${s.category} must be valid: ${JSON.stringify(s.input)}`);
  if (s.category.startsWith("outside:")) {
    const id = s.category.slice("outside:".length);
    seen.add(id);
    assert.ok(!rules[id](s.input), `${s.category} must break its rule: ${JSON.stringify(s.input)}`);
    // every other rule still holds: a single rule is broken, by the smallest amount
    for (const [other, f] of Object.entries(rules)) if (other !== id) assert.ok(f(s.input), `${s.category} also breaks ${other}: ${JSON.stringify(s.input)}`);
    assert.ok(s.changed.length >= 1 && s.changed.length <= 2);
  }
}
assert.deepEqual([...seen].sort(), ["name_len", "order", "stay"], "every rule gets outside inputs");
// each rule is hit on both sides of its edge
const edges = (id: string) => samples.filter((s) => s.category === `outside:${id}`).length;
for (const id of ["name_len", "order", "stay"]) assert.ok(edges(id) > 100, `${id} gets a fair share`);
const outsideOrder = samples.filter((s) => s.category === "outside:order");
assert.ok(outsideOrder.some((s) => s.input.end === s.input.start) && outsideOrder.some((s) => (s.input.end as number) === (s.input.start as number) - 1), "both sides");
console.log("generator tests passed");
