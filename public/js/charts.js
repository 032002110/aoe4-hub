/* 极简 SVG 图表库：折线 / 条形 / 堆叠条 / 环形 —— 零依赖自绘 */
window.Charts = (function () {
  const NS = 'http://www.w3.org/2000/svg';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const niceMax = v => {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  };

  /**
   * 多序列折线图
   * series: [{name, color, points:[{x,y}], dashed}]
   * opts: {w,h,pad, yLabel, xLabel, fmtX, fmtY, areaFill}
   */
  function line(series, opts = {}) {
    const W = opts.w || 640, H = opts.h || 240;
    const pad = Object.assign({ t: 14, r: 16, b: 26, l: 46 }, opts.pad || {});
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;

    const all = series.flatMap(s => s.points.map(p => p.y));
    const xs = series.flatMap(s => s.points.map(p => p.x));
    if (!all.length) return '<div class="chart-empty">暂无数据</div>';

    const yMax = opts.yMax != null ? opts.yMax : niceMax(Math.max(...all) * 1.05);
    const xMax = Math.max(...xs), xMin = Math.min(...xs);
    const X = v => pad.l + (xMax === xMin ? 0 : (v - xMin) / (xMax - xMin) * iw);
    const Y = v => pad.t + ih - (v / yMax) * ih;

    let g = '';
    // 网格 + Y 轴刻度
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const v = yMax / ticks * i, y = Y(v);
      g += `<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.07)"/>`;
      g += `<text x="${pad.l - 7}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" class="ax">${esc((opts.fmtY || (n => Math.round(n)))(v))}</text>`;
    }
    // X 轴刻度
    const xt = Math.min(6, Math.max(2, Math.floor(iw / 90)));
    for (let i = 0; i <= xt; i++) {
      const v = xMin + (xMax - xMin) / xt * i;
      g += `<text x="${X(v).toFixed(1)}" y="${H - 7}" text-anchor="middle" class="ax">${esc((opts.fmtX || (n => Math.round(n)))(v))}</text>`;
    }

    series.forEach(s => {
      if (!s.points.length) return;
      // 只有 1 个采样点（如秒投局）时画一个点，而不是什么都不画
      if (s.points.length === 1) {
        const p = s.points[0];
        g += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.5" fill="${s.color}"/>`;
        return;
      }
      const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
      if (opts.areaFill && s.fill) {
        const base = pad.t + ih;
        g += `<path d="${d} L${X(s.points[s.points.length - 1].x).toFixed(1)},${base} L${X(s.points[0].x).toFixed(1)},${base} Z" fill="${s.color}" opacity=".13"/>`;
      }
      g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${s.dashed ? ' stroke-dasharray="5 4"' : ''}/>`;
    });

    const legend = series.length > 1 ? `<div class="legend">${series.map(s =>
      `<span class="lg"><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';

    return `<svg viewBox="0 0 ${W} ${H}" class="chart" preserveAspectRatio="none">${g}</svg>${legend}`;
  }

  /** 水平条形图：items [{label, value, color, sub, meta}] */
  function bars(items, opts = {}) {
    const rowH = opts.rowH || 30, gap = opts.gap || 6;
    const H = items.length * (rowH + gap) + 8;
    const W = opts.w || 640;
    const labelW = opts.labelW || 116, valW = opts.valW || 74;
    const max = opts.max || niceMax(Math.max(...items.map(i => i.value), 0.01));
    const iw = W - labelW - valW;

    const rows = items.map((it, i) => {
      const y = i * (rowH + gap) + 4;
      const bw = Math.max(2, (it.value / max) * iw);
      const c = it.color || '#7aa2f7';
      return `<g>
        <text x="${labelW - 8}" y="${y + rowH / 2 + 4}" text-anchor="end" class="bl">${esc(it.label)}</text>
        <rect x="${labelW}" y="${y}" width="${iw}" height="${rowH - 4}" rx="4" fill="rgba(255,255,255,.045)"/>
        <rect x="${labelW}" y="${y}" width="${bw.toFixed(1)}" height="${rowH - 4}" rx="4" fill="${c}" opacity=".85"/>
        <text x="${labelW + 8}" y="${y + rowH / 2 + 4}" class="bv">${esc(it.sub || '')}</text>
        <text x="${W - 4}" y="${y + rowH / 2 + 4}" text-anchor="end" class="bm">${esc(it.meta || '')}</text>
      </g>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="chart chart-flat">${rows}</svg>`;
  }

  /** 堆叠条：segs [{label, value, color}] */
  function stacked(segs, opts = {}) {
    const W = opts.w || 640, H = opts.h || 26;
    const total = segs.reduce((a, s) => a + s.value, 0) || 1;
    let x = 0;
    const parts = segs.map(s => {
      const w = (s.value / total) * W;
      const el = `<rect x="${x.toFixed(1)}" y="0" width="${Math.max(0, w).toFixed(1)}" height="${H}" fill="${s.color}" opacity=".88"><title>${esc(s.label)}: ${esc(s.value)} (${(s.value / total * 100).toFixed(1)}%)</title></rect>`;
      x += w; return el;
    }).join('');
    const legend = `<div class="legend">${segs.map(s =>
      `<span class="lg"><i style="background:${s.color}"></i>${esc(s.label)} ${(s.value / total * 100).toFixed(1)}%</span>`).join('')}</div>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="chart chart-flat" preserveAspectRatio="none">${parts}</svg>${legend}`;
  }

  /** 对比双条：a / b 两个玩家某项指标 */
  function versus(label, a, b, opts = {}) {
    const max = Math.max(a.value, b.value, opts.max || 1);
    const ac = a.color || '#7aa2f7', bc = b.color || '#f7768e';
    const W = opts.w || 640;
    const mid = W / 2;
    const aw = (a.value / max) * (mid - 46), bw = (b.value / max) * (mid - 46);
    return `<div class="vs-row">
      <div class="vs-val" style="color:${ac}">${esc(a.text != null ? a.text : a.value)}</div>
      <div class="vs-bar-wrap">
        <div class="vs-half"><div class="vs-fill" style="width:${(aw / (mid - 46) * 100).toFixed(1)}%;background:${ac}"></div></div>
        <div class="vs-half rev"><div class="vs-fill" style="width:${(bw / (mid - 46) * 100).toFixed(1)}%;background:${bc}"></div></div>
      </div>
      <div class="vs-val" style="color:${bc}">${esc(b.text != null ? b.text : b.value)}</div>
      <div class="vs-name">${esc(label)}</div>
    </div>`;
  }

  return { line, bars, stacked, versus, niceMax };
})();
