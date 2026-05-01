import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "apps", "web");
const publicRoot = join(root, "public");
const port = Number(process.env.PORT || 3000);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function resolvePath(url) {
  const pathname = new URL(url, `http://localhost:${port}`).pathname;
  if (pathname === "/") return join(root, "index.html");
  if (pathname.startsWith("/public/")) return join(root, pathname);
  if (pathname === "/manifest.webmanifest" || pathname === "/sw.js") {
    return join(publicRoot, pathname.slice(1));
  }
  return join(root, normalize(pathname));
}

createServer((req, res) => {
  const filePath = resolvePath(req.url || "/");

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
    return;
  }

  res.writeHead(200, {
    "content-type": types[extname(filePath)] || "application/octet-stream"
  });
  createReadStream(filePath).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log(`noecho web scaffold listening at http://127.0.0.1:${port}`);
});
