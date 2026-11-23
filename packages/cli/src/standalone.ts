/**
 * The runtime `canon build` inlines into every built file. The CLI's build bundles this entry
 * (with esbuild) into dist/runtime-standalone.js, a script that defines `__canonRuntime`.
 */
export { load, Runtime, runMain } from "@canon/runtime";
export { nodeHost } from "@canon/runtime/node";
