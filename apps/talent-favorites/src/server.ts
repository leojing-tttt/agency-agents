import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(APP_ROOT, "public");
const PORT = Number(process.env.PORT || 4174);
const HOST = process.env.HOST || "127.0.0.1";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function notFound(res: http.ServerResponse) {
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("not found");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const rel = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.resolve(PUBLIC_DIR, `.${rel}`);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== PUBLIC_DIR) {
    res.writeHead(403).end();
    return;
  }
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { "content-type": TYPES[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    notFound(res);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`talent-favorites http://${HOST}:${PORT}`);
});
