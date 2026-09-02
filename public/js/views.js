/* 视图渲染层 */
window.Views = (function () {
  const D = window.AOE4, C = window.Charts;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n0 = v => (v == null || isNaN(v)) ? '—' : Math.round(v).toLocaleString('en-US');
  const n1 = v => (v == null || isNaN(v)) ? '—' : v.toFixed(1);
  const dur = s => {
    if (s == null || isNaN(s)) return '—';
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return `${m}:${String(ss).padStart(2, '0')}`;
  };
  const ago = iso => {
    if (!iso) return '—';
    const d = new Date(iso), diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
    return d.toLocaleDateString('zh-CN');
  };
  const flag = c => c && c.length === 2
    ? String.fromCodePoint(...c.toUpperCase().split('').map(x => 127397 + x.charCodeAt(0))) : '';

  function civImg(id, cls = 'civ-ico') {
    const ic = D.civIcon(id);
    return ic
      ? `<img class="${cls}" src="${ic}" alt="" loading="lazy" onerror="this.outerHTML='<span class=\\'${cls} fb\\' style=\\'background:${D.civColor(id)}\\'>${esc(D.civName(id)[0])}</span>'">`
      : `<span class="${cls} fb" style="background:${D.civColor(id)}">${esc(D.civName(id)[0])}</span>`;
  }
  const loading = t => `<div class="loading"><div class="spinner"></div>${esc(t || '加载中')}…</div>`;

  /* ==================== 1. 文明胜率 ==================== */
  let civState = { board: 'rm_solo', rank: '', sort: 'win_rate', data: null };

  async function renderCivs(host) {
    const ranked = D.boardRanked(D.STATS_BOARDS, civState.board);
    if (!ranked) civState.rank = '';
    host.innerHTML = `
      <div class="page-head">
        <h1>文明胜率 · 分段位统计</h1>
        <p>不同段位下各文明的胜率、选用率与平均时长。数据来自 aoe4world 全量对局采样。</p>
      </div>
      <div class="ctrl-row">
        <div class="ctrl-group"><span class="ctrl-label">对战模式</span>
          <div class="seg" id="segBoard">${D.STATS_BOARDS.map(b =>
            `<button data-b="${b.id}" class="${b.id === civState.board ? 'on' : ''}">${b.zh}</button>`).join('')}</div>
        </div>
        ${ranked
          ? `<div class="ctrl-group"><span class="ctrl-label">段位</span>
              <div class="seg" id="segRank">${D.RANKS.map(r =>
                `<button data-r="${r.id}" class="${r.id === civState.rank ? 'on' : ''}">${r.zh}</button>`).join('')}</div>
            </div>`
          : `<div class="ctrl-group"><span class="ctrl-label">段位</span>
              <span class="pill" title="快速匹配模式上游不区分段位，段位筛选不可用">不分档</span></div>`}
        <div class="ctrl-group"><span class="ctrl-label">排序</span>
          <div class="seg" id="segSort">
            <button data-s="win_rate" class="${civState.sort === 'win_rate' ? 'on' : ''}">按胜率</button>
            <button data-s="pick_rate" class="${civState.sort === 'pick_rate' ? 'on' : ''}">按选用率</button>
            <button data-s="games_count" class="${civState.sort === 'games_count' ? 'on' : ''}">按场次</button>
          </div>
        </div>
      </div>
      <div id="civBody">${loading('拉取文明统计')}</div>`;

    host.querySelector('#segBoard').onclick = e => {
      const b = e.target.dataset.b; if (!b) return;
      civState.board = b; renderCivs(host);
    };
    if (host.querySelector('#segRank')) host.querySelector('#segRank').onclick = e => {
      const r = e.target.dataset.r; if (r === undefined) return;
      civState.rank = r; civState.data = null; renderCivs(host);
    };
    host.querySelector('#segSort').onclick = e => {
      const s = e.target.dataset.s; if (!s) return;
      civState.sort = s; paintCivs(host);
    };

    if (!civState.data) {
      try {
        civState.data = await window.API.civStats(civState.board, civState.rank);
      } catch (e) {
        host.querySelector('#civBody').innerHTML = `<div class="err">拉取失败：${esc(e.message)}</div>`;
        return;
      }
    }
    paintCivs(host);
  }

  function paintCivs(host) {
    const d = civState.data;
    const rows = [...(d.data || [])].sort((a, b) => (b[civState.sort] || 0) - (a[civState.sort] || 0));
    const rankZh = (D.RANKS.find(r => r.id === civState.rank) || {}).zh || '全部段位';
    const boardZh = (D.STATS_BOARDS.find(b => b.id === civState.board) || {}).zh || '';
    const total = rows.reduce((s, r) => s + r.games_count, 0);
    const avgWr = rows.reduce((s, r) => s + r.win_rate * r.games_count, 0) / (total || 1);
    const maxPick = Math.max(...rows.map(r => r.pick_rate), .01);

    host.querySelector('#civBody').innerHTML = `
      <div class="stat-grid" style="margin-bottom:14px">
        <div class="stat"><b>${n0(total)}</b><span>样本对局</span></div>
        <div class="stat"><b>${n1(avgWr)}%</b><span>平均胜率</span></div>
        <div class="stat"><b>${rows.length}</b><span>文明数量</span></div>
        <div class="stat"><b>${esc(rankZh)}</b><span>段位筛选</span></div>
        <div class="stat"><b>${esc(boardZh)}</b><span>对战模式</span></div>
      </div>
      <div class="card" style="padding:6px 16px 10px">
        <table class="civ-table">
          <thead><tr>
            <th>文明</th>
            <th class="${civState.sort === 'win_rate' ? 'sorted' : ''}" data-s="win_rate">胜率</th>
            <th class="${civState.sort === 'pick_rate' ? 'sorted' : ''}" data-s="pick_rate">选用率</th>
            <th class="${civState.sort === 'games_count' ? 'sorted' : ''}" data-s="games_count">对局数</th>
            <th>时长中位数</th>
            <th>胜场</th>
          </tr></thead>
          <tbody>${rows.map(r => {
            const wr = r.win_rate, delta = wr - 50;
            const left = delta < 0 ? 50 + delta : 50, w = Math.abs(delta);
            const col = wr >= 52 ? '#4ade80' : wr <= 48 ? '#f87171' : '#9aa5b1';
            return `<tr title="${esc(D.civName(r.civilization))} · 平均时长 ${dur(r.duration_average)}">
              <td><div class="civ-cell">${civImg(r.civilization)}
                <div><div class="civ-zh">${esc(D.civName(r.civilization))}</div>
                <div class="civ-en">${esc(r.civilization)}</div></div></div></td>
              <td><div class="wr">
                <div class="wr-track"></div><div class="wr-zero"></div>
                <div class="wr-fill" style="left:${left}%;width:${w}%;background:${col}"></div>
                <div class="wr-txt" style="color:${col}">${n1(wr)}%</div></div></td>
              <td>${n1(r.pick_rate)}%
                <div style="height:3px;margin-top:3px;background:rgba(255,255,255,.07);border-radius:2px">
                  <div style="height:3px;width:${(r.pick_rate / maxPick * 100).toFixed(1)}%;background:${D.civColor(r.civilization)};border-radius:2px"></div></div></td>
              <td>${n0(r.games_count)}</td>
              <td>${dur(r.duration_median)}</td>
              <td>${n0(r.win_count)}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
      <div class="tiny muted" style="margin-top:9px">
        口径：${esc(boardZh)} · ${esc(rankZh)}${d.rating ? `（Rating ${esc(d.rating)}）` : ''} · 游戏版本 ${esc(d.patch || '—')}。虚线为 50% 平衡基准线。
      </div>`;

    host.querySelectorAll('.civ-table th[data-s]').forEach(th => {
      th.onclick = () => { civState.sort = th.dataset.s; paintCivs(host); };
    });
  }

  /* ==================== 1b. 文明克制矩阵 ==================== */
  let muState = { board: 'rm_solo', rank: '', minN: 30, data: null, sel: null };

  async function renderMatchups(host) {
    const ranked = D.boardRanked(D.MATCHUP_BOARDS, muState.board);
    if (!ranked) muState.rank = '';
    host.innerHTML = `
      <div class="page-head">
        <h1>文明克制关系</h1>
        <p>行 = 你使用的文明，列 = 对手文明，格子是你在这个对位下的胜率。点击任意行查看完整对位明细。</p>
      </div>
      <div class="ctrl-row">
        <div class="ctrl-group"><span class="ctrl-label">对战模式</span>
          <div class="seg" id="muBoard">${D.MATCHUP_BOARDS.map(b =>
            `<button data-b="${b.id}" class="${b.id === muState.board ? 'on' : ''}">${b.zh}</button>`).join('')}</div>
        </div>
        ${ranked
          ? `<div class="ctrl-group"><span class="ctrl-label">段位</span>
              <div class="seg" id="muRank">${D.RANKS.map(r =>
                `<button data-r="${r.id}" class="${r.id === muState.rank ? 'on' : ''}">${r.zh}</button>`).join('')}</div>
            </div>`
          : `<div class="ctrl-group"><span class="ctrl-label">段位</span>
              <span class="pill" title="快速匹配模式上游不区分段位">不分档</span></div>`}
        <div class="ctrl-group"><span class="ctrl-label">最少样本</span>
          <div class="seg" id="muMin">
            ${[[0, '不限场次'], [30, '≥30 场'], [100, '≥100 场']].map(([v, t]) =>
              `<button data-m="${v}" class="${Number(v) === muState.minN ? 'on' : ''}">${t}</button>`).join('')}
          </div>
        </div>
      </div>
      <div id="muBody">${loading('拉取 23×23 对位矩阵')}</div>`;

    host.querySelector('#muBoard').onclick = e => {
      const b = e.target.dataset.b; if (!b) return;
      muState.board = b; muState.data = null; muState.sel = null; renderMatchups(host);
    };
    if (host.querySelector('#muRank')) host.querySelector('#muRank').onclick = e => {
      const r = e.target.dataset.r; if (r === undefined) return;
      muState.rank = r; muState.data = null; muState.sel = null; renderMatchups(host);
    };
    host.querySelector('#muMin').onclick = e => {
      const m = e.target.dataset.m; if (m === undefined) return;
      muState.minN = Number(m); paintMatchups(host);
    };

    if (!muState.data) {
      try { muState.data = await window.API.matchups(muState.board, muState.rank); }
      catch (e) {
        host.querySelector('#muBody').innerHTML = `<div class="err">拉取失败：${esc(e.message)}</div>`;
        return;
      }
    }
    paintMatchups(host);
  }

  function paintMatchups(host) {
    const d = muState.data, minN = muState.minN;
    const rows = d.data || [];

    // 索引：civ|other -> row
    const map = new Map();
    rows.forEach(r => map.set(r.civilization + '|' + r.other_civilization, r));

    // 文明列表 + 平均胜率（排除镜像），按平均胜率排序，方便强弱相邻比较
    const civs = [...new Set(rows.map(r => r.civilization))];
    const avg = c => {
      const list = rows.filter(r => r.civilization === c && r.other_civilization !== c && r.games_count >= minN);
      if (!list.length) return 50;
      return list.reduce((s, r) => s + r.win_rate * r.games_count, 0) / list.reduce((s, r) => s + r.games_count, 0);
    };
    const order = civs.slice().sort((a, b) => avg(b) - avg(a));

    if (!muState.sel || !order.includes(muState.sel)) muState.sel = order[0];

    const cell = (a, b) => {
      const r = map.get(a + '|' + b);
      if (!r) return `<td class="mx-na"></td>`;
      const n = r.games_count, wr = r.win_rate;
      if (n < minN) return `<td class="mx-low" title="样本不足（${n0(n)} 场）">·</td>`;
      const delta = wr - 50;
      const a_ = Math.min(.74, Math.abs(delta) / 22);
      const bg = Math.abs(delta) < 2
        ? 'rgba(255,255,255,.07)'
        : `rgba(${delta > 0 ? '74,222,128' : '248,113,113'},${a_.toFixed(2)})`;
      const isSel = a === muState.sel;
      return `<td class="mx-c${isSel ? ' sel-row' : ''}" style="background:${bg}"
        title="${esc(D.civName(a))} vs ${esc(D.civName(b))}：${n1(wr)}%（${n0(r.win_count)}胜 / ${n0(n)}场，中位时长 ${dur(r.duration_median)}）">
        <span style="color:${Math.abs(delta) < 2 ? 'var(--tx2)' : '#fff'}">${Math.round(wr)}</span></td>`;
    };

    const headRow = `<tr><th class="mx-corner"><span class="tiny muted">我方 ↓ / 对手 →</span></th>${
      order.map(c => `<th class="mx-ch" title="${esc(D.civName(c))}">${civImg(c, 'mx-ico')}</th>`).join('')}</tr>`;

    const bodyRows = order.map(a => `<tr class="${a === muState.sel ? 'sel' : ''}" data-civ="${a}">
      <th class="mx-rh" title="平均对位胜率 ${n1(avg(a))}%">
        ${civImg(a, 'mx-ico')}<span class="mx-rn">${esc(D.civName(a))}</span>
        <span class="mx-av">${n1(avg(a))}</span></th>
      ${order.map(b => cell(a, b)).join('')}</tr>`).join('');

    const selRows = order.filter(b => b !== muState.sel)
      .map(b => map.get(muState.sel + '|' + b)).filter(r => r && r.games_count >= minN)
      .sort((a, b) => b.win_rate - a.win_rate);

    const best = selRows.slice(0, 6), worst = selRows.slice(-6).reverse();
    const barData = list => list.map(r => ({
      label: D.civName(r.other_civilization), value: r.win_rate,
      color: r.win_rate >= 52 ? '#4ade80' : r.win_rate <= 48 ? '#f87171' : '#9aa5b1',
      sub: `${n1(r.win_rate)}%`, meta: `${n0(r.games_count)} 场`, max: 100
    }));

    host.querySelector('#muBody').innerHTML = `
      <div class="stat-grid" style="margin-bottom:14px">
        <div class="stat"><b>${civs.length}×${civs.length}</b><span>对位组合</span></div>
        <div class="stat"><b>${n0(rows.reduce((s, r) => s + r.games_count, 0))}</b><span>样本对局</span></div>
        <div class="stat"><b>${n1(rows.filter(r => r.civilization !== r.other_civilization)
          .reduce((s, r) => s + r.win_rate * r.games_count, 0) /
          rows.filter(r => r.civilization !== r.other_civilization)
            .reduce((s, r) => s + r.games_count, 0))}%</b><span>平均胜率</span></div>
        <div class="stat"><b>${esc((D.RANKS.find(r => r.id === muState.rank) || {}).zh || '全部段位')}</b><span>段位</span></div>
      </div>

      <div class="card" style="padding:12px">
        <div class="mx-wrap"><table class="mx">
          <thead>${headRow}</thead>
          <tbody>${bodyRows}</tbody>
        </table></div>
        <div class="mx-legend">
          <span class="lg"><i style="background:rgba(248,113,113,.7)"></i>劣势 &lt;48%</span>
          <span class="lg"><i style="background:rgba(255,255,255,.18)"></i>均势 48–52%</span>
          <span class="lg"><i style="background:rgba(74,222,128,.7)"></i>优势 &gt;52%</span>
          <span class="lg"><i style="background:rgba(255,255,255,.04)"></i>· 样本不足</span>
        </div>
      </div>

      <div class="card"><h3>${civImg(muState.sel, 'civ-ico')} ${esc(D.civName(muState.sel))} 的完整对位</h3>
        <div class="grid2">
          <div><div class="sub-h">✅ 最好打的对位</div>
            ${best.length ? C.bars(barData(best), { max: 100, labelW: 104 }) : '<div class="chart-empty">样本不足</div>'}</div>
          <div><div class="sub-h">⚠️ 最难打的对位</div>
            ${worst.length ? C.bars(barData(worst), { max: 100, labelW: 104 }) : '<div class="chart-empty">样本不足</div>'}</div>
        </div>
        <div class="sub-h">全部对位明细（按胜率排序，共 ${selRows.length} 个有效对位）</div>
        <div style="overflow-x:auto"><table class="civ-table">
          <thead><tr><th>对手文明</th><th>胜率</th><th>场次</th><th>胜负</th><th>时长中位数</th></tr></thead>
          <tbody>${selRows.map(r => `<tr>
            <td><div class="civ-cell">${civImg(r.other_civilization)}<span class="civ-zh">${esc(D.civName(r.other_civilization))}</span></div></td>
            <td style="color:${r.win_rate >= 52 ? 'var(--win)' : r.win_rate <= 48 ? 'var(--loss)' : 'var(--tx2)'};font-weight:700">${n1(r.win_rate)}%</td>
            <td>${n0(r.games_count)}</td>
            <td>${n0(r.win_count)} 胜 / ${n0(r.games_count - r.win_count)} 负</td>
            <td>${dur(r.duration_median)}</td>
          </tr>`).join('')}</tbody></table></div>
      </div>
      <div class="tiny muted" style="margin-top:9px">
        口径：${esc((D.MATCHUP_BOARDS.find(b => b.id === muState.board) || {}).zh)}${
          d.rating ? `（Rating ${esc(d.rating)}）` : ranked ? '' : '（快速匹配不区分段位）'} · 版本 ${esc(d.patch || '—')}。
        行按平均对位胜率排序；对角线为镜像对局，固定 50%。${minN ? `已过滤样本少于 ${minN} 场的对位。` : '未过滤样本量，冷门对位仅供参考。'}
      </div>`;

    host.querySelectorAll('.mx tbody tr[data-civ]').forEach(tr => {
      tr.onclick = () => { muState.sel = tr.dataset.civ; paintMatchups(host); };
    });
  }

  /* ==================== 2. 玩家查询（搜索页） ==================== */
  async function renderPlayers(host, preset) {
    host.innerHTML = `
      <div class="page-head">
        <h1>玩家查询</h1>
        <p>输入昵称或 Profile ID 查看排名、场次、胜率与近期战绩，点击任意一场即可复盘。</p>
      </div>
      <div class="card" style="padding:14px">
        <form id="pForm" style="display:flex;gap:9px;flex-wrap:wrap">
          <input id="pInput" type="search" placeholder="例如：VortiX / Beastyqt / 60328" autocomplete="off"
            style="flex:1;min-width:200px;height:38px;padding:0 13px;border-radius:var(--r2);background:var(--bg2);border:1px solid var(--line);color:var(--tx);font-size:14px;outline:none"
            value="${esc(preset || '')}">
          <button class="btn primary" type="submit" style="height:38px">查询</button>
        </form>
        <div id="pResults" style="margin-top:12px"></div>
      </div>
      <div class="card" style="padding:14px">
        <h3 style="margin-bottom:10px">天梯前列（1v1）</h3>
        <div id="topList">${loading()}</div>
      </div>`;

    const form = host.querySelector('#pForm'), input = host.querySelector('#pInput');
    form.onsubmit = e => { e.preventDefault(); doSearch(host, input.value.trim()); };
    if (preset) doSearch(host, preset);
    input.focus();

    try {
      const lb = await window.API.leaderboard('rm_solo', 20);
      host.querySelector('#topList').innerHTML = renderPlayerList(lb.players || []);
    } catch (e) {
      host.querySelector('#topList').innerHTML = `<div class="err">天梯拉取失败：${esc(e.message)}</div>`;
    }
  }

  async function doSearch(host, q) {
    if (!q) return;
    const box = host.querySelector('#pResults');
    box.innerHTML = loading('搜索玩家');
    try {
      const r = await window.API.search(q);
      const list = r.players || [];
      box.innerHTML = list.length
        ? `<div class="match-list">${list.map(p => playerRow(p)).join('')}</div>`
        : `<div class="empty"><b>没有找到「${esc(q)}」</b>试试更短的关键词，或直接用 Profile ID</div>`;
      bindPlayerRows(box);
    } catch (e) {
      box.innerHTML = `<div class="err">搜索失败：${esc(e.message)}</div>`;
    }
  }

  function renderPlayerList(list) {
    return `<div class="match-list">${list.map(p => playerRow(p)).join('')}</div>`;
  }

  function playerRow(p) {
    const lb = p.leaderboards || {};
    const mode = lb.rm_solo || {};
    const rated = mode.rank_level && mode.rank_level !== 'unranked';
    return `<div class="match-row" data-pid="${p.profile_id}" style="grid-template-columns:auto 1fr auto">
      ${p.avatars && p.avatars.small
        ? `<img src="${p.avatars.small}" style="width:36px;height:36px;border-radius:9px;object-fit:cover" onerror="this.style.visibility='hidden'">`
        : `<div style="width:36px;height:36px;border-radius:9px;background:var(--bg2)"></div>`}
      <div class="mr-mid">
        <div class="mr-civs" style="margin-bottom:2px">
          <span class="civ-zh">${esc(p.name)}</span>
          ${p.country ? `<span class="flag">${flag(p.country)}</span>` : ''}
          ${rated ? `<span class="tag rank" style="color:${D.rankColor(mode.rank_level)}">${esc(D.rankLabel(mode.rank_level))}</span>` : ''}
        </div>
        <div class="mr-info">
          <span>ID ${esc(p.profile_id)}</span>
          ${mode.rating ? `<span>Rating ${n0(mode.rating)}</span>` : ''}
          ${mode.rank ? `<span>#${n0(mode.rank)}</span>` : ''}
          ${mode.games_count ? `<span>${n0(mode.games_count)} 场 · 胜率 ${n1(mode.win_rate)}%</span>` : ''}
        </div>
      </div>
      <div class="mr-right"><span class="pill">查看 →</span></div>
    </div>`;
  }

  function bindPlayerRows(root) {
    root.querySelectorAll('.match-row[data-pid]').forEach(el => {
      el.onclick = () => { location.hash = `#/player/${el.dataset.pid}`; };
    });
  }

  /* ==================== 3. 玩家详情 ==================== */
  let pState = { id: null, data: null, games: null, lb: '' };
  let _games = [];   // 供复盘弹窗取 rating / 录像地址

  async function renderPlayer(host, id) {
    if (pState.id !== id) { pState = { id, data: null, games: null, lb: '' }; }
    host.innerHTML = `<div class="page-head"><h1>玩家档案</h1></div><div id="pBody">${loading('加载玩家数据')}</div>`;
    try {
      if (!pState.data) pState.data = await window.API.player(id);
    } catch (e) {
      host.querySelector('#pBody').innerHTML = `<div class="err">加载失败：${esc(e.message)}</div>`;
      return;
    }
    const p = pState.data;
    host.querySelector('.page-head').innerHTML =
      `<h1>${esc(p.name)}</h1><p>Profile ${esc(p.profile_id)}${p.country ? ` · ${flag(p.country)} ${esc(p.country.toUpperCase())}` : ''}</p>`;

    const body = host.querySelector('#pBody');
    body.innerHTML = hero(p) + `<div id="modeWrap"></div><div id="gameWrap">${loading('加载近期战绩')}</div>`;
    renderModes(p);
    loadGames(host, id);
    bindPlayerRows(body);
  }

  function hero(p) {
    const solo = (p.modes || {}).rm_solo || {};
    const rated = solo.rank_level && solo.rank_level !== 'unranked';
    const s = p.social || {};
    const links = [
      s.twitch && `<a href="${esc(s.twitch)}" target="_blank" rel="noopener">Twitch</a>`,
      s.youtube && `<a href="${esc(s.youtube)}" target="_blank" rel="noopener">YouTube</a>`,
      s.twitter && `<a href="${esc(s.twitter)}" target="_blank" rel="noopener">X</a>`,
      s.liquipedia && `<a href="${esc(s.liquipedia)}" target="_blank" rel="noopener">Liquipedia</a>`,
      p.site_url && `<a href="${esc(p.site_url)}" target="_blank" rel="noopener">aoe4world</a>`
    ].filter(Boolean).join('');
    return `<div class="player-hero">
      ${p.avatars && p.avatars.medium
        ? `<img class="avatar" src="${p.avatars.medium}" onerror="this.style.visibility='hidden'">` : ''}
      <div style="min-width:0">
        <h2 class="p-name">${esc(p.name)}
          ${p.country ? `<span class="flag">${flag(p.country)}</span>` : ''}
          ${rated ? `<span class="tag rank" style="color:${D.rankColor(solo.rank_level)}">${esc(D.rankLabel(solo.rank_level))}</span>` : ''}
          ${solo.rank ? `<span class="tag">#${n0(solo.rank)}</span>` : ''}
        </h2>
        <div class="p-meta">
          <span>Profile ${esc(p.profile_id)}</span>
          ${solo.games_count ? `<span>本季 ${n0(solo.games_count)} 场</span>` : ''}
          ${solo.win_rate != null ? `<span>胜率 ${n1(solo.win_rate)}%</span>` : ''}
          ${solo.streak ? `<span class="${solo.streak > 0 ? 'streak-w' : 'streak-l'}">连${solo.streak > 0 ? '胜' : '败'} ${Math.abs(solo.streak)}</span>` : ''}
        </div>
        ${links ? `<div class="socials">${links}</div>` : ''}
      </div>
    </div>`;
  }

  function renderModes(p) {
    const modes = p.modes || {};
    const cards = [];

    // 赛季制模式
    ['rm_solo', 'rm_team'].forEach(k => {
      const m = modes[k]; if (!m) return;
      const lvl = m.rank_level;
      cards.push(`<div class="mode-card">
        <div class="mc-top"><span class="mc-name">${esc((D.MODES.find(b => b.id === k) || {}).zh || k)}</span>
          ${m.rank ? `<span class="tiny muted">#${n0(m.rank)}</span>` : ''}</div>
        <div class="mc-rating" style="color:${D.rankColor(lvl)}">${esc(D.rankLabel(lvl))}</div>
        <div class="mc-sub">第 ${m.season ?? '—'} 赛季${m.wins_count != null ? ` · ${m.wins_count}胜 ${m.losses_count}负` : ''}</div>
        <div class="mc-stats">
          <div class="mc-stat"><b>${n0(m.games_count)}</b><span>场次</span></div>
          <div class="mc-stat"><b>${m.win_rate != null ? n1(m.win_rate) + '%' : '—'}</b><span>胜率</span></div>
          <div class="mc-stat"><b class="${m.streak > 0 ? 'streak-w' : m.streak < 0 ? 'streak-l' : ''}">${m.streak || 0}</b><span>连胜</span></div>
        </div>
      </div>`);
    });

    // ELO 模式（带 rating 与历史曲线）
    ['rm_1v1_elo', 'rm_2v2_elo', 'rm_3v3_elo', 'qm_1v1'].forEach(k => {
      const m = modes[k]; if (!m || !m.games_count) return;
      const zh = (D.MODES.find(x => x.id === k) || {}).zh || k;
      const rh = m.rating_history || {};
      const pts = Object.keys(rh).map(t => ({ x: Number(t), y: rh[t].rating })).sort((a, b) => a.x - b.x);
      cards.push(`<div class="mode-card elo">
        <div class="mc-top"><span class="mc-name">${esc(zh)}</span>
          ${m.rank ? `<span class="tiny muted">#${n0(m.rank)}</span>` : ''}</div>
        <div class="mc-rating">${n0(m.rating)}${m.max_rating ? `<span style="font-size:12px;color:var(--tx3);font-weight:500"> / 峰 ${n0(m.max_rating)}</span>` : ''}</div>
        <div class="mc-sub">${esc(D.rankLabel(m.rank_level))} · ${m.last_game_at ? ago(m.last_game_at) : '—'}</div>
        <div class="mc-stats">
          <div class="mc-stat"><b>${n0(m.games_count)}</b><span>场次</span></div>
          <div class="mc-stat"><b>${m.win_rate != null ? n1(m.win_rate) + '%' : '—'}</b><span>胜率</span></div>
          <div class="mc-stat"><b class="${m.streak > 0 ? 'streak-w' : m.streak < 0 ? 'streak-l' : ''}">${m.streak || 0}</b><span>连胜</span></div>
        </div>
        ${pts.length > 1 ? `<div style="margin-top:9px">${C.line(
          [{ name: 'Rating', color: D.rankColor(m.rank_level), points: pts, fill: true }],
          { h: 52, pad: { t: 6, r: 4, b: 4, l: 32 }, fmtY: v => Math.round(v), fmtX: () => '' })}</div>` : ''}
      </div>`);
    });

    const wrap = document.querySelector('#modeWrap');
    wrap.innerHTML = `<div class="card"><h3>天梯模式</h3>
      ${cards.length ? `<div class="mode-grid">${cards.join('')}</div>`
        : `<div class="empty" style="padding:22px">该玩家暂无排位数据</div>`}</div>`;

    // 常用文明 + 赛季历史
    const solo = modes.rm_solo || {};
    if (solo.civilizations && solo.civilizations.length) {
      const cs = [...solo.civilizations].sort((a, b) => b.games_count - a.games_count).slice(0, 8);
      wrap.innerHTML += `<div class="card"><h3>本季常用文明</h3><div class="match-list">${
        cs.map(c => `<div class="match-row" style="grid-template-columns:auto 1fr auto;cursor:default">
          ${civImg(c.civilization)}
          <div class="mr-mid"><div class="mr-civs"><span class="civ-zh">${esc(D.civName(c.civilization))}</span></div>
            <div class="mr-info"><span>${n0(c.games_count)} 场</span><span>选用率 ${n1(c.pick_rate)}%</span></div></div>
          <div class="mr-right"><b style="color:${c.win_rate >= 50 ? 'var(--win)' : 'var(--loss)'}">${n1(c.win_rate)}%</b></div>
        </div>`).join('')}</div></div>`;
    }

    if (solo.previous_seasons && solo.previous_seasons.length) {
      wrap.innerHTML += `<div class="card"><h3>赛季历史</h3>
        <div style="overflow-x:auto"><table class="civ-table">
          <thead><tr><th>赛季</th><th>段位</th><th>Rating</th><th>排名</th><th>场次</th><th>胜率</th></tr></thead>
          <tbody>${solo.previous_seasons.map(s => `<tr>
            <td>S${s.season}</td>
            <td><span class="tag rank" style="color:${D.rankColor(s.rank_level)}">${esc(D.rankLabel(s.rank_level))}</span></td>
            <td>${n0(s.rating)}</td><td>#${n0(s.rank)}</td>
            <td>${n0(s.games_count)}</td>
            <td style="color:${s.win_rate >= 50 ? 'var(--win)' : 'var(--loss)'}">${n1(s.win_rate)}%</td>
          </tr>`).join('')}</tbody></table></div></div>`;
    }
  }

  async function loadGames(host, id) {
    const wrap = document.querySelector('#gameWrap');
    wrap.innerHTML = loading('加载近期战绩');
    try {
      const g = await window.API.games(id, { limit: 30, leaderboard: pState.lb });
      pState.games = g;
      _games = g.games || [];
      paintGames(host, id, g);
    } catch (e) {
      wrap.innerHTML = `<div class="err">战绩加载失败：${esc(e.message)}</div>`;
    }
  }

  function paintGames(host, id, g) {
    const wrap = document.querySelector('#gameWrap');
    const games = g.games || [];
    const lbSel = `<div class="seg" id="segLb">
      ${D.GAME_FILTERS.map(x =>
        `<button data-lb="${x.id}" class="${pState.lb === x.id ? 'on' : ''}">${x.zh}</button>`).join('')}</div>`;

    wrap.innerHTML = `<div class="card">
      <h3 style="justify-content:space-between">近期战绩
        <span class="tiny muted" style="font-weight:400">共 ${n0(g.total_count)} 场 · 点击任意一局查看复盘</span></h3>
      <div class="ctrl-row" style="margin-bottom:12px">${lbSel}</div>
      <div class="match-list" id="mList">${games.length ? games.map(gm => matchRow(gm, id)).join('')
        : `<div class="empty"><b>暂无战绩</b>换个模式筛选试试</div>`}</div>
    </div>`;
    wrap.querySelector('#segLb').onclick = e => {
      if (e.target.dataset.lb === undefined) return;
      pState.lb = e.target.dataset.lb;
      loadGames(host, id);
    };
    bindMatches(wrap, id);
  }

  function matchRow(g, pid) {
    const teams = g.teams || [];
    const mine = teams.flat().find(p => String(p.profile_id) === String(pid)) || teams[0][0];
    const foes = teams.find(t => !t.some(p => String(p.profile_id) === String(pid))) || [];
    const foe = foes[0] || {};
    const win = mine.result === 'win';
    const rd = mine.rating_diff;
    const hasReplay = !!(mine.twitch_video_url || foe.twitch_video_url);
    return `<div class="match-row ${win ? 'win' : 'loss'}" data-gid="${g.game_id}" data-pid="${pid}">
      <div class="mr-res">${win ? '胜' : '负'}</div>
      <div class="mr-mid">
        <div class="mr-civs">
          ${civImg(mine.civilization, 'civ-ico')}
          <span>${esc(D.civName(mine.civilization))}</span>
          <span class="vs-x">VS</span>
          ${civImg(foe.civilization, 'civ-ico')}
          <span>${esc(D.civName(foe.civilization))}</span>
          ${foe.name ? `<span class="muted tiny">${esc(foe.name)}</span>` : ''}
        </div>
        <div class="mr-info">
          <span>${esc(g.map || '—')}</span>
          <span>${dur(g.duration)}</span>
          <span>${ago(g.started_at)}</span>
          ${g.kind ? `<span class="pill">${esc(g.kind.replace('rm_', '').replace('_', 'v'))}</span>` : ''}
        </div>
        ${hasReplay ? `<span class="replay-chip">▶ 有录像</span>` : ''}
      </div>
      <div class="mr-right">
        ${rd != null ? `<div class="mr-diff ${rd >= 0 ? 'up' : 'down'}">${rd >= 0 ? '+' : ''}${rd}</div>` : ''}
        ${mine.rating ? `<div class="tiny muted">${n0(mine.rating)}</div>` : ''}
      </div>
    </div>`;
  }

  function bindMatches(root, pid) {
    root.querySelectorAll('.match-row[data-gid]').forEach(el => {
      el.onclick = () => openMatch(pid, el.dataset.gid);
    });
  }

  /* ==================== 4. 天梯榜 ==================== */
  let lbState = { board: 'rm_solo', data: null };
  async function renderLadder(host) {
    host.innerHTML = `<div class="page-head"><h1>天梯榜</h1><p>当前赛季排名前列的选手。</p></div>
      <div class="ctrl-row"><div class="seg" id="segLbBoard">${D.LADDER_BOARDS.map(b =>
        `<button data-b="${b.id}" class="${b.id === lbState.board ? 'on' : ''}">${b.zh}</button>`).join('')}</div></div>
      <div id="lbBody">${loading()}</div>`;
    host.querySelector('#segLbBoard').onclick = e => {
      const b = e.target.dataset.b; if (!b) return;
      lbState.board = b; lbState.data = null; renderLadder(host);
    };
    try {
      if (!lbState.data) lbState.data = await window.API.leaderboard(lbState.board, 100);
      host.querySelector('#lbBody').innerHTML =
        `<div class="card" style="padding:10px 14px">${renderPlayerList(lbState.data.players || [])}</div>`;
      bindPlayerRows(host.querySelector('#lbBody'));
    } catch (e) {
      host.querySelector('#lbBody').innerHTML = `<div class="err">加载失败：${esc(e.message)}</div>`;
    }
  }

  return {
    renderCivs, renderMatchups, renderPlayers, renderPlayer, renderLadder,
    playerRow, bindPlayerRows,
    openMatch: (p, g) => window.Match.open(p, g),
    get __games() { return _games; }
  };
})();
