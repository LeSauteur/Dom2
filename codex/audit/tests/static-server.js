const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || process.cwd());
const port = Number(process.argv[3] || 8765);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8'
};

function send(response, status, body, type) {
  response.writeHead(status, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(body);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  let relative = decodeURIComponent(url.pathname);
  if (relative === '/') {
    relative = '/start.html';
  }
  const target = path.resolve(root, '.' + relative);
  if (!target.startsWith(root + path.sep) && target !== root) {
    send(response, 403, 'Forbidden');
    return;
  }
  fs.readFile(target, (error, data) => {
    if (error) {
      send(response, 404, 'Not found');
      return;
    }
    send(response, 200, data, types[path.extname(target).toLowerCase()]);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`audit static server listening on http://127.0.0.1:${port}/ from ${root}`);
});
