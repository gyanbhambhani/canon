/**
 * v0.3 red team: every way we know to perform an effect that no signature declares. Each file in
 * tests/effects names its expected outcome on its first line:
 *   # expect: E101 / E103   the checker refuses it (the effect is visible before running)
 *   # expect: ok            legitimate: the function that supplies the effect declares it, and the
 *                           program runs under the capability guard with main's effects only
 * The claim under test: what a checked Canon program can do is bounded by main's effects clause
 * (and a test's by its own clause plus the virtual io, time and rand), before it runs.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { check, compileJs, readSource, V03 } from "@canon/compiler";
import { MemoryHost, runMain, testHost } from "@canon/runtime";

const dir = join(__dirname, "effects");
const files = readdirSync(dir).filter((f) => f.endsWith(".cn")).sort();

describe("red team: effect smuggling", () => {
  it("covers tests, function values, lambdas in records and lists, generics, aliases, chains and contracts", () => {
    expect(files.length).toBeGreaterThanOrEqual(15);
  });

  it("v0.4: covers effects through parameters, record fields, lambdas, generics, nesting, lists and returns", () => {
    const fx = files.filter((f) => f.startsWith("fx_"));
    for (const k of ["param", "record_field", "lambda_wrap", "generic", "nested", "list", "return"]) expect(fx).toContain(`fx_${k}.cn`);
  });

  for (const f of files) {
    const src = readSource(readFileSync(join(dir, f), "utf8"));
    const want = /^# expect: (\S+)/.exec(src)![1];
    // programs written for v0.3 (which v0.4's effects on function types reject) run in that mode
    const opts = /^# mode: v0\.3$/m.test(src) ? { features: V03 } : {};
    it(`${f}: ${want}`, () => {
      const codes = check(src, f, opts).diagnostics.map((d) => d.code);
      if (want === "T011" || f.startsWith("fx_")) {
        // with the v0.4 switch off, the higher-order leak is invisible again (v0.3)
        expect(check(src, f, { features: { fnEffects: false } }).diagnostics.map((d) => d.code)).not.toContain(want === "ok" ? "T011" : want);
      }
      if (want === "ok") {
        expect(codes).toEqual([]);
        const js = compileJs(src, f, opts).js!;
        const mem = new MemoryHost();
        const r = runMain(js, testHost(mem), { capabilityGuard: true });
        expect(r.trap).toBeUndefined();
        expect(mem.out.length).toBe(1);
      } else {
        expect(codes).toContain(want);
        // with the v0.3 sealed effects off, test and contract smuggling is invisible again (v0.2)
        if (want === "E103" || f.startsWith("test_")) {
          expect(check(src, f, { features: { sealedEffects: false } }).diagnostics.map((d) => d.code)).not.toContain(want);
        }
      }
    });
  }

  it("the runtime guard stops an effect even if the checker were wrong", () => {
    const src = "fn main() -> Unit\n  effects: fs, io\n{\n  let r = write_file(\"x\", \"y\")\n  print(to_string(r == r))\n}\n";
    const js = compileJs(src).js!;
    // simulate a checker bug: main's declared effects lose fs
    const forged = js.replace('mainEffects: ["fs","io"]', 'mainEffects: ["io"]');
    expect(forged).not.toBe(js);
    const r = runMain(forged, testHost(new MemoryHost()), { capabilityGuard: true });
    expect(r.trap).toMatchObject({ code: "R006" });
    expect(r.trap!.message).toContain("fn main does not declare it");
    expect(runMain(forged, testHost(new MemoryHost()), { capabilityGuard: false }).trap).toBeUndefined();
  });
});
