/* =========================================================
   utils.js  通用工具：DOM / 日期 / 弹层 / 提示 / 文件
   ========================================================= */
window.TW = window.TW || {};

(function (TW) {
  'use strict';

  /* ---------- DOM ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(k => {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(c => n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return n;
  }

  const esc = s => String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const uid = (p) => (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function debounce(fn, ms) {
    let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => fn.apply(c, a), ms || 300); };
  }

  /* ---------- 日期 ---------- */
  const DAY_CN = ['日', '一', '二', '三', '四', '五', '六'];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /** Date -> 'YYYY-MM-DD'（本地时区） */
  function ymd(d) {
    d = d instanceof Date ? d : new Date(d);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  /** 'YYYY-MM-DD' -> Date（本地零点） */
  function parseYmd(s) {
    if (!s) return null;
    if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const m = String(s).match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  function today() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { const x = parseYmd(d) || new Date(d); x.setDate(x.getDate() + n); return x; }
  function diffDays(a, b) {
    const x = parseYmd(a), y = parseYmd(b);
    return Math.round((x - y) / 86400000);
  }
  /** 周一为一周起点 */
  function mondayOf(d) {
    const x = parseYmd(d) || new Date(d);
    const w = x.getDay(); // 0=日
    return addDays(x, w === 0 ? -6 : 1 - w);
  }
  /** ISO 星期：1=周一 … 7=周日 */
  function isoDow(d) { const w = (parseYmd(d) || new Date(d)).getDay(); return w === 0 ? 7 : w; }
  function fmtCn(d) {
    const x = parseYmd(d) || new Date(d);
    return (x.getMonth() + 1) + '月' + x.getDate() + '日';
  }
  function fmtFull(d) {
    const x = parseYmd(d) || new Date(d);
    return x.getFullYear() + '年' + (x.getMonth() + 1) + '月' + x.getDate() + '日 星期' + DAY_CN[x.getDay()];
  }
  function nowHm() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function hm2min(s) { if (!s) return 0; const p = String(s).split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); }

  /* ---------- 数值 ---------- */
  function num(v, dft) { const n = parseFloat(v); return isFinite(n) ? n : (dft === undefined ? 0 : dft); }
  function round(n, d) { const p = Math.pow(10, d === undefined ? 1 : d); return Math.round(n * p) / p; }
  function fmtSize(b) {
    if (!b && b !== 0) return '—';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
    return (b / 1073741824).toFixed(2) + ' GB';
  }

  /* ---------- Toast ---------- */
  function toast(msg, type, ms) {
    const root = $('#toastRoot');
    if (!root) return;
    const t = el('div', { class: 'toast ' + (type || 'ok'), html: esc(msg) });
    root.appendChild(t);
    setTimeout(() => {
      t.style.transition = '.2s'; t.style.opacity = '0'; t.style.transform = 'translateX(16px)';
      setTimeout(() => t.remove(), 220);
    }, ms || 2600);
  }

  /* ---------- Modal ---------- */
  let modalStack = [];
  function modal(opts) {
    const root = $('#modalRoot');
    const wrap = el('div', { class: 'modal-wrap' });
    wrap.style.cssText = 'position:absolute;inset:0';
    const bg = el('div', { class: 'modal-bg' });
    const box = el('div', { class: 'modal' + (opts.wide ? ' wide' : '') });
    const head = el('div', { class: 'modal-h' }, [
      el('h3', { text: opts.title || '' }),
      el('button', { class: 'icon-btn', onclick: close, html: '<svg class="ic"><use href="#ic-close"></use></svg>' })
    ]);
    const body = el('div', { class: 'modal-b' });
    if (typeof opts.body === 'string') body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body);
    box.appendChild(head); box.appendChild(body);

    if (opts.footer !== false) {
      const foot = el('div', { class: 'modal-f' });
      (opts.buttons || [
        { text: '取消', class: 'btn', onClick: close },
        { text: '确定', class: 'btn btn-primary', onClick: () => { if (opts.onOk) opts.onOk(body, close); else close(); } }
      ]).forEach(b => foot.appendChild(el('button', {
        class: b.class || 'btn',
        text: b.text,
        onclick: () => b.onClick && b.onClick(body, close)
      })));
      box.appendChild(foot);
    }
    bg.addEventListener('click', () => { if (opts.persist !== true) close(); });
    wrap.appendChild(bg); wrap.appendChild(box);
    root.appendChild(wrap); root.classList.add('on');
    modalStack.push(wrap);
    setTimeout(() => { const f = box.querySelector('input,select,textarea'); if (f && opts.autofocus !== false) f.focus(); }, 60);

    function close() {
      wrap.remove();
      modalStack = modalStack.filter(w => w !== wrap);
      if (!modalStack.length) root.classList.remove('on');
      if (opts.onClose) opts.onClose();
    }
    return { close: close, body: body, box: box };
  }

  function confirm(msg, onOk, title) {
    modal({
      title: title || '请确认',
      body: '<div style="font-size:13.5px;line-height:1.8">' + esc(msg) + '</div>',
      buttons: [
        { text: '取消', class: 'btn', onClick: (b, c) => c() },
        { text: '确定', class: 'btn btn-danger', onClick: (b, c) => { c(); onOk && onOk(); } }
      ]
    });
  }

  function prompt(opts) {
    return new Promise(resolve => {
      const wrapEl = el('div');
      wrapEl.innerHTML = '<div class="field"><label>' + esc(opts.label || '') + '</label>' +
        (opts.multiline
          ? '<textarea class="textarea" id="_pv">' + esc(opts.value || '') + '</textarea>'
          : '<input class="input" id="_pv" value="' + esc(opts.value || '') + '">') +
        '</div>' + (opts.hint ? '<div class="hint" style="margin-top:6px">' + esc(opts.hint) + '</div>' : '');
      modal({
        title: opts.title || '输入',
        body: wrapEl,
        buttons: [
          { text: '取消', class: 'btn', onClick: (b, c) => { c(); resolve(null); } },
          { text: '确定', class: 'btn btn-primary', onClick: (b, c) => { const v = b.querySelector('#_pv').value; c(); resolve(v); } }
        ]
      });
    });
  }

  /* ---------- 文件 ---------- */
  function pickFile(accept, multiple) {
    return new Promise(resolve => {
      const i = el('input', { type: 'file', accept: accept || '', style: 'display:none' });
      if (multiple) i.multiple = true;
      i.addEventListener('change', () => { resolve(multiple ? Array.from(i.files) : i.files[0]); i.remove(); });
      document.body.appendChild(i); i.click();
    });
  }
  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
  }
  function readAsArrayBuffer(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result); r.onerror = rej;
      r.readAsArrayBuffer(file);
    });
  }
  function readAsText(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result); r.onerror = rej;
      r.readAsText(file, 'utf-8');
    });
  }

  /* ---------- 迷你 SVG 图表（零依赖） ---------- */
  const PALETTE = ['#60a5fa', '#a78bfa', '#4ade80', '#f472b6', '#fbbf24', '#34d399', '#f87171', '#818cf8'];

  function barChart(data, opt) {
    opt = opt || {};
    const W = 680, H = opt.height || 240, PL = 42, PR = 14, PT = 16, PB = 40;
    const iw = W - PL - PR, ih = H - PT - PB;
    const max = Math.max(1, opt.max || Math.max.apply(null, data.map(d => d.v)));
    const n = data.length || 1;
    const bw = Math.min(52, (iw / n) * 0.62), gap = iw / n;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" font-family="' + '-apple-system,sans-serif' + '">';
    for (let i = 0; i <= 4; i++) {
      const y = PT + ih - (ih * i / 4);
      s += '<line x1="' + PL + '" y1="' + y + '" x2="' + (W - PR) + '" y2="' + y + '" stroke="#eef2f8" stroke-width="1"/>';
      s += '<text x="' + (PL - 8) + '" y="' + (y + 4) + '" font-size="10" fill="#94a3b8" text-anchor="end">' + round(max * i / 4, 0) + '</text>';
    }
    data.forEach((d, i) => {
      const h = Math.max(1, (d.v / max) * ih);
      const x = PL + gap * i + (gap - bw) / 2, y = PT + ih - h;
      const c = d.color || PALETTE[i % PALETTE.length];
      s += '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + h + '" rx="5" fill="' + c + '" opacity=".88"><title>' + esc(d.k) + '：' + d.v + '</title></rect>';
      s += '<text x="' + (x + bw / 2) + '" y="' + (y - 5) + '" font-size="10.5" fill="#475569" text-anchor="middle">' + (d.label !== undefined ? esc(d.label) : d.v) + '</text>';
      s += '<text x="' + (x + bw / 2) + '" y="' + (H - PB + 15) + '" font-size="10.5" fill="#64748b" text-anchor="middle">' + esc(d.k) + '</text>';
      if (d.k2) s += '<text x="' + (x + bw / 2) + '" y="' + (H - PB + 28) + '" font-size="9.5" fill="#94a3b8" text-anchor="middle">' + esc(d.k2) + '</text>';
    });
    s += '<line x1="' + PL + '" y1="' + (PT + ih) + '" x2="' + (W - PR) + '" y2="' + (PT + ih) + '" stroke="#cbd5e1"/></svg>';
    return s;
  }

  function lineChart(series, labels, opt) {
    opt = opt || {};
    const W = 680, H = opt.height || 250, PL = 42, PR = 16, PT = 18, PB = 38;
    const iw = W - PL - PR, ih = H - PT - PB;
    let all = []; series.forEach(s => all = all.concat(s.data.filter(v => v !== null && v !== undefined)));
    const max = opt.max !== undefined ? opt.max : Math.max(1, Math.max.apply(null, all.length ? all : [1]));
    const min = opt.min !== undefined ? opt.min : 0;
    const n = Math.max(1, labels.length - 1);
    const px = i => PL + (labels.length === 1 ? iw / 2 : iw * i / n);
    const py = v => PT + ih - ((v - min) / Math.max(1, max - min)) * ih;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '">';
    for (let i = 0; i <= 4; i++) {
      const y = PT + ih - ih * i / 4;
      s += '<line x1="' + PL + '" y1="' + y + '" x2="' + (W - PR) + '" y2="' + y + '" stroke="#eef2f8"/>';
      s += '<text x="' + (PL - 8) + '" y="' + (y + 4) + '" font-size="10" fill="#94a3b8" text-anchor="end">' + round(min + (max - min) * i / 4, 0) + '</text>';
    }
    labels.forEach((l, i) => {
      s += '<text x="' + px(i) + '" y="' + (H - PB + 16) + '" font-size="10" fill="#64748b" text-anchor="middle">' + esc(l) + '</text>';
    });
    series.forEach((se, si) => {
      const c = se.color || PALETTE[si % PALETTE.length];
      let d = '', started = false;
      se.data.forEach((v, i) => {
        if (v === null || v === undefined) { started = false; return; }
        d += (started ? ' L' : ' M') + px(i) + ',' + py(v); started = true;
      });
      s += '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
      se.data.forEach((v, i) => {
        if (v === null || v === undefined) return;
        s += '<circle cx="' + px(i) + '" cy="' + py(v) + '" r="3.6" fill="#fff" stroke="' + c + '" stroke-width="2.2"><title>' + esc(se.name) + ' ' + esc(labels[i]) + '：' + v + '</title></circle>';
      });
    });
    s += '<line x1="' + PL + '" y1="' + (PT + ih) + '" x2="' + (W - PR) + '" y2="' + (PT + ih) + '" stroke="#cbd5e1"/></svg>';
    return s;
  }

  function donutChart(data, opt) {
    opt = opt || {};
    const S = 220, R = 88, r = 56, cx = S / 2, cy = S / 2;
    const total = data.reduce((a, b) => a + b.v, 0) || 1;
    let ang = -Math.PI / 2, s = '<svg viewBox="0 0 ' + S + ' ' + S + '" style="max-width:220px;margin:0 auto">';
    data.forEach((d, i) => {
      const a = (d.v / total) * Math.PI * 2;
      if (d.v <= 0) return;
      const x1 = cx + R * Math.cos(ang), y1 = cy + R * Math.sin(ang);
      const x2 = cx + R * Math.cos(ang + a), y2 = cy + R * Math.sin(ang + a);
      const x3 = cx + r * Math.cos(ang + a), y3 = cy + r * Math.sin(ang + a);
      const x4 = cx + r * Math.cos(ang), y4 = cy + r * Math.sin(ang);
      const la = a > Math.PI ? 1 : 0;
      s += '<path d="M' + x1 + ',' + y1 + ' A' + R + ',' + R + ' 0 ' + la + ' 1 ' + x2 + ',' + y2 +
        ' L' + x3 + ',' + y3 + ' A' + r + ',' + r + ' 0 ' + la + ' 0 ' + x4 + ',' + y4 + ' Z" fill="' +
        (d.color || PALETTE[i % PALETTE.length]) + '" opacity=".9"><title>' + esc(d.k) + '：' + d.v + '</title></path>';
      ang += a;
    });
    s += '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" font-size="24" font-weight="700" fill="#334155">' + total + '</text>';
    s += '<text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle" font-size="11" fill="#94a3b8">' + esc(opt.centerLabel || '合计') + '</text>';
    s += '</svg>';
    return s;
  }

  function legend(data) {
    return '<div class="legend">' + data.map((d, i) =>
      '<span><i style="background:' + (d.color || PALETTE[i % PALETTE.length]) + '"></i>' + esc(d.k) + (d.v !== undefined ? ' ' + d.v : '') + '</span>'
    ).join('') + '</div>';
  }

  TW.u = {
    $: $, $$: $$, el: el, esc: esc, uid: uid, debounce: debounce,
    DAY_CN: DAY_CN, pad: pad, ymd: ymd, parseYmd: parseYmd, today: today, addDays: addDays,
    diffDays: diffDays, mondayOf: mondayOf, isoDow: isoDow, fmtCn: fmtCn, fmtFull: fmtFull,
    nowHm: nowHm, hm2min: hm2min,
    num: num, round: round, fmtSize: fmtSize,
    toast: toast, modal: modal, confirm: confirm, prompt: prompt,
    pickFile: pickFile, download: download, readAsArrayBuffer: readAsArrayBuffer, readAsText: readAsText,
    PALETTE: PALETTE, barChart: barChart, lineChart: lineChart, donutChart: donutChart, legend: legend
  };
})(window.TW);
