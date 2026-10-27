// Раздает файлы этой папки на 127.0.0.1:3031 с CORS - для сверщика cmp.mjs в странице
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const dir = import.meta.dirname;
const types = { ".mjs": "text/javascript", ".js": "text/javascript", ".json": "application/json", ".html": "text/html; charset=utf-8" };
http
  .createServer((req, res) => {
    const file = path.join(dir, path.basename(decodeURIComponent(req.url.split("?")[0])));
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");
    if (!fs.existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  })
  .listen(3031, "127.0.0.1", () => console.log("serving on 3031"));
