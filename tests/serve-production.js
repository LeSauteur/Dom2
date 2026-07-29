'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const appRoot = path.resolve(__dirname, '..', 'pub', 'domian-calculator-a4');
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${host}:${port}`);
  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(appRoot, relativePath);
  if (
    filePath !== appRoot
    && !filePath.startsWith(`${appRoot}${path.sep}`)
  ) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()]
        || 'application/octet-stream'
    });
    fs.createReadStream(filePath).pipe(response);
  });
});

server.listen(port, host, () => {
  console.log(`Serving ${appRoot}`);
  console.log(`http://${host}:${port}/`);
});
