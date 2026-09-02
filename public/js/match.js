/* 比赛复盘弹窗：回放 / 经济复盘 / 出兵贡献 / 时间轴 */
window.Match = (function () {
  const D = window.AOE4, C = window.Charts;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n0 = v => (v == null || isNaN(v)) ? '—' : Math.round(v).toLocaleString('en-US');
  const n1 = v => (v == null || isNaN(v)) ? '—' : v.toFixed(1);
  const dur = s => { if (s == null || isNaN(s)) return '—'; return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };

  let cur = { pid: null, gid: null, base: null, sum: null, tab: 'overview' };

  /* 与 views.js 相同：战绩列表接口把选手包在 player 字段里，单场接口是扁平的，统一取出 */
  const flatPlayers = teams => (teams || []).flat().map(p => (p && p.player) ? p.player : p).filter(Boolean);

  /* 建造序列 slug -> 中文（匹配时忽略尾部等级数字） */
  const EN_ZH = {
    villager: '村民', scout: '侦察兵', sheep: '羊', deer: '鹿', boar: '野猪',
    towncentrecapitol: '首都城镇中心', towncentre: '城镇中心', towncenter: '城镇中心',
    house: '房屋', gristmill: '磨坊', mill: '磨坊', lumbercamp: '伐木场',
    goldminingcamp: '金矿场', stoneminingcamp: '采石场', miningcamp: '采矿场',
    wheatfield: '农田', farm: '农田', barracks: '兵营', archeryrange: '靶场',
    stable: '马厩', blacksmith: '铁匠铺', market: '市场', monastery: '修道院',
    dock: '船坞', siegeworkshop: '攻城武器厂', university: '大学', keep: '城堡',
    palisadewall: '木栅栏', palisadegate: '木栅门', stonewall: '石墙',
    outpost: '哨塔', tower: '塔楼', wonder: '奇观',
    spearman: '长矛兵', archer: '弓箭手', horseman: '骑兵', manatarms: '武士',
    knight: '骑士', crossbowman: '弩手', handcannoneer: '火枪手',
    mangonel: '投石车', trebuchet: '投石机', springald: '弩炮', bombard: '火炮',
    monk: '僧侣', imam: '伊玛目', trader: '商人', fishingboat: '渔船',
    chevalierconfrere: '骑士团骑士', landsknecht: '国土佣仆',
    castle: '城堡', palace: '宫殿', mosque: '清真寺',
    wheelbarrow: '独轮车', safepassage: '安全通道',
    meleearmortechnology: '近战护甲', rangedarmortechnology: '远程护甲',
    meleedamagetechnology: '近战伤害', rangeddamagetechnology: '远程伤害',
    foodgather: '食物采集', woodgather: '木材采集', goldgather: '黄金采集',
    huntingvillager: '狩猎装备', textiles: '纺织', horticulture: '园艺',
    // 文明特色单位 / 建筑
    heavyspearman: '重装长矛兵', ironpagoda: '铁塔兵', pagoda: '宝塔',
    horsearcher: '弓骑兵', grasslands: '草原', steppe: '草原',
    emissary: '使节', shanhua: '善化寺', greatpasture: '大牧场',
    granary: '粮仓', zhugenu: '诸葛弩', nestofbees: '蜂巢炮',
    firelancer: '火枪骑兵', palaceguard: '禁卫军',
    camelrider: '骆驼骑兵', camelarcher: '骆驼弓手', ghulam: '古拉姆',
    towerwarelephant: '箭塔战象', warelephant: '战象', elephantrider: '战象骑兵',
    musofadigunner: '火枪手', musofadi: '火枪手', sofa: '索法',
    javelinthrower: '标枪兵', donso: '猎兵', warriorpriest: '战士祭司',
    hussitewagon: '胡斯战车', landsknecht: '国土佣仆', prelate: '主教',
    longbowman: '长弓手', kingsman: '王室卫队', menatarms: '武士'
  };
  function slugZh(icon) {
    if (!icon) return '单位';
    let s = icon.split('/').pop().toLowerCase();
    s = s.replace(/^civ_?icon_?(medium|large|small)?_?/i, '');       // 文明旗图标前缀
    s = s.replace(/^age[-_]?\d+[-_]?/i, '');                          // 前置时代标记 age3_shanhua
    s = s.replace(/[-_]?age[-_]?\d+$/i, '');                          // 后置时代标记 heavy_spearman_age_3
    const base = s.replace(/\d+$/, '');                               // 尾部等级 archer_2
    const key = base.replace(/[-_]/g, '');
    if (EN_ZH[key]) return EN_ZH[key];
    for (const k of Object.keys(EN_ZH)) {
      if (key.startsWith(k) || key.endsWith(k)) return EN_ZH[k];
    }
    return base.replace(/[-_]/g, ' ');
  }

  async function open(pid, gid) {
    cur = { pid: String(pid), gid: String(gid), base: null, sum: null, tab: 'overview' };
    const modal = document.querySelector('#modal'), body = document.querySelector('#modalBody');

    // 先从已加载的战绩里取基础信息（rating / 录像 / 版本）
    const cached = (window.Views && window.Views.__games) || [];
    cur.base = cached.find(g => String(g.game_id) === gid) || null;

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    body.innerHTML = `<div class="tab-body"><div class="loading"><div class="spinner"></div>解析对局数据…</div></div>`;

    try {
      cur.sum = await window.API.summary(pid, gid);
      render();
    } catch (e) {
      const st = e && e.status;
      let title, desc;
      if (st === 404) {
        title = '该局暂无复盘数据';
        desc = '只有上传过录像并经 aoe4world 解析的对局才有经济与出兵明细，较旧或未被解析的对局不提供。';
      } else if (st === 429 || st === 0) {
        title = '数据源暂时限流';
        desc = '复盘接口（返回约 40KB 解析结果）配额较紧，已自动重试仍未成功。稍等一两分钟再点开即可；'
             + '若经常遇到，可在本机运行 <code>node server.js</code> 用带缓存的代理模式。';
      } else {
        title = '复盘数据加载失败';
        desc = '原因：' + (e && e.message ? e.message : '未知错误');
      }
      body.innerHTML = `<div class="tab-body">
        <div class="empty"><b>${esc(title)}</b>${desc}</div>
        <div class="m-actions"><button class="btn" id="mRetry">↻ 重试</button></div>
        ${cur.base ? baseInfo(cur.base) : ''}
      </div>`;
      const rb = body.querySelector('#mRetry');
      if (rb) rb.onclick = () => open(pid, gid);
      bindClose();
    }
  }

  function bindClose() {
    document.querySelectorAll('#modal [data-close]').forEach(el => {
      el.onclick = () => {
        document.querySelector('#modal').hidden = true;
        document.body.style.overflow = '';
      };
    });
  }

  function baseInfo(g) {
    const players = flatPlayers(g.teams);
    const mine = players.find(p => String(p.profile_id) === cur.pid) || players[0] || {};
    const url = mine.twitch_video_url || players.map(p => p.twitch_video_url).find(Boolean);
    return `<div class="card" style="margin-top:14px"><h3>对局基础信息</h3>
      <div class="stat-grid">
        <div class="stat"><b>${esc(g.map || '—')}</b><span>地图</span></div>
        <div class="stat"><b>${dur(g.duration)}</b><span>时长</span></div>
        <div class="stat"><b>${esc(D.civName(mine.civilization))}</b><span>使用文明</span></div>
        <div class="stat"><b>${mine.result === 'win' ? '胜利' : '失败'}</b><span>结果</span></div>
        ${mine.rating ? `<div class="stat"><b>${n0(mine.rating)}</b><span>Rating</span></div>` : ''}
        ${mine.rating_diff != null ? `<div class="stat"><b style="color:${mine.rating_diff >= 0 ? 'var(--win)' : 'var(--loss)'}">${mine.rating_diff >= 0 ? '+' : ''}${mine.rating_diff}</b><span>积分变化</span></div>` : ''}
        ${g.season ? `<div class="stat"><b>S${g.season}</b><span>赛季</span></div>` : ''}
      </div>
      ${url ? `<div class="m-actions"><a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener">▶ 观看录像</a></div>` : ''}
    </div>`;
  }

  function render() {
    const body = document.querySelector('#modalBody');
    const s = cur.sum;
    const players = s.players || [];
    // 我方 = pid 命中者；1v1 时对手即另一人
    let mine = players.find(p => String(p.profileId) === cur.pid) || players[0];
    let foes = players.filter(p => p !== mine);
    if (foes.length > 1) {
      const t = mine.team;
      foes = players.filter(p => p.team !== t);
    }
    const foe = foes[0] || players.find(p => p !== mine) || null;

    const mineColor = D.civColor(mine.civilization);
    const foeColor = foe ? D.civColor(foe.civilization) : '#f7768e';

    const replays = [];
    if (cur.base) for (const p of flatPlayers(cur.base.teams)) {
      if (p.twitch_video_url) replays.push({ name: p.name, url: p.twitch_video_url });
    }

    const tabs = [['overview', '概览'], ['econ', '经济复盘'], ['army', '出兵贡献'], ['timeline', '时间轴']];

    body.innerHTML = `
      <div class="m-head">
        <h3 class="m-title">${esc(s.mapName || '未知地图')} · ${dur(s.duration)}</h3>
        <div class="m-sub">
          <span>${esc(D.civName(mine.civilization))} vs ${foe ? esc(D.civName(foe.civilization)) : '—'}</span>
          ${s.winReason ? `<span>结束方式：${esc(s.winReason === 'Surrender' ? '投降' : s.winReason)}</span>` : ''}
          ${s.mapBiome ? `<span>地貌：${esc(s.mapBiome)}</span>` : ''}
          ${s.startedAt ? `<span>${new Date(s.startedAt * 1000).toLocaleString('zh-CN')}</span>` : ''}
          ${cur.base && cur.base.season ? `<span>第 ${cur.base.season} 赛季</span>` : ''}
        </div>
        <div class="m-teams">
          ${players.length > 2
            ? teamGroupsHtml(players, mine)
            : `${teamCard(mine, cur.pid, true)}<div class="m-vs">VS</div>${foe ? teamCard(foe, cur.pid, false) : ''}`}
        </div>
        <div class="m-actions">
          ${replays.length
            ? replays.map(r => `<a class="btn primary" href="${esc(r.url)}" target="_blank" rel="noopener">▶ 观看 ${esc(r.name)} 的第一视角</a>`).join('')
            : `<button class="btn" disabled>本局无录像</button>`}
          ${replays.length ? '' : `<span class="tiny muted" style="align-self:center">
            录像来自 <b>Twitch 直播存档</b>：只有主播/职业选手直播过的对局才会被收录，普通对局没有录像。
            想看录像可以去「玩家查询」里找 Twitch 主播的对局。</span>`}
          <a class="btn" href="https://aoe4world.com/players/${esc(cur.pid)}/games/${esc(cur.gid)}" target="_blank" rel="noopener">aoe4world 原页 ↗</a>
        </div>
      </div>
      <div class="tabs" id="mTabs">${tabs.map(([k, t]) =>
        `<button data-t="${k}" class="${cur.tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="tab-body" id="mTabBody">${tabHtml(cur.tab, mine, foe, mineColor, foeColor)}</div>`;

    const gotoTab = t => {
      cur.tab = t;
      body.querySelectorAll('#mTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
      body.querySelector('#mTabBody').innerHTML = tabHtml(t, mine, foe, mineColor, foeColor);
      bindTab(mine, foe, mineColor, foeColor);
      body.querySelector('#mTabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    body.querySelector('#mTabs').onclick = e => {
      const t = e.target.dataset.t; if (!t) return;
      gotoTab(t);
    };
    // 概览页的快捷跳转按钮
    body.querySelectorAll('[data-gotab]').forEach(b => {
      b.onclick = () => gotoTab(b.dataset.gotab);
    });
    bindClose();
    bindTab(mine, foe, mineColor, foeColor);
  }

  function bindTab(mine, foe, mc, fc) {
    // 预留交互钩子（当前图表为静态 SVG）
  }

  /** 团队赛（3v3 / 4v4）：按队伍分组列出全部选手，我方高亮 */
  function teamGroupsHtml(players, mine) {
    const mineTeam = mine.team;
    const mates = players.filter(p => p.team === mineTeam);
    const foes = players.filter(p => p.team !== mineTeam);
    const group = (title, list, isMine) => `<div class="m-team-group${isMine ? ' mine' : ''}">
      <div class="mtg-head">${title}（${list.length} 人）</div>
      ${list.map(p => teamCard(p, cur.pid, isMine)).join('')}
    </div>`;
    return group('我方', mates, true) + '<div class="m-vs">VS</div>' + group('对手', foes, false);
  }

  function teamCard(p, pid, isMine) {
    const cached = (window.Views && window.Views.__games) || [];
    let rating = null, diff = null;
    const g = cached.find(x => String(x.game_id) === cur.gid);
    if (g) {
      const m = flatPlayers(g.teams).find(x => String(x.profile_id) === String(p.profileId));
      if (m) { rating = m.rating; diff = m.rating_diff; }
    }
    return `<div class="m-team ${p.result === 'win' ? 'win' : 'loss'}">
      <div class="mt-name">
        ${D.civIcon(p.civilization) ? `<img src="${D.civIcon(p.civilization)}" alt="" onerror="this.style.visibility='hidden'">` : ''}
        <a href="#/player/${esc(p.profileId)}" data-close>${esc(p.name || '—')}</a>
        <span class="tag" style="color:${p.result === 'win' ? 'var(--win)' : 'var(--loss)'}">${p.result === 'win' ? '胜' : '负'}</span>
      </div>
      <div class="mt-civ">
        ${D.civIcon(p.civilization) ? `<img src="${D.civIcon(p.civilization)}" alt="" onerror="this.style.visibility='hidden'">` : ''}
        ${esc(D.civName(p.civilization))}
        ${p.apm ? `<span class="tag">APM ${n0(p.apm)}</span>` : ''}
      </div>
      <div class="mt-nums">
        ${rating ? `<span>Rating <b>${n0(rating)}</b>${diff != null ? ` <span style="color:${diff >= 0 ? 'var(--win)' : 'var(--loss)'}">(${diff >= 0 ? '+' : ''}${diff})</span>` : ''}</span>` : ''}
        ${p.scores ? `<span>总分 <b>${n0(p.scores.total)}</b></span>` : ''}
      </div>
    </div>`;
  }

  function tabHtml(tab, m, f, mc, fc) {
    if (tab === 'econ') return econHtml(m, f, mc, fc);
    if (tab === 'army') return armyHtml(m, f, mc, fc);
    if (tab === 'timeline') return timelineHtml(m, f, mc, fc);
    return overviewHtml(m, f, mc, fc);
  }

  /* ---------- 概览 ---------- */
  function overviewHtml(m, f, mc, fc) {
    const g = m.totalResourcesGathered || {}, fg = f ? f.totalResourcesGathered || {} : {};
    const durS = cur.sum.duration || 1;
    const rows = [
      ['APM（每分钟操作）', m.apm || 0, f ? f.apm || 0 : 0, v => n0(v)],
      ['总采集资源', g.total || 0, fg.total || 0, v => n0(v)],
      ['每分钟采集', (g.total || 0) / durS * 60, (fg.total || 0) / durS * 60, v => n0(v)],
      ['总消耗资源', (m.totalResourcesSpent || {}).total || 0, (f ? (f.totalResourcesSpent || {}).total : 0) || 0, v => n0(v)],
      ['总分', (m.scores || {}).total || 0, (f ? (f.scores || {}).total : 0) || 0, v => n0(v)]
    ];
    // 累计资源曲线：开局第一眼就能看到经济走势，不必切到「经济复盘」
    const cum = [];
    cum.push({ name: m.name, color: mc, points: ts(m).map((t, i) => ({ x: t, y: (m.resources.total || [])[i] || 0 })), fill: true });
    if (f) cum.push({ name: f.name, color: fc, points: ts(f).map((t, i) => ({ x: t, y: (f.resources.total || [])[i] || 0 })), fill: true });
    const cumChart = C.line(cum, { h: 210, areaFill: true, fmtX: v => `${Math.round(v / 60)}m`, fmtY: v => n0(v) });

    return `<div class="card"><h3>关键指标对比</h3>
      <div class="vs-list">${rows.map(([k, a, b, fmt]) => C.versus(k,
        { value: a, text: fmt(a), color: mc }, { value: b, text: fmt(b), color: fc })).join('')}</div>
      <div class="sub-h">分数构成</div>
      ${scoreBars(m, 'left')}
      ${f ? scoreBars(f, 'right') : ''}
    </div>
    <div class="card"><h3>累计资源曲线</h3>
      <div class="tiny muted" style="margin-bottom:6px">纵轴为已采集资源总量，<b>两条线分岔的位置</b>就是经济差距拉开的时刻。</div>
      ${cumChart}
    </div>
    <div class="card"><h3>还想看更细的？</h3>
      <div class="tiny muted" style="line-height:1.9">
        ▸ <b>经济复盘</b>：资源构成、采集速率（资源/分钟）、资源存量、村民增长曲线、经济评分走势<br>
        ▸ <b>出兵贡献</b>：产兵 / 击杀 / 损失 / 交换比、杀农与损农、科技数、兵力构成<br>
        ▸ <b>时间轴</b>：时代升级节点、逐项建筑与单位的产出时刻、科技升级时间线
      </div>
      <div class="m-actions">
        <button class="btn" data-gotab="econ">去看经济复盘 →</button>
        <button class="btn" data-gotab="army">去看出兵贡献 →</button>
      </div>
    </div>`;
  }

  function scoreBars(p, side) {
    const sc = p.scores || {}, tot = sc.total || 1;
    const segs = D.SCORES.map(s => ({ label: s.zh, value: sc[s.key] || 0, color: s.color }));
    return `<div class="sub-h" style="text-align:${side === 'left' ? 'left' : 'right'}">
      ${esc(p.name)} · 总分 ${n0(sc.total)}</div>
      ${C.stacked(segs, { h: 20 })}`;
  }

  /* ---------- 经济复盘 ---------- */
  function econHtml(m, f, mc, fc) {
    const R = D.RESOURCES;
    const g = m.totalResourcesGathered || {}, fg = (f && f.totalResourcesGathered) || {};
    const durS = cur.sum.duration || 1;

    // 1) 采集总量对比
    const gatherRows = [
      ['总采集量', g.total || 0, fg.total || 0, v => n0(v)],
      ...R.map(r => [r.zh, g[r.key] || 0, fg[r.key] || 0, v => n0(v)]),
      ['采集效率（资源/分钟）', (g.total || 0) / durS * 60, (fg.total || 0) / durS * 60, v => n0(v)],
      ['资源结余', (g.total || 0) - ((m.totalResourcesSpent || {}).total || 0),
        (fg.total || 0) - ((f && (f.totalResourcesSpent || {}).total) || 0), v => n0(v)]
    ];

    // 2) 资源构成
    const gatherMix = p => C.stacked(R.map(r => ({
      label: r.zh, value: (p.totalResourcesGathered || {})[r.key] || 0, color: r.color
    })), { h: 24 });

    // 3) 资源存量曲线
    const series = R.map(r => ({
      name: r.zh, color: r.color,
      points: ts(m).map((t, i) => ({ x: t, y: (m.resources[r.key] || [])[i] || 0 }))
    }));
    const stockChart = C.line(series, {
      h: 220, areaFill: true, fmtX: v => `${Math.round(v / 60)}m`, fmtY: v => n0(v)
    });

    // 4) 采集速率曲线（每分钟）
    const rateSeries = R.map(r => ({
      name: `${r.zh}/分`, color: r.color,
      points: ts(m).map((t, i) => ({ x: t, y: (m.resources[r.key + 'PerMin'] || [])[i] || 0 }))
    }));
    const rateChart = C.line(rateSeries, { h: 220, fmtX: v => `${Math.round(v / 60)}m`, fmtY: v => n0(v) });

    // 5) 累计采集曲线（双方对比）
    const cum = [];
    if (m) cum.push({ name: m.name, color: mc, points: ts(m).map((t, i) => ({ x: t, y: (m.resources.total || [])[i] || 0 })), fill: true });
    if (f) cum.push({ name: f.name, color: fc, points: ts(f).map((t, i) => ({ x: t, y: (f.resources.total || [])[i] || 0 })), fill: true });
    const cumChart = C.line(cum, { h: 220, areaFill: true, fmtX: v => `${Math.round(v / 60)}m`, fmtY: v => n0(v) });

    // 6) 经济评分曲线
    const ecoSeries = [];
    if (m) ecoSeries.push({ name: m.name, color: mc, points: ts(m).map((t, i) => ({ x: t, y: (m.resources.economy || [])[i] || 0 })), fill: true });
    if (f) ecoSeries.push({ name: f.name, color: fc, points: ts(f).map((t, i) => ({ x: t, y: (f.resources.economy || [])[i] || 0 })), fill: true });
    const ecoChart = C.line(ecoSeries, { h: 200, areaFill: true, fmtX: v => `${Math.round(v / 60)}m`, fmtY: v => n0(v) });

    // 7) 村民增长曲线
    const vill = p => {
      const bo = (p.buildOrder || []).find(b => (b.icon || '').includes('villager'));
      if (!bo || !bo.finished || !bo.finished.length) return null;
      const fin = [...bo.finished].sort((a, b) => a - b);
      const maxT = cur.sum.duration || fin[fin.length - 1];
      const pts = [];
      for (let t = 0; t <= maxT; t += 20) pts.push({ x: t, y: fin.filter(v => v <= t).length });
      pts.push({ x: maxT, y: fin.length });
      return pts;
    };
    const vs = [];
    const mv = vill(m), fv = f ? vill(f) : null;
    if (mv) vs.push({ name: `${m.name} · 村民`, color: mc, points: mv, fill: true });
    if (fv) vs.push({ name: `${f.name} · 村民`, color: fc, points: fv, fill: true });
    const villChart = vs.length ? C.line(vs, { h: 200, areaFill: true, fmtX: v => `${Math.round(v / 60)}m`, fmtY: v => n0(v) })
      : '<div class="chart-empty">该局无村民生产数据</div>';

    return `
      <div class="card"><h3>采集总量对比</h3>
        <div class="vs-list">${gatherRows.map(([k, a, b, fmt]) =>
          C.versus(k, { value: a, text: fmt(a), color: mc }, { value: b, text: fmt(b), color: fc })).join('')}</div>
      </div>

      <div class="card"><h3>资源采集构成</h3>
        <div class="sub-h">${esc(m.name)}（总计 ${n0(g.total)}）</div>${gatherMix(m)}
        ${f ? `<div class="sub-h">${esc(f.name)}（总计 ${n0(fg.total)}）</div>${gatherMix(f)}` : ''}
      </div>

      <div class="card"><h3>累计资源曲线</h3>
        <div class="tiny muted" style="margin-bottom:6px">纵轴为已采集资源总量，斜率即采集速度。两条线的分岔点是经济差距拉开的时刻。</div>
        ${cumChart}
      </div>

      <div class="card"><h3>采集速率（资源 / 分钟）</h3>
        <div class="tiny muted" style="margin-bottom:6px">每 20 秒采样一次的实际采集速率，反映经济运营的起伏。</div>
        ${rateChart}
      </div>

      <div class="card"><h3>资源存量</h3>
        <div class="tiny muted" style="margin-bottom:6px">手上没花掉的资源。持续走高说明资源转化不及时。</div>
        ${stockChart}
      </div>

      <div class="card"><h3>村民数量增长</h3>
        <div class="tiny muted" style="margin-bottom:6px">经济复盘的核心指标：村民增长越平滑、总量越高，后期经济越强。</div>
        ${villChart}
      </div>

      <div class="card"><h3>经济评分走势</h3>${ecoChart}</div>`;
  }

  /* ---------- 出兵贡献 ---------- */
  function armyHtml(m, f, mc, fc) {
    const a = m._stats || {}, b = (f && f._stats) || {};
    const ratio = s => ((s.sqkill || 0) / Math.max(1, s.sqlost || 0));

    const rows = [
      ['军事单位生产', a.sqprod || 0, b.sqprod || 0, v => n0(v), '己方制造的可作战单位总数'],
      ['击杀敌方单位', a.sqkill || 0, b.sqkill || 0, v => n0(v), '击杀的敌方军事单位数'],
      ['损失己方单位', a.sqlost || 0, b.sqlost || 0, v => n0(v), '战损的军事单位数'],
      ['交换比（击杀/损失）', ratio(a), ratio(b), v => v.toFixed(2), '大于 1 表示交换占优'],
      ['击杀村民', a.ekills || 0, b.ekills || 0, v => n0(v), '对敌方经济单位的猎杀'],
      ['村民损失', a.edeaths || 0, b.edeaths || 0, v => n0(v), '己方经济单位阵亡数'],
      ['建筑建造', a.bprod || 0, b.bprod || 0, v => n0(v), '累计建造的建筑数量'],
      ['建筑被摧毁', a.blost || 0, b.blost || 0, v => n0(v), '被敌方摧毁的建筑数'],
      ['科技升级', a.upg || 0, b.upg || 0, v => n0(v), '完成研究的科技数量'],
      ['技能使用', a.abil || 0, b.abil || 0, v => n0(v), '主动技能释放次数'],
      ['总指令数', a.totalcmds || 0, b.totalcmds || 0, v => n0(v), '对局中下达的总指令'],
      ['APM', m.apm || 0, f ? f.apm || 0 : 0, v => n0(v), '每分钟操作次数']
    ];

    // 分数对比
    const sc = m.scores || {}, fsc = (f && f.scores) || {};
    const scoreRows = D.SCORES.map(s => [s.zh, sc[s.key] || 0, fsc[s.key] || 0, v => n0(v)]);
    scoreRows.unshift(['总分', sc.total || 0, fsc.total || 0, v => n0(v)]);

    // 军事评分曲线
    const milSeries = [];
    if (m) milSeries.push({ name: m.name, color: mc, points: ts(m).map((t, i) => ({ x: t, y: (m.resources.military || [])[i] || 0 })), fill: true });
    if (f) milSeries.push({ name: f.name, color: fc, points: ts(f).map((t, i) => ({ x: t, y: (f.resources.military || [])[i] || 0 })), fill: true });
    const milChart = C.line(milSeries, { h: 200, areaFill: true, fmtX: v => `${Math.round(v / 60)}m`, fmtY: v => n0(v) });

    // 单位构成（按建造序列聚合）
    const unitMix = p => {
      const agg = {};
      (p.buildOrder || []).forEach(b => {
        if ((b.type || '') !== 'Unit') return;
        const ic = b.icon || '';
        if (!ic || ic.includes('villager') || ic.includes('/animals/')) return;   // 排除经济单位与动物
        const k = slugZh(b.icon);
        const cnt = (b.finished || []).filter(t => t > 0).length || 1;
        agg[k] = (agg[k] || 0) + cnt;
      });
      const top = Object.entries(agg).sort((x, y) => y[1] - x[1]).slice(0, 8);
      if (!top.length) return '<div class="chart-empty">无单位产出数据</div>';
      const palette = ['#7aa2f7', '#bb9af7', '#7fd8e8', '#9ece6a', '#e0af68', '#f7768e', '#2ac3de', '#ff9e64'];
      return C.stacked(top.map(([k, v], i) => ({ label: k, value: v, color: palette[i % palette.length] })), { h: 24 });
    };

    return `
      <div class="card"><h3>出兵与战损</h3>
        <div class="vs-list">${rows.map(([k, va, vb, fmt]) =>
          C.versus(k, { value: va, text: fmt(va), color: mc }, { value: vb, text: fmt(vb), color: fc })).join('')}</div>
        <div class="tiny muted" style="margin-top:8px">交换比 = 击杀敌方军事单位 ÷ 己方损失，低于 1 说明正面战场吃亏。</div>
      </div>

      <div class="card"><h3>分数构成对比</h3>
        <div class="vs-list">${scoreRows.map(([k, va, vb, fmt]) =>
          C.versus(k, { value: va, text: fmt(va), color: mc }, { value: vb, text: fmt(vb), color: fc })).join('')}</div>
      </div>

      <div class="card"><h3>军事评分走势</h3>
        <div class="tiny muted" style="margin-bottom:6px">军事分反映现役部队规模与科技水平，拐点通常对应大规模交战或部队被歼灭。</div>
        ${milChart}
      </div>

      <div class="card"><h3>兵力构成</h3>
        <div class="sub-h">${esc(m.name)}</div>${unitMix(m)}
        ${f ? `<div class="sub-h">${esc(f.name)}</div>${unitMix(f)}` : ''}
      </div>`;
  }

  /* ---------- 时间轴 ---------- */
  function timelineHtml(m, f, mc, fc) {
    const ages = p => {
      const lms = ((p.analysis || {}).landmarks) || [];
      return lms.filter(l => l.newAge).map(l => ({
        t: l.gameTime || 0, age: l.newAge, name: l.name, icon: l.icon
      })).sort((a, b) => a.t - b.t);
    };
    const AGE_ZH = { 2: '封建时代', 3: '城堡时代', 4: '帝王时代' };

    const ageBlock = p => {
      const as = ages(p);
      if (!as.length) return '<div class="chart-empty">无时代升级记录</div>';
      return `<div class="tl">${as.map(a => `<div class="tl-item">
        <span class="tl-t">${dur(a.t)}</span>
        ${a.icon ? `<img src="${a.icon}" alt="" onerror="this.style.visibility='hidden'">` : ''}
        <span><b>${esc(AGE_ZH[a.age] || ('时代 ' + a.age))}</b>
        <span class="muted tiny"> · ${esc(a.name)}</span></span>
      </div>`).join('')}</div>`;
    };

    // 关键科技时间
    const techBlock = p => {
      const acts = p.actions || {};
      const items = Object.entries(acts)
        .filter(([k]) => /^(upgrade|tech)/i.test(k) && !/^upgradeAge/i.test(k))
        .map(([k, v]) => ({ k, t: Array.isArray(v) ? v[0] : v }))
        .filter(x => typeof x.t === 'number')
        .sort((a, b) => a.t - b.t);
      if (!items.length) return '<div class="chart-empty">无科技记录</div>';
      return `<div class="bo">${items.slice(0, 24).map(it =>
        `<span class="bo-item">${esc(techZh(it.k))}<span class="bo-t">${dur(it.t)}</span></span>`).join('')}</div>`;
    };

    // 建造序列：单位用 finished，建筑用 constructed（建筑 finished 通常为空）
    const boBlock = p => {
      const items = (p.buildOrder || [])
        .filter(b => {
          const t = b.type || '';
          if (t !== 'Unit' && t !== 'Building') return false;
          const ic = b.icon || '';
          return ic && !ic.includes('villager') && !ic.includes('sheep') && !ic.includes('/animals/');
        })
        .map(b => {
          // 建筑完成时间可能只落在 constructed 里
          const times = [...(b.constructed || []), ...(b.finished || [])]
            .filter(x => typeof x === 'number' && x > 0).sort((x, y) => x - y);
          if (!times.length) return null;
          const cnt = Math.max(1, (b.finished || []).filter(x => x > 0).length);
          return { name: slugZh(b.icon), t: times[0], cnt, type: b.type };
        })
        .filter(Boolean)
        .sort((a, b) => a.t - b.t).slice(0, 30);
      if (!items.length) return '<div class="chart-empty">无建造记录</div>';
      return `<div class="bo">${items.map(it =>
        `<span class="bo-item">${esc(it.name)}${it.cnt > 1 ? ` ×${it.cnt}` : ''}<span class="bo-t">${dur(it.t)}</span></span>`).join('')}</div>`;
    };

    return `
      <div class="card"><h3>时代升级节奏</h3>
        <div class="grid2">
          <div><div class="sub-h">${esc(m.name)}</div>${ageBlock(m)}</div>
          <div>${f ? `<div class="sub-h">${esc(f.name)}</div>${ageBlock(f)}` : ''}</div>
        </div>
      </div>

      <div class="card"><h3>关键建筑与单位产出时间</h3>
        <div class="sub-h">${esc(m.name)}</div>${boBlock(m)}
        ${f ? `<div class="sub-h">${esc(f.name)}</div>${boBlock(f)}` : ''}
      </div>

      <div class="card"><h3>科技升级时间线</h3>
        <div class="sub-h">${esc(m.name)}</div>${techBlock(m)}
        ${f ? `<div class="sub-h">${esc(f.name)}</div>${techBlock(f)}` : ''}
      </div>`;
  }

  function techZh(k) {
    return k.replace(/^upgrade/, '').replace(/^(Unit|Econ|Tech|Melee|Ranged|Safe|Age)/, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2').trim() || k;
  }

  const ts = p => (p.resources && p.resources.timestamps) || [];

  return { open };
})();
