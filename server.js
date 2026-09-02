#!/usr/bin/env node
/**
 * AoE4 数据枢纽 — 零依赖本地服务器
 *   1) 静态托管 public/
 *   2) /api/* 反向代理到 aoe4world.com，带内存缓存 + 请求合并
 * aoe4world 本身开了 CORS(*)，前端直连也可行；加这层是为了缓存与限流保护。
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT ? Number(process.env.PORT) : 5173;
const ROOT = path.join(__dirname, 'public');
const UPSTREAM = 'https://aoe4world.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 AoE4Hub/1.0';

/* ---------- 缓存：分级 TTL ---------- */
const cache = new Map();          // key -> { body, mime, expires }
const inflight = new Map();       // key -> Promise

function ttlFor(p) {
  if (p.includes('/summary')) return 12 * 3600e3;   // 已结束比赛，基本不变
  if (p.startsWith('/api/v0/stats/')) return 30 * 60e3;
  if (p.includes('/games')) return 60e3;            // 战绩列表
  return 2 * 60e3;                                  // 玩家/搜索
}

const deepGuard = {};
const sleep = ms => new Promise(r => setTimeout(r, ms));

function fetchUpstream(target) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(target); } catch (e) { return reject(new Error('bad url')); }
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json, text/html;q=0.9, */*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 25000
    }, res => {
      // 跟随重定向（最多 3 次）
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && deepGuard[target] !== 3) {
        deepGuard[target] = (deepGuard[target] || 0) + 1;
        res.resume();
        const next = new URL(res.headers.location, target).toString();
        return resolve(fetchUpstream(next));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks),
        type: (res.headers['content-type'] || 'application/json').split(';')[0]
      }));
    });
    req.on('timeout', () => req.destroy(new Error('upstream timeout')));
    req.on('error', reject);
    req.end();
  });
}

async function getCached(pathname) {
  const now = Date.now();
  const hit = cache.get(pathname);
  if (hit && hit.expires > now) return hit;

  if (!inflight.has(pathname)) {
    // 上游会限流（429），失败按退避重试
    const p = (async () => {
      let r = null;
      for (let i = 0; i < 3; i++) {
        r = await fetchUpstream(UPSTREAM + pathname);
        if (r.status === 429 || r.status >= 500) { await sleep(600 * (i + 1)); continue; }
        break;
      }
      const rec = { status: r.status, body: r.body, type: r.type, expires: Date.now() + ttlFor(pathname) };
      // 只缓存成功响应；body 上限 8MB
      if (r.status === 200 && r.body.length < 8 * 1024 * 1024) cache.set(pathname, rec);
      return rec;
    })().finally(() => inflight.delete(pathname));
    inflight.set(pathname, p);
  }
  return inflight.get(pathname);
}

/* ---------- 静态资源 ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.jpg': 'image/jpeg'
};

function serveStatic(req, res, pathname) {
  let file = path.join(ROOT, decodeURIComponent(pathname));
  if (pathname === '/' || pathname === '') file = path.join(ROOT, 'index.html');
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      // SPA 回退
      fs.readFile(path.join(ROOT, 'index.html'), (e2, buf) => {
        if (e2) { res.writeHead(404).end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME['.html'] }).end(buf);
      });
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------- 主服务 ---------- */
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);

  // 两组前缀，分别对应上游不同根路径：
  //   /apiv0/xxx  -> https://aoe4world.com/api/v0/xxx
  //   /api/xxx    -> https://aoe4world.com/xxx        （如复盘 summary）
  let target = null;
  if (u.pathname.startsWith('/apiv0/')) {
    target = '/api/v0/' + u.pathname.slice(7) + (u.search || '');
  } else if (u.pathname.startsWith('/api/')) {
    target = u.pathname.slice(4) + (u.search || '');
  }

  if (target) {
    try {
      const r = await getCached(target);
      // 404 也回传（summary 缺失是常态，前端要能识别）
      res.writeHead(r.status, {
        'Content-Type': r.type.includes('json') ? 'application/json; charset=utf-8' : r.type,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60',
        'X-Cache': r.expires && r.expires > Date.now() ? 'MISS' : 'HIT'
      });
      res.end(r.body);
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
    return;
  }

  if (u.pathname === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok'); return; }
  serveStatic(req, res, u.pathname);
});

server.listen(PORT, () => {
  console.log(`\n  ⚔️  AoE4 数据枢纽已启动`);
  console.log(`     http://localhost:${PORT}\n`);
});
