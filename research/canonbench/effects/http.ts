/**
 * The synchronous HTTP helper every TypeScript program imports as "./http". Node has no synchronous
 * standard HTTP client (fetch and http.request are asynchronous), so a synchronous codebase wraps
 * one; this reference implementation shells out to curl. Both functions return the response body
 * and throw on a transport error or a non-2xx status. In the sandbox, "./http" is mocked.
 */
import { execFileSync } from "node:child_process";

export function httpGet(url: string): string {
  return execFileSync("curl", ["--silent", "--show-error", "--fail", url], { encoding: "utf8" });
}

export function httpPost(url: string, body: string): string {
  return execFileSync("curl", ["--silent", "--show-error", "--fail", "--data-binary", "@-", url], { input: body, encoding: "utf8" });
}
