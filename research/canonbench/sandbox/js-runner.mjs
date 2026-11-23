/**
 * Sandbox for JavaScript execution (compiled Canon and transpiled TypeScript). Runs in its own
 * Node process (the caller sets --max-old-space-size), inside a fresh vm context that has no
 * require, no fetch, no process and no timers: generated code cannot reach the network or the disk.
 * Canon effects go to an in-memory test host (mocked). Each call has its own time limit.
 *
 * stdin:  {"mode": "canon" | "ts", "js": string, "name": string, "calls": unknown[][], "timeoutMs": number}
 * stdout: [{"ok": true, "v": value} | {"ok": false, "e": message}, ...]
 */
import vm from "node:vm";
import { MemoryHost, Runtime, testHost } from "@canon/runtime";

const input = JSON.parse(await new Promise((res) => {
  let s = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (d) => (s += d));
  process.stdin.on("end", () => res(s));
}));

const ctx = vm.createContext({ __calls: input.calls, __out: [] });
const timeout = input.timeoutMs ?? 2000;
let loadError = null;
try {
  if (input.mode === "canon") {
    ctx.__rt = new Runtime(testHost(new MemoryHost()));
    ctx.__js = input.js;
    vm.runInContext(`globalThis.__f = (new Function("$rt", __js))(__rt).fns[${JSON.stringify(input.name)}];`, ctx, { timeout });
  } else {
    ctx.__js = input.js;
    vm.runInContext(
      `{ const module = { exports: {} }; (new Function("exports", "module", __js))(module.exports, module); globalThis.__f = module.exports[${JSON.stringify(input.name)}]; }`,
      ctx,
      { timeout },
    );
  }
  if (typeof ctx.__f !== "function") loadError = `no function ${input.name}`;
} catch (e) {
  loadError = String(e?.message ?? e).slice(0, 300);
}

const out = [];
for (let i = 0; i < input.calls.length; i++) {
  if (loadError) {
    out.push({ ok: false, e: loadError });
    continue;
  }
  try {
    const v = vm.runInContext(`JSON.stringify(__f(...__calls[${i}]))`, ctx, { timeout });
    out.push({ ok: true, v: v === undefined ? null : JSON.parse(v) });
  } catch (e) {
    if (ctx.__rt) ctx.__rt.stack.length = 0;
    const msg = e && typeof e === "object" && "code" in e && e.code ? `${e.code}: ${e.message}` : String(e?.message ?? e);
    out.push({ ok: false, e: msg.slice(0, 300) });
  }
}
process.stdout.write(JSON.stringify(out));
