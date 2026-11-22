/** applyPatch must agree with the system `patch` tool on every diagnostic patch in the corpus. */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyPatch, check, fmt, readSource } from "@canon/compiler";

function systemPatch(src: string, diff: string): string | null {
  const d = mkdtempSync(join(tmpdir(), "canon-p-"));
  writeFileSync(join(d, "main.cn"), src);
  writeFileSync(join(d, "fix.diff"), diff);
  const p = spawnSync("patch", ["-p1", "-i", "fix.diff"], { cwd: d, encoding: "utf8" });
  if (p.status !== 0) return null; // difflib output for a file with no final newline
  return readFileSync(join(d, "main.cn"), "utf8");
}

describe("applyPatch", () => {
  it("matches the system patch tool on every patch the checker produces for the corpus", () => {
    const dirs = ["tests/conformance", "tests/types/fail"].map((d) => join(__dirname, "..", "..", "..", d));
    let n = 0;
    for (const dir of dirs) {
      for (const f of readdirSync(dir).filter((x) => x.endsWith(".cn") && !x.endsWith(".fmt.cn"))) {
        const src = readSource(readFileSync(join(dir, f), "utf8"));
        for (const d of check(src, "main.cn").diagnostics) {
          if (!d.fix) continue;
          const ours = applyPatch(src, d.fix.diff);
          const theirs = systemPatch(src, d.fix.diff);
          if (theirs !== null) expect(ours, `${f} ${d.code}`).toBe(theirs);
          else {
            // only the no-final-newline case defeats the system tool; there, the C001 patch is fmt
            expect(src.endsWith("\n"), f).toBe(false);
            if (d.code === "C001") expect(ours, f).toBe(fmt(src));
            else expect(ours, f).not.toBeNull();
          }
          n++;
        }
      }
    }
    expect(n).toBeGreaterThan(50);
  });

  it("returns null when a hunk does not apply", () => {
    const d = check("fn greet(name: String) -> Unit {\n  print(name)\n}\n", "main.cn").diagnostics[0];
    expect(applyPatch("something else\n", d.fix!.diff)).toBeNull();
  });
});
