/** The generated site data agrees with the research reports and the compiler. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { check } from "@canon/compiler";
import { siteData } from "../../../scripts/stats";

const root = join(__dirname, "..", "..", "..");

describe("site data", async () => {
  const d = await siteData();

  it("v0.2 leads and v0 is kept, each with the verdicts its report states", () => {
    expect(d.benchmark.report).toBe("REPORT-v0.2.md");
    expect(d.benchmarkV0.report).toBe("REPORT.md");
    for (const b of [d.benchmark, d.benchmarkV0]) {
      const ids = b.verdicts.map((v) => v.id);
      for (const id of ["C1", "C2", "C3", "C4", "C5"]) expect(ids, b.report).toContain(id);
    }
  });

  it("C1 to C4 recomputed from the raw runs agree with both reports", () => {
    for (const b of [d.benchmark, d.benchmarkV0]) {
      for (const c of b.computedVerdicts) expect(b.verdicts.find((v) => v.id === c.id)!.verdict, `${b.report} ${c.id}`).toBe(c.verdict);
    }
  });

  it("the distinct-program ratios and intervals match the reports", () => {
    const v0 = readFileSync(join(root, "research", "benchmark", "REPORT.md"), "utf8");
    const v02 = readFileSync(join(root, "research", "benchmark", "REPORT-v0.2.md"), "utf8");
    const f = (x: number) => x.toFixed(2);
    for (const m of d.benchmarkV0.byModel) expect(v0).toContain(`ratio ${f(m.ratio)} (95% CI ${f(m.ratioLo)}-${f(m.ratioHi)})`);
    for (const m of d.benchmark.byModel) {
      expect(v02).toContain(`ratio ${f(m.ratio)} [${f(m.ratioLo)}, ${f(m.ratioHi)}]`);
      expect(v02).toContain(`${f(m.canon.distinct)} [${f(m.canon.distinctLo)}, ${f(m.canon.distinctHi)}]`);
    }
  });

  it("the hero transcript is real CLI output: an error with a patch, then ok, then the program's output", () => {
    const text = d.terminal.lines.map((l) => l.text).join("\n");
    expect(text).toMatch(/^\$ canon check hello\.cn\nhello\.cn:1:4: error E101: /);
    expect(d.terminal.lines.some((l) => l.kind === "add" && l.text.includes("effects: io"))).toBe(true);
    expect(text).toMatch(/\$ canon check hello\.cn\nhello\.cn: ok\n\$ canon run hello\.cn\nhello, canon$/);
  });

  it("every Break it mistake has one diagnostic with a patch", () => {
    expect(d.mistakes.length).toBeGreaterThanOrEqual(3);
    for (const m of d.mistakes) {
      const r = check(m.source, `${m.id}.cn`);
      expect(r.diagnostics.length, m.id).toBe(1);
      expect(r.diagnostics[0].fix?.kind, m.id).toBe("patch");
    }
  });

  it("the likelihood rows include the spellings v0.2 adopted", () => {
    const adopted = d.likelihood.rows.filter((r) => r.adopted).map((r) => r.id).sort();
    expect(adopted).toEqual(["mutation", "string-join", "while-loop"]);
  });
});
