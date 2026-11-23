/** Compile and run Canon source in-process against a memory host (wrapped in the test host). */
import { compileJs, type CompileOptions } from "@canon/compiler";
import { MemoryHost, runMain, runTests, testHost, type Host, type MainResult, type RunOptions, type TestOutcome } from "@canon/runtime";

export interface RunOutput extends MainResult {
  stdout: string;
}

export function compileOrThrow(src: string, opts: CompileOptions = {}): string {
  const c = compileJs(src, "main.cn", opts);
  if (!c.js) throw new Error(`does not check:\n${JSON.stringify(c.check.diagnostics, null, 2)}`);
  return c.js;
}

export function run(src: string, opts: RunOptions & { input?: string[]; host?: (m: MemoryHost) => Host } = {}): RunOutput {
  const js = compileOrThrow(src);
  const mem = new MemoryHost(undefined, opts.input ?? []);
  const host = opts.host ? opts.host(mem) : testHost(mem);
  const r = runMain(js, host, opts);
  return { ...r, stdout: mem.out.map((l) => l + "\n").join("") };
}

export function test(src: string): TestOutcome[] {
  return runTests(compileOrThrow(src), testHost(new MemoryHost()));
}
