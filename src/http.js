'use strict';

const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function sendJson(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req, limit) {
  const max = limit || (2 * 1024 * 1024);
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > max) { reject(new Error('请求体过大（上限 2MB）')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(new Error('请求体不是合法 JSON')); }
    });
    req.on('error', reject);
  });
}

async function serveStatic(res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); }
  catch (e) { rel = pathname; }
  if (rel === '/' || rel === '') rel = '/index.html';

  const target = path.resolve(PUBLIC_DIR, '.' + rel);
  if (target !== PUBLIC_DIR && !target.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  try {
    const st = await fs.stat(target);
    if (st.isFile()) {
      const body = await fs.readFile(target);
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
        'Content-Length': body.length,
        'Cache-Control': 'no-cache'
      });
      res.end(body);
      return;
    }
  } catch (e) { /* 落到 index.html */ }

  const idx = await fs.readFile(path.join(PUBLIC_DIR, 'index.html'));
  res.writeHead(200, { 'Content-Type': MIME['.html'], 'Content-Length': idx.length });
  res.end(idx);
}

function createServer(cfg, db, routes) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    if (url.pathname.indexOf('/api/') === 0) return routes(req, res, url);
    serveStatic(res, url.pathname).catch(err => {
      res.writeHead(500); res.end('Internal Server Error');
      console.error('静态资源出错：', err);
    });
  });
}

module.exports = { createServer, sendJson, readBody, serveStatic, PUBLIC_DIR };
