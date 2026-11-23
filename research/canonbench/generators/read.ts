/**
 * READ items. Each question is asked about the same program in four arms: Canon, Canon with its
 * annotations stripped (requires, ensures and effects clauses removed), Python and TypeScript.
 * Every answer is computed by executing the three references; a question is kept only when all
 * three agree.
 *   output    "What does f(args) return?" on a fuzzed in-spec input (not a hidden test input)
 *   failure   "For which of these inputs does f return an error result?" (Result-returning seeds)
 *   property  "Is there any input for which f returns <property>?" decided on 10,000 fuzzed inputs:
 *             yes when a witness is found (certain); no when none is (fuzz-supported, not proven)
 *   effects   "Which of these functions can <effect>?" on the effectful seeds, ground truth from the
 *             instrumented sandbox and Canon's checked effects (scripts/verify-effects.ts)
 * Writes items/read.jsonl.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { approxEqual, execute, type CallResult } from "../adapters/exec.js";
import { VALUE_ENCODING } from "../arms/prompts.js";
import { InputGen, mulberry32 } from "../lib/gen.js";
import { OVERFLOW_TRAP, valid } from "../lib/preconditions.js";
import { BENCH, LANGS, loadRef, loadSeed, loadTests, seedIds, type Seed } from "../lib/seed.js";

export type ReadArm = "canon" | "canon-stripped" | "py" | "ts";
export const READ_ARMS: ReadArm[] = ["canon", "canon-stripped", "py", "ts"];

export interface ReadItem {
  qid: string;
  seed: string;
  type: "output" | "failure" | "property" | "effects";
  question: string;
  answerFormat: string;
  kind: "value" | "set" | "bool";
  answer: unknown;
  /** how certain the answer is: "executed", "witness", "fuzz-10000", "sandbox+checker" */
  basis: string;
  programs: Record<ReadArm, string>;
}

/** Remove requires, ensures and effects clauses (and their continuation lines) from Canon source. */
export function stripAnnotations(src: string): string {
  const out: string[] = [];
  let skipping = false;
  for (const line of src.split("\n")) {
    if (/^\s+(requires|ensures|effects):/.test(line)) {
      skipping = true;
      continue;
    }
    if (skipping && /^\s+(&&|\|\|)/.test(line)) continue;
    skipping = false;
    out.push(line);
  }
  return out.join("\n");
}

const agreeAll = (rs: CallResult[]) => rs.every((r) => r.ok) && rs.every((r) => approxEqual(r.v, rs[0].v));
const call = (s: Seed, args: unknown[]) => `${s.fn}(${args.map((a) => JSON.stringify(a)).join(", ")})`;
const trivial = (v: unknown) => v === null || v === "" || (Array.isArray(v) && v.length === 0) || v === false || v === 0;

function programs(id: string): Record<ReadArm, string> {
  const canon = loadRef("canon", id)!;
  return { canon, "canon-stripped": stripAnnotations(canon), py: loadRef("py", id)!, ts: loadRef("ts", id)! };
}

