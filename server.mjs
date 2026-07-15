// Zero-dependency static file server for local development.
// Usage: npm start   (or: node server.mjs [port])
//
// The app must be served over HTTP (not opened as a file://) because the
// dc-runtime fetches ./support.js and ./ios-frame.js at runtime.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('.', import.meta.url).pathname;
const port = Number(process.argv[2]) || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.jsx': 'text/jsx; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/' || path === '') path = '/index.html';
    // Prevent path traversal outside the served root.
    const full = normalize(join(root, path));
    if (!full.startsWith(normalize(root))) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const info = await stat(full);
    if (info.isDirectory()) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const body = await readFile(full);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
});

server.listen(port, () => {
  console.log(`Click Publish running at http://localhost:${port}`);
});
