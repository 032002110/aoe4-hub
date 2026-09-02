/* aoe4world API 封装
 *
 * 两种运行模式，自动探测：
 *   proxy  —— 本地/自建 Node 服务器（server.js）在跑，走 /apiv0 /api 代理，带缓存与限流保护
 *   direct —— GitHub Pages 等纯静态托管，浏览器直连 aoe4world（上游已开放 CORS: *）
 *
 * 探测方式：请求 /healthz，能拿到 200 说明有代理层。
 */
window.API = (function () {
  const UPSTREAM = 'https://aoe4world.com';
  let mode = null;                 // 'proxy' | 'direct'
  let modePromise = null;

  function detect() {
    if (modePromise) return modePromise;
    modePromise = fetch('healthz', { cache: 'no-store' })
      .then(r => { mode = r.ok && r.status === 200 ? 'proxy' : 'direct'; return mode; })
      .catch(() => { mode = 'direct'; return mode; })
      .finally(() => { modePromise = null; });
    return modePromise;
  }

  /** kind: 'v0' -> /api/v0/... ；'site' -> /... （如复盘 summary） */
  const urlOf = (kind, path) => mode === 'proxy'
    ? (kind === 'v0' ? '/apiv0' : '/api') + path
    : UPSTREAM + (kind === 'v0' ? '/api/v0' : '') + path;

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /** 带退避重试的请求；429/5xx 与网络错误会重试 */
  async function req(kind, path, { timeout = 25000, retries = 2 } = {}) {
    if (!mode) await detect();

    let lastErr = null;
    for (let i = 0; i <= retries; i++) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeout);
      try {
        const r = await fetch(urlOf(kind, path), {
          signal: ctl.signal,
          headers: { Accept: 'application/json' },
          mode: 'cors'
        });
        if (!r.ok) {
          // 上游会对重资源端点（如复盘 summary）限流，退避后重试
          if ((r.status === 429 || r.status >= 500) && i < retries) {
            lastErr = new Error(`上游返回 ${r.status}`);
            lastErr.status = r.status;
            await sleep(900 * (i + 1) + Math.random() * 400);
            continue;
          }
          const err = new Error(r.status === 429 ? '请求过于频繁，请稍后再试' : `上游返回 ${r.status}`);
          err.status = r.status;
          throw err;
        }
        const txt = await r.text();
        try { return JSON.parse(txt); }
        catch (e) { throw new Error('响应不是合法 JSON'); }
      } catch (e) {
        lastErr = e;
        if (i === retries) throw e;
        await sleep(900 * (i + 1) + Math.random() * 400);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr || new Error('请求失败');
  }

  const q = o => Object.entries(o || {})
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

  return {
    /** 当前运行模式，供 UI 显示 */
    mode: () => mode,
    isStatic: () => mode === 'direct',

    /** 某段位下各文明胜率 */
    civStats: (board = 'rm_solo', rankLevel = '') =>
      req('v0', `/stats/${encodeURIComponent(board)}/civilizations?${q({ rank_level: rankLevel })}`),

    /** 文明对位克制矩阵（23×23，仅 1v1 类有数据） */
    matchups: (board = 'rm_solo', rankLevel = '') =>
      req('v0', `/stats/${encodeURIComponent(board)}/matchups?${q({ rank_level: rankLevel })}`),

    /** 玩家搜索（支持模糊） */
    search: (query, exact = false) =>
      req('v0', `/players/search?${q({ query, exact: exact ? true : '' })}`),

    /**
     * 昵称搜索：精确匹配优先。
     * 上游模糊搜索结果极多（如 "peanut" 有 361 个），精确同名会被排到第一页之外，
     * 因此先用 exact=true 取出同名玩家置顶，再用模糊结果补全。
     * 返回 { players, exactCount, total }
     */
    searchSmart: async query => {
      const enc = encodeURIComponent(String(query).trim());
      let exactP = [], fuzzyP = [];
      try {
        const r = await req('v0', `/players/search?query=${enc}&exact=true`);
        exactP = r.players || [];
      } catch (e) { /* 精确失败不阻断 */ }
      try {
        const r = await req('v0', `/players/search?query=${enc}`);
        fuzzyP = r.players || [];
      } catch (e) {
        if (!exactP.length) throw e;   // 两次都失败才有必要抛错
      }
      const seen = new Set(), list = [];
      for (const p of exactP) { seen.add(p.profile_id); list.push(p); }
      for (const p of fuzzyP) if (!seen.has(p.profile_id)) list.push(p);
      return { players: list, exactCount: exactP.length, total: list.length };
    },

    /** 玩家档案 */
    player: id => req('v0', `/players/${encodeURIComponent(id)}`),

    /** 玩家战绩 */
    games: (id, o = {}) =>
      req('v0', `/players/${encodeURIComponent(id)}/games?${q({ limit: o.limit || 25, offset: o.offset || 0, leaderboard: o.leaderboard })}`),

    /** 天梯榜 */
    leaderboard: (board = 'rm_solo', limit = 50) =>
      req('v0', `/leaderboards/${encodeURIComponent(board)}?${q({ limit })}`),

    /** 单场复盘（经济 / 出兵）—— 需要 profileId + gameId */
    summary: (profileId, gameId) =>
      req('site', `/players/${encodeURIComponent(profileId)}/games/${encodeURIComponent(gameId)}/summary?camelize=true`)
  };
})();
