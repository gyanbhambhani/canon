/**
 * The hero transcript: the real CLI run on examples/mistakes/missing-effect.cn, its patch applied,
 * then checked and run again. Nothing here is typed by hand, so the page cannot drift from the
 * compiler's output.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyPatch, check } from "@canon/compiler";
import { main } from "../../packages/cli/src/main.js";

export type LineKind = "prompt" | "comment" | "out" | "error" | "del" | "add" | "ok" | "blank";
export interface TermLine {
  kind: LineKind;
  text: string;
}

const FILE = "hello.cn";

async function cli(dir: string, argv: string[]): Promise<string> {
  let out = "";
  const io = { stdout: (s: string) => (out += s), stderr: (s: string) => (out += s) };
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    await main(argv, io);
  } finally {
    process.chdir(cwd);
  }
  return out;
}

function classify(text: string): TermLine {
  if (/^ {2}-(?!--)/.test(text)) return { kind: "del", text };
  if (/^ {2}\+(?!\+\+)/.test(text)) return { kind: "add", text };
  if (/: ok$/.test(text)) return { kind: "ok", text };
  if (/ error [A-Z]\d{3}: /.test(text)) return { kind: "error", text };
  return { kind: "out", text };
}

export async function heroTranscript(root: string): Promise<{ lines: TermLine[]; broken: string; fixed: string }> {
  const broken = readFileSync(join(root, "examples", "mistakes", "missing-effect.cn"), "utf8");
  const diag = check(broken, FILE).diagnostics;
  if (diag.length !== 1 || !diag[0].fix) throw new Error("missing-effect.cn must have exactly one diagnostic with a patch");
  const fixed = applyPatch(broken, diag[0].fix.diff);
  if (fixed !== readFileSync(join(root, "examples", "hello.cn"), "utf8")) throw new Error("the patched missing-effect.cn must equal examples/hello.cn");

  const dir = mkdtempSync(join(tmpdir(), "canon-hero-"));
  try {
    const lines: TermLine[] = [];
    const step = async (argv: string[]) => {
      lines.push({ kind: "prompt", text: `$ canon ${argv.join(" ")}` });
      for (const l of (await cli(dir, argv)).replace(/\n$/, "").split("\n")) lines.push(classify(l));
    };
    writeFileSync(join(dir, FILE), broken);
    await step(["check", FILE]);
    lines.push({ kind: "blank", text: "" }, { kind: "comment", text: "# the agent applies the patch" }, { kind: "blank", text: "" });
    writeFileSync(join(dir, FILE), fixed);
    await step(["check", FILE]);
    await step(["run", FILE]);
    return { lines, broken, fixed };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
