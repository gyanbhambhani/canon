/**
 * The /research page states some results in words ("Every Canon program worked", "went up for
 * one model and down for the other", "v0.2 adopted all three"). Each statement is pinned to the
 * data here, so a future run that changes the result fails this test until the copy is updated.
 */
import { describe, expect, it } from "vitest";
import { siteData } from "../../../scripts/stats";

describe("research page copy matches the data", async () => {
  const site = await siteData();
  const b = site.benchmark;
  const v0 = site.benchmarkV0;
  const model = b.models[0];
  const task = (id: string) => b.taskRows.find((t) => t.task === id)!.distinct[model];

  it("Correct: every Canon and TypeScript program worked, hard tasks included", () => {
    for (const m of b.byModel) {
      expect(m.canon.correct).toBe(1);
      expect(m.canon.correctHard).toBe(1);
      expect(m.typescript.correct).toBe(1);
    }
  });

  it("Self-correcting: every failed first draft passed after one patch", () => {
    expect(site.display.fixedInOne).toBe(site.display.failedFirst);
    expect(Number(site.display.failedFirst.replace(/,/g, ""))).toBeGreaterThan(0);
  });

  it("Consistency: not supported against TypeScript, and v0.2 did not improve on v0", () => {
    const verdict = (id: string) => b.verdicts.find((v) => v.id === id)!.verdict;
    expect(verdict("C3")).toBe("NOT SUPPORTED");
    expect(verdict("D1")).toBe("NOT SUPPORTED");
  });

  it("Cost: a working Canon program cost more, and Canon answers are longer", () => {
    const priced = b.byModel.filter((m) => m.canon.costPerCorrect !== null);
    expect(priced.length).toBeGreaterThan(0);
    for (const m of priced) expect(m.canon.costPerCorrect!).toBeGreaterThan(m.typescript.costPerCorrect!);
    for (const m of b.byModel) expect(m.canon.outputTokens).toBeGreaterThan(m.typescript.outputTokens);
  });

  it("First-try validity went up for one model and down for the other", () => {
    const moves = b.byModel.map((m) => Math.sign(m.canon.firstPass - v0.byModel.find((x) => x.model === m.model)!.canon.firstPass));
    expect(moves.sort()).toEqual([-1, 1]);
  });

  it("apply_ops diverged in Canon, and sum_evens was identical in every run", () => {
    expect(task("apply_ops").canon).toBeGreaterThan(task("apply_ops").typescript);
    expect(task("sum_evens").canon).toBe(1);
    expect(task("sum_evens").typescript).toBeGreaterThan(1);
  });

  it("v0.2 adopted while, plain assignment and + for strings, and kept and/or/not", () => {
    const adopted = (id: string) => site.likelihood.rows.find((r) => r.id === id)?.adopted;
    expect([adopted("while-loop"), adopted("mutation"), adopted("string-join"), adopted("logic-words")]).toEqual([true, true, true, false]);
  });
});
