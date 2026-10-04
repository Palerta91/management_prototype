import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.EPSILON_PREVIEW_PORT ?? 4195);
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml' };
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let path = resolve(root, '.' + pathname);
    if (path !== root.slice(0,-1) && !path.startsWith(root.endsWith(sep) ? root : root + sep)) { response.writeHead(403); response.end(); return; }
    try { if (!(await stat(path)).isFile()) path = resolve(root, 'index.html'); }
    catch { if (pathname.startsWith('/assets/')) { response.writeHead(404); response.end(); return; } path = resolve(root, 'index.html'); }
    const body = await readFile(path);
    response.writeHead(200, { 'content-type':types[extname(path)] ?? 'application/octet-stream', 'cache-control':'no-store' });
    response.end(body);
  } catch { response.writeHead(500); response.end('Preview error'); }
}).listen(port, '127.0.0.1', () => console.log('ЭПСИЛОН preview: http://127.0.0.1:' + port));
