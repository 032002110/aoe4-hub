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

  async function req(kind, path, { timeout = 25000 } = {}) {
    if (!mode) await detect();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(urlOf(kind, path), {
        signal: ctl.signal,
        headers: { Accept: 'application/json' },
        mode: 'cors'
      });
      const txt = await r.text();
      if (!r.ok) {
        const err = new Error(`上游返回 ${r.status}`);
        err.status = r.status;
        throw err;
      }
      try { return JSON.parse(txt); }
      catch (e) { throw new Error('响应不是合法 JSON'); }
    } finally { clearTimeout(timer); }
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