function inputsFor(s: Seed, n: number, salt: number): unknown[][] {
  const g = new InputGen(s, loadTests(s.id), mulberry32(104729 + salt * 7 + s.id.length));
  const hidden = new Set(loadTests(s.id).map((c) => JSON.stringify(c.args)));
  const seen = new Set<string>();
  const out: unknown[][] = [];
  for (let t = 0; out.length < n && t < n * 30; t++) {
    const a = g.next();
    const k = JSON.stringify(a);
    if (seen.has(k) || hidden.has(k) || !valid(s.id, a)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

function runAll(s: Seed, inputs: unknown[][], timeoutMs = 1000): CallResult[][] {
  const per = LANGS.map((l) => execute(l, loadRef(l, s.id)!, s, inputs, { timeoutMs }));
  return inputs.map((_, i) => per.map((r) => r[i]));
}

type Prop = { name: string; test: (v: unknown, args: unknown[]) => boolean; text: string };

function propsFor(s: Seed): Prop[] {
  const inner = s.ret.startsWith("Result[") ? s.ret.slice(7).split(",")[0].trim() : s.ret;
  const unwrap = (v: unknown) => (s.ret.startsWith("Result[") ? ((v as { ok: boolean; value?: unknown }).ok ? (v as { value: unknown }).value : undefined) : v);
  const ok = s.ret.startsWith("Result[") ? " a successful result whose value is" : "";
  const ps: Prop[] = [];
  if (inner === "Int") ps.push({ name: "negative", test: (v) => typeof unwrap(v) === "number" && (unwrap(v) as number) < 0, text: `${ok} a negative number` });
  if (inner.startsWith("List[")) ps.push({ name: "empty", test: (v) => Array.isArray(unwrap(v)) && (unwrap(v) as unknown[]).length === 0, text: `${ok} an empty list` });
  if (inner === "String") ps.push({ name: "empty", test: (v) => unwrap(v) === "", text: `${ok} the empty string` });
  const firstSeq = s.params.findIndex(([, t]) => t === inner && (t === "String" || t.startsWith("List[")));
  if (firstSeq >= 0) {
    const p = s.params[firstSeq][0];
    ps.push({
      name: "longer",
      test: (v, args) => {
        const u = unwrap(v);
        const len = (x: unknown) => (typeof x === "string" ? [...x].length : Array.isArray(x) ? x.length : -1);
        return u !== undefined && len(u) > len(args[firstSeq]);
      },
      text: `${ok} longer than \`${p}\``,
    });
  }
  if (s.ret.startsWith("Result[")) {
    ps.push({ name: "error-on-empty-arg", test: (v, args) => !(v as { ok: boolean }).ok && args.every((a) => trivial(a) || a === ""), text: " an error result although every argument is empty (empty strings, empty lists, zeros)" });
  }
  return ps;
}

const items: ReadItem[] = [];
const dropped: Record<string, number> = { output: 0, failure: 0, property: 0, effects: 0 };
const ids = seedIds();
ids.forEach((id, k) => {
  const s = loadSeed(id);
  const progs = programs(id);
  // ---------------------------------------------------------- output
  {
    const ins = inputsFor(s, 60, 1);
    const res = runAll(s, ins);
    const good = ins.map((a, i) => ({ a, r: res[i] })).filter((x) => agreeAll(x.r));
    const pick = good.find((x) => !trivial(x.r[0].v) && JSON.stringify(x.r[0].v).length < 400) ?? good[0];
    if (pick) {
      items.push({
        qid: `${id}.output`,
        seed: id,
        type: "output",
        question: `What does \`${call(s, pick.a)}\` return? The arguments are written as JSON. ${VALUE_ENCODING}`,
        answerFormat: "<the returned value, as JSON on one line>",
        kind: "value",
        answer: pick.r[0].v,
        basis: "executed",
        programs: progs,
      });
    } else dropped.output++;
  }
  // ---------------------------------------------------------- failure
  if (s.ret.startsWith("Result[")) {
    const ins = inputsFor(s, 80, 2);
    const res = runAll(s, ins);
    const good = ins.map((a, i) => ({ a, r: res[i] })).filter((x) => agreeAll(x.r) && JSON.stringify(x.a).length < 200);
    const errs = good.filter((x) => !(x.r[0].v as { ok: boolean }).ok);
    const oks = good.filter((x) => (x.r[0].v as { ok: boolean }).ok);
    const nErr = 1 + (k % 3); // 1 to 3 of the 4 options are errors
    if (errs.length >= nErr && oks.length >= 4 - nErr) {
      const r = mulberry32(31 + k);
      const chosen = [...errs.slice(0, nErr), ...oks.slice(0, 4 - nErr)].map((x) => ({ x, o: r() })).sort((a, b) => a.o - b.o).map((y) => y.x);
      const letters = ["A", "B", "C", "D"];
      items.push({
        qid: `${id}.failure`,
        seed: id,
        type: "failure",
        question:
          `For which of these calls does \`${s.fn}\` return an error result (an error, not a successful value)? The arguments are written as JSON.\n` +
          chosen.map((x, i) => `${letters[i]}. ${call(s, x.a)}`).join("\n"),
        answerFormat: '<a JSON array of the letters, e.g. ["A", "C"]>',
        kind: "set",
        answer: chosen.flatMap((x, i) => ((x.r[0].v as { ok: boolean }).ok ? [] : [letters[i]])),
        basis: "executed",
        programs: progs,
      });
    } else dropped.failure++;
  }
  // ---------------------------------------------------------- property
  {
    const props = propsFor(s);
    const ins = inputsFor(s, 10000, 3);
    const per = LANGS.map((l) => execute(l, loadRef(l, id)!, s, ins, { timeoutMs: 300 }));
    const decided: { p: Prop; yes: boolean }[] = [];
    for (const p of props) {
      const hits = LANGS.map((_, li) => ins.some((a, i) => per[li][i].ok && p.test(per[li][i].v, a)));
      const witnessAgree = ins.some((a, i) => per.every((r) => r[i].ok) && agreeAll(per.map((r) => r[i])) && p.test(per[0][i].v, a));
      const crashes = per.some((r) => r.filter((x) => !x.ok && !OVERFLOW_TRAP.test(x.e ?? "")).length > ins.length * 0.5);
      if (crashes) continue;
      if (hits.every((h) => h) && witnessAgree) decided.push({ p, yes: true });
      else if (hits.every((h) => !h)) decided.push({ p, yes: false });
    }
    const wantNo = k % 2 === 0;
    const pick = decided.find((d) => d.yes !== wantNo) ?? decided[0];
    if (pick) {
      items.push({
        qid: `${id}.property`,
        seed: id,
        type: "property",
        question: `Can \`${s.fn}\` ever return${pick.p.text}? Consider every possible argument value of the declared types for which the function returns normally (without raising, throwing or trapping).`,
        answerFormat: "yes or no",
        kind: "bool",
        answer: pick.yes,
        basis: pick.yes ? "witness" : "fuzz-10000",
        programs: progs,
      });
    } else dropped.property++;
  }
});

// ---------------------------------------------------------- effects
const EFFECT_TEXT: Record<string, string> = {
  net: "access the network",
  fs: "read or write files",
  time: "read the clock or sleep",
  rand: "use randomness",
};
const effDir = join(BENCH, "effects");
for (const id of readdirSync(effDir).filter((d) => existsSync(join(effDir, d, "truth.json"))).sort()) {
  const truth = JSON.parse(readFileSync(join(effDir, id, "truth.json"), "utf8")) as { functions: Record<string, string[]> };
  const canon = readFileSync(join(effDir, id, "program.cn"), "utf8");
  const progs: Record<ReadArm, string> = {
    canon,
    "canon-stripped": stripAnnotations(canon),
    py: readFileSync(join(effDir, id, "program.py"), "utf8"),
    ts: readFileSync(join(effDir, id, "program.ts"), "utf8"),
  };
  const names = Object.keys(truth.functions).sort();
  for (const eff of ["net", "fs", "time", "rand"]) {
    items.push({
      qid: `${id}.effects.${eff}`,
      seed: `effects/${id}`,
      type: "effects",
      question: `Which of these functions can ${EFFECT_TEXT[eff]} when called, directly or through the functions they call? Functions: ${names.join(", ")}.`,
      answerFormat: '<a JSON array of function names, e.g. ["a", "b"], or [] if none>',
      kind: "set",
      answer: names.filter((n) => truth.functions[n].includes(eff)),
      basis: "sandbox+checker",
      programs: progs,
    });
  }
}

writeFileSync(join(BENCH, "items", "read.jsonl"), items.map((x) => JSON.stringify(x)).join("\n") + "\n");
const by = (t: string) => items.filter((x) => x.type === t).length;
console.log(`READ: ${items.length} questions (output ${by("output")}, failure ${by("failure")}, property ${by("property")} [yes ${items.filter((x) => x.type === "property" && x.answer === true).length}], effects ${by("effects")}); dropped ${JSON.stringify(dropped)}`);
