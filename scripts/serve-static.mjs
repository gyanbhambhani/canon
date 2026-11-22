// Serve apps/web/out (the static export) for the Playwright smoke test. Usage: node scripts/serve-static.mjs [port]
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..", "apps", "web", "out");
const port = Number(process.argv[2] ?? 4173);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".map": "application/json",
};

function resolve(url) {
  const path = normalize(decodeURIComponent(url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  for (const c of [path, `${path}.html`, join(path, "index.html")]) {
    const f = join(root, c);
    if (f.startsWith(root) && existsSync(f) && statSync(f).isFile()) return f;
  }
  return null;
}

createServer((req, res) => {
  const f = resolve(req.url ?? "/");
  if (!f) {
    res.writeHead(404, { "Content-Type": "text/html" });
    res.end(existsSync(join(root, "404.html")) ? readFileSync(join(root, "404.html")) : "not found");
    return;
  }
  const type = TYPES[extname(f)] ?? "application/octet-stream";
  const body = readFileSync(f);
  // compress text like a production CDN would
  if (/text|javascript|json|svg/.test(type) && /gzip/.test(req.headers["accept-encoding"] ?? "")) {
    res.writeHead(200, { "Content-Type": type, "Content-Encoding": "gzip", "Cache-Control": "public, max-age=3600" });
    res.end(gzipSync(body));
    return;
  }
  res.writeHead(200, { "Content-Type": type });
  res.end(body);
}).listen(port, "127.0.0.1", () => console.log(`serving ${root} on http://127.0.0.1:${port}`));
