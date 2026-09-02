/* 路由 + 全局搜索 */
(function () {
  const V = window.Views;
  const host = document.querySelector('#view');

  function parseHash() {
    const h = (location.hash || '#/civs').replace(/^#\/?/, '');
    const seg = h.split('/').filter(Boolean);
    return { page: seg[0] || 'civs', a: seg[1], b: seg[2] };
  }

  let lastKey = '';
  async function route() {
    const r = parseHash();
    const key = location.hash || '#/civs';
    // 玩家页参数未变时不重绘（避免重复请求）
    if (key === lastKey && r.page === 'player') return;
    lastKey = key;

    document.querySelectorAll('.nav a').forEach(a =>
      a.classList.toggle('on', a.dataset.nav === r.page || (r.page === 'player' && a.dataset.nav === 'players')));

    host.scrollTop = 0;
    if (r.page === 'civs') return V.renderCivs(host);
    if (r.page === 'matchups') return V.renderMatchups(host);
    if (r.page === 'players') return V.renderPlayers(host, r.a ? decodeURIComponent(r.a) : '');
    if (r.page === 'player' && r.a) return V.renderPlayer(host, r.a);
    if (r.page === 'ladder') return V.renderLadder(host);
    location.hash = '#/civs';
  }

  window.addEventListener('hashchange', route);

  /* ---------- 顶栏搜索 ---------- */
  const input = document.querySelector('#globalSearch');
  const box = document.querySelector('#searchResults');
  let timer = null, seq = 0;

  function hideBox() { box.hidden = true; }

  function agoShort(iso) {
    if (!iso) return '';
    const d = (Date.now() - new Date(iso).getTime()) / 1000;
    if (d < 3600) return `${Math.max(1, Math.floor(d / 60))} 分钟前`;
    if (d < 86400) return `${Math.floor(d / 3600)} 小时前`;
    if (d < 2592000) return `${Math.floor(d / 86400)} 天前`;
    if (d < 31536000) return `${Math.floor(d / 2592000)} 个月前`;
    return `${Math.floor(d / 31536000)} 年前`;
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) return hideBox();
    timer = setTimeout(() => runSearch(q), 280);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { hideBox(); input.blur(); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = box.querySelector('.sr-item');
      if (!box.hidden && first) first.click();
      else if (input.value.trim()) location.hash = `#/players/${encodeURIComponent(input.value.trim())}`;
    }
  });

  async function runSearch(q) {
    const my = ++seq;
    box.innerHTML = `<div class="sr-item"><div class="loading" style="padding:10px">搜索中…</div></div>`;
    box.hidden = false;

    // 纯数字 = Profile ID，直接取档案（上游 search 接口传数字返回 0 条）
    if (/^\d+$/.test(q.trim())) {
      try {
        const p = await window.API.player(q.trim());
        if (my !== seq) return;
        hideBox(); input.value = '';
        location.hash = `#/player/${p.profile_id}`;
        return;
      } catch (e) {
        if (my !== seq) return;
        box.innerHTML = `<div class="sr-item"><div class="sr-sub">没有找到 Profile ID ${q.trim()}</div></div>`;
        return;
      }
    }

    try {
      const r = await window.API.searchSmart(q);
      if (my !== seq) return;
      const list = (r.players || []).slice(0, 8);
      box.innerHTML = list.length
        ? list.map(p => {
            const m = (p.leaderboards || {}).rm_solo || {};
            // 同名玩家很多，必须显示 ID 与近期活跃以便辨认
            const bits = [];
            if (p.country) bits.push(p.country.toUpperCase());
            bits.push('ID ' + p.profile_id);
            if (m.rating) bits.push('Rating ' + m.rating);
            if (p.last_game_at) bits.push(agoShort(p.last_game_at));
            return `<div class="sr-item" data-pid="${p.profile_id}">
              ${p.avatars && p.avatars.small
                ? `<img src="${p.avatars.small}" onerror="this.style.visibility='hidden'">`
                : `<div style="width:28px;height:28px;border-radius:50%;background:var(--panel)"></div>`}
              <div style="min-width:0">
                <div class="sr-name">${p.name}</div>
                <div class="sr-sub">${bits.join(' · ')}</div>
              </div>
            </div>`;
          }).join('')
        : `<div class="sr-item"><div class="sr-sub">没有匹配结果</div></div>`;
      box.querySelectorAll('.sr-item[data-pid]').forEach(el => {
        el.onclick = () => { hideBox(); input.value = ''; location.hash = `#/player/${el.dataset.pid}`; };
      });
    } catch (e) {
      if (my !== seq) return;
      box.innerHTML = `<div class="sr-item"><div class="sr-sub">搜索失败：${e.message}</div></div>`;
    }
  }

  // 弹窗关闭逻辑：页面加载时就绑定，不依赖 Match.open() 调用
  // 避免 modal 在某些异常路径下显示出来时无法关闭
  document.querySelectorAll('#modal [data-close]').forEach(el => {
    el.onclick = () => {
      document.querySelector('#modal').hidden = true;
      document.body.style.overflow = '';
    };
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-box')) hideBox();
    // 弹窗内跳转玩家页时自动关闭
    if (e.target.closest('.modal-panel a[href^="#/player"]')) {
      document.querySelector('#modal').hidden = true;
      document.body.style.overflow = '';
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.querySelector('#modal').hidden) {
      document.querySelector('#modal').hidden = true;
      document.body.style.overflow = '';
    }
  });

  route();

  // 页脚显示数据来源模式
  fetch('healthz', { cache: 'no-store' })
    .then(r => {
      document.querySelector('#footStat').textContent = r.ok
        ? '本地代理运行中 · 结果已缓存'
        : '静态托管 · 浏览器直连数据源';
    })
    .catch(() => {
      document.querySelector('#footStat').textContent = '静态托管 · 浏览器直连数据源';
    });
})();
