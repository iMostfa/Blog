// Minimal dependency-free static file server for the visual tests.
//
// Serves a built Zola site (a directory of static files) so Playwright can
// snapshot it. Using a read-only static server avoids `zola serve`, which
// copies assets at startup and fails against Bazel's read-only runfiles tree.
//
// Usage: node serve.mjs <root-dir> <port>
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, normalize, extname } from "node:path";

const root = process.argv[2];
const port = Number(process.argv[3] ?? 8765);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    // Confine to the served root; reject path traversal.
    let fp = normalize(join(root, pathname));
    if (!fp.startsWith(normalize(root))) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    let s = await stat(fp).catch(() => null);
    if (s && s.isDirectory()) {
      fp = join(fp, "index.html");
      s = await stat(fp).catch(() => null);
    }
    if (!s) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const body = await readFile(fp);
    res.writeHead(200, { "content-type": TYPES[extname(fp)] ?? "application/octet-stream" });
    res.end(body);
  } catch (err) {
    res.writeHead(500);
    res.end(String(err));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`static server: ${root} on http://127.0.0.1:${port}`);
});
