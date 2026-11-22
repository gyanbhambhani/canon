/// <reference lib="webworker" />
/** Runs compiled Canon in a Web Worker with the browser host (io, time, rand allowed; fs, net denied). */
import { browserHost, runMain } from "@canon/runtime";

self.onmessage = (ev: MessageEvent<{ js: string }>) => {
  const host = browserHost((line) => self.postMessage({ type: "print", line }));
  try {
    const result = runMain(ev.data.js, host);
    self.postMessage({ type: "done", result });
  } catch (e) {
    self.postMessage({ type: "crash", message: String((e as Error)?.message ?? e) });
  }
};
