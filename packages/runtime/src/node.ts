/** The Node.js host for `canon run` and `canon test`. Not imported by browser code. */
import { spawnSync } from "node:child_process";
import { readFileSync, readSync, writeFileSync } from "node:fs";
import type { Effect, Host, HostResult } from "./host.js";

const FETCH = `
const [method, url, body] = JSON.parse(process.argv[1]);
fetch(url, method === "POST" ? { method, body } : { method })
  .then(async (r) => {
    const text = await r.text();
    process.stdout.write(JSON.stringify(r.ok ? { ok: true, value: text } : { ok: false, error: "HTTP " + r.status + ": " + text.slice(0, 200) }));
  })
  .catch((e) => process.stdout.write(JSON.stringify({ ok: false, error: String(e && e.message || e) })));
`;

function http(method: string, url: string, body?: string): HostResult {
  // Canon is synchronous; run the request in a child process and wait for it.
  const r = spawnSync(process.execPath, ["-e", FETCH, JSON.stringify([method, url, body])], { encoding: "utf8", timeout: 30_000 });
  if (r.status !== 0 || !r.stdout) return { ok: false, error: r.stderr?.trim() || "request failed" };
  return JSON.parse(r.stdout) as HostResult;
}

let stdinBuf = "";
let stdinDone = false;
function readLineSync(): string | null {
  for (;;) {
    const nl = stdinBuf.indexOf("\n");
    if (nl >= 0) {
      const line = stdinBuf.slice(0, nl).replace(/\r$/, "");
      stdinBuf = stdinBuf.slice(nl + 1);
      return line;
    }
    if (stdinDone) {
      if (!stdinBuf) return null;
      const rest = stdinBuf;
      stdinBuf = "";
      return rest;
    }
    const chunk = Buffer.alloc(65536);
    let n = 0;
    try {
      n = readSync(0, chunk, 0, chunk.length, null);
    } catch (e: any) {
      if (e.code === "EAGAIN") continue;
      if (e.code === "EOF") n = 0;
      else throw e;
    }
    if (n === 0) stdinDone = true;
    else stdinBuf += chunk.toString("utf8", 0, n);
  }
}

export function nodeHost(opts: { deny?: Effect[]; write?: (s: string) => void } = {}): Host {
  const write = opts.write ?? ((s: string) => process.stdout.write(s));
  return {
    print: (s) => write(s + "\n"),
    readLine: readLineSync,
    readFile: (path) => {
      try {
        return { ok: true, value: readFileSync(path, "utf8") };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    },
    writeFile: (path, text) => {
      try {
        writeFileSync(path, text);
        return { ok: true, value: "" };
      } catch (e: any) {
        return { ok: false, error: e.message };
      }
    },
    httpGet: (url) => http("GET", url),
    httpPost: (url, body) => http("POST", url, body),
    now: () => Date.now(),
    sleep: (ms) => {
      if (ms > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    },
    random: () => Math.random(),
    denied: new Set(opts.deny ?? []),
  };
}
