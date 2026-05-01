import { createServer } from "node:http";

const port = Number(process.env.PORT || 4010);

createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, service: "noecho-server", phase: "scaffold" }));
    return;
  }

  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("noecho self-hosted server scaffold\n");
}).listen(port, "127.0.0.1", () => {
  console.log(`noecho server scaffold listening at http://127.0.0.1:${port}`);
});
