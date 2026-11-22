/**
 * M3 acceptance: every program in tests/run (and every example) prints its expected output.
 * examples/NAME.cn is expected to print tests/run/example_NAME.out.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRELUDE, readSource } from "@canon/compiler";
import { run, test } from "./helpers/run";

const runDir = join(__dirname, "run");
const exDir = join(__dirname, "..", "examples");
const programs = [
  ...readdirSync(runDir).filter((f) => f.endsWith(".cn")).map((f) => ({ name: f, file: join(runDir, f), out: join(runDir, f.replace(/\.cn$/, ".out")) })),
  ...readdirSync(exDir).filter((f) => f.endsWith(".cn")).map((f) => ({ name: `examples/${f}`, file: join(exDir, f), out: join(runDir, `example_${f.replace(/\.cn$/, ".out")}`) })),
];

describe("tests/run", () => {
  it("has at least 25 programs, including the required ones", () => {
    expect(programs.length).toBeGreaterThanOrEqual(25);
    for (const n of ["examples/hello.cn", "examples/fizzbuzz.cn", "examples/word_count.cn", "examples/orders.cn", "examples/result_try.cn", "match_sum.cn"]) {
      expect(programs.map((p) => p.name)).toContain(n);
    }
  });

  for (const p of programs) {
    it(p.name, () => {
      const inFile = p.file.replace(/\.cn$/, ".in");
      const input = existsSync(inFile) ? readFileSync(inFile, "utf8").split("\n").slice(0, -1) : [];
      const r = run(readSource(readFileSync(p.file, "utf8")), { input });
      expect(r.trap).toBeUndefined();
      expect(r.error).toBeUndefined();
      expect(r.stdout).toBe(readFileSync(p.out, "utf8"));
      expect(r.status).toBe(0);
    });
  }

  it("every example's test blocks pass", () => {
    for (const f of readdirSync(exDir).filter((x) => x.endsWith(".cn"))) {
      const results = test(readSource(readFileSync(join(exDir, f), "utf8")));
      for (const t of results) expect(t, `${f}: ${t.name}`).toMatchObject({ passed: true });
    }
  });

  it("every standard library function is called by at least one run program or runtime test", () => {
    const names = [...PRELUDE.matchAll(/^fn (\w+)/gm)].map((m) => m[1]);
    const corpus = [
      ...programs.map((p) => readFileSync(p.file, "utf8")),
      readFileSync(join(__dirname, "runtime.test.ts"), "utf8"),
    ].join("\n");
    const missing = names.filter((n) => !new RegExp(`\\b${n}\\(|\\|> ${n}\\(|, ${n}\\)`).test(corpus));
    expect(missing).toEqual([]);
  });
});
