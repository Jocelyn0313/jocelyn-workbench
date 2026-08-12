/* =========================================================
   ui.js  通用界面构件：页头 / 卡片 / 表单 / 文件区 / 链接区 / 自存文本块
   所有业务模块共用，保证交互一致
   ========================================================= */
(function (JZ) {
  'use strict';
  const u = JZ.u, db = JZ.db;

  /* ---------- 页头 ---------- */
  function page(host, opts) {
    const acts = (opts.actions || []).map((a, i) =>
      '<button class="btn ' + (a.class || '') + '" data-act="' + i + '">' + u.esc(a.text) + '</button>').join('');
    host.innerHTML =
      '<div class="page-head"><div><h2 class="page-title">' + u.esc(opts.title) + '</h2>' +
      (opts.sub ? '<div class="page-sub">' + u.esc(opts.sub) + '</div>' : '') + '</div>' +
      '<div class="toolbar">' + acts + '</div></div><div id="pgBody"></div>';
    u.$$('.page-head [data-act]', host).forEach(b => {
      b.onclick = () => opts.actions[+b.dataset.act].onClick();
    });
    return u.$('#pgBody', host);
  }

  /* ---------- 卡片 ---------- */
  function card(opts) {
    const c = u.el('div', { class: 'card ' + (opts.class || '') });
    if (opts.title) {
      const h = u.el('div', { class: 'card-head' });
      h.innerHTML = '<h3 class="card-title ' + (opts.tone || '') + '"><i class="dot"></i>' + u.esc(opts.title) +
        (opts.count !== undefined ? ' <span class="tag t-gray">' + opts.count + '</span>' : '') + '</h3>';
      const box = u.el('div', { class: 'row' });
      (opts.actions || []).forEach(a => box.appendChild(u.el('button', {
        class: 'btn btn-sm ' + (a.class || ''), text: a.text, onclick: a.onClick
      })));
      if (opts.hint) box.appendChild(u.el('span', { class: 'hint', text: opts.hint }));
      h.appendChild(box);
      c.appendChild(h);
    }
    const b = u.el('div', { class: 'card-body' });
    if (typeof opts.body === 'string') b.innerHTML = opts.body;
    else if (opts.body) b.appendChild(opts.body);
    c.appendChild(b);
    c.bodyEl = b;
    return c;
  }

  function empty(text, icon) {
    return '<div class="empty"><span class="em-ic">' + (icon || '🗂') + '</span>' + u.esc(text || '暂无内容') + '</div>';
  }

  /* ---------- 表单 ---------- */
  function fieldHtml(f, v) {
    v = v === undefined || v === null ? (f.def !== undefined ? f.def : '') : v;
    const id = 'fd_' + f.k;
    let inner = '';
    if (f.type === 'textarea') {
      inner = '<textarea class="textarea" id="' + id + '" rows="' + (f.rows || 4) + '" placeholder="' + u.esc(f.ph || '') + '">' + u.esc(v) + '</textarea>';
    } else if (f.type === 'select') {
      inner = '<select class="select" id="' + id + '">' +
        (f.opts || []).map(o => {
          const val = typeof o === 'string' ? o : o.v, txt = typeof o === 'string' ? o : o.t;
          return '<option value="' + u.esc(val) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + u.esc(txt) + '</option>';
        }).join('') + '</select>';
    } else if (f.type === 'check') {
      inner = '<label class="row" style="gap:6px;font-size:13px"><input type="checkbox" id="' + id + '"' + (v ? ' checked' : '') + '> ' + u.esc(f.ph || '是') + '</label>';
    } else {
      const t = f.type === 'date' ? 'date' : (f.type === 'number' ? 'number' : (f.type === 'month' ? 'month' : 'text'));
      inner = '<input class="input" type="' + t + '" id="' + id + '" value="' + u.esc(v) + '" placeholder="' + u.esc(f.ph || '') + '"' +
        (f.step ? ' step="' + f.step + '"' : '') + (f.min !== undefined ? ' min="' + f.min + '"' : '') + '>';
    }
    return '<div class="field ' + (f.full ? 'full' : '') + '"><label>' + u.esc(f.label) +
      (f.required ? ' <span style="color:#f472b6">*</span>' : '') + '</label>' + inner +
      (f.hint ? '<div class="hint">' + u.esc(f.hint) + '</div>' : '') + '</div>';
  }

  function formHtml(fields, value) {
    value = value || {};
    return '<div class="form-grid">' + fields.map(f => fieldHtml(f, value[f.k])).join('') + '</div>';
  }

  function collect(root, fields) {
    const out = {};
    fields.forEach(f => {
      const e = u.$('#fd_' + f.k, root);
      if (!e) return;
      if (f.type === 'check') out[f.k] = e.checked;
      else if (f.type === 'number') out[f.k] = e.value === '' ? '' : u.num(e.value);
      else out[f.k] = e.value.trim ? e.value.trim() : e.value;
    });
    return out;
  }

  /** 通用编辑弹窗 */
  function editModal(opts) {
    const wrap = u.el('div');
    wrap.innerHTML = (opts.tip ? '<div class="hint" style="margin-bottom:10px">' + u.esc(opts.tip) + '</div>' : '') +
      formHtml(opts.fields, opts.value);
    const m = u.modal({
      title: opts.title || '编辑',
      wide: opts.wide,
      body: wrap,
      buttons: [
        { text: '取消', class: 'btn', onClick: (b, c) => c() },
        {
          text: opts.okText || '保存', class: 'btn btn-primary', onClick: (b, c) => {
            const d = collect(b, opts.fields);
            const miss = opts.fields.filter(f => f.required && !String(d[f.k] === undefined ? '' : d[f.k]).trim());
            if (miss.length) { u.toast('请填写：' + miss.map(f => f.label).join('、'), 'warn'); return; }
            c(); opts.onOk(d);
          }
        }
      ]
    });
    return m;
  }

  /** 集合的新增 / 编辑 */
  function editRecord(key, fields, rec, opts, after) {
    opts = opts || {};
    editModal({
      title: (rec ? '编辑' : '新增') + (opts.name || ''),
      fields: fields, value: rec || opts.preset || {}, wide: opts.wide, tip: opts.tip,
      onOk: d => {
        const data = Object.assign({}, opts.preset || {}, d);
        const r = rec ? db.upd(key, rec.id, data) : db.add(key, data);
        u.toast(rec ? '已保存' : '已添加', 'ok');
        after && after(r);
      }
    });
  }

  function confirmDel(name, fn) {
    u.confirm('确定删除「' + name + '」？删除后不可恢复。', fn);
  }

  /* ---------- 文件区 ---------- */
  const EXT_ICON = {
    pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗', csv: '📗',
    ppt: '📙', pptx: '📙', txt: '📄', md: '📄', zip: '🗜', rar: '🗜',
    jpg: '🖼', jpeg: '🖼', png: '🖼', gif: '🖼', webp: '🖼', svg: '🖼',
    mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬', wmv: '🎬', flv: '🎬',
    mp3: '🎵', wav: '🎵', m4a: '🎵', json: '🧾'
  };
  function fileIcon(ext) { return EXT_ICON[String(ext || '').toLowerCase()] || '📎'; }

  /**
   * 上传 + 列表 + 下载 + 删除
   * opts: {cat, refId, title, tone, accept, hint, compact, onChange}
   */
  function fileZone(opts) {
    const host = u.el('div', { class: 'fz' });
    render();
    function render() {
      const list = db.filesOf(opts.cat, opts.refId);
      host.innerHTML =
        '<div class="fz-head"><span class="fz-title">' + u.esc(opts.title || '文件') +
        '<span class="tag t-gray" style="margin-left:6px">' + list.length + '</span></span>' +
        '<span class="row"><button class="btn btn-sm btn-primary" data-a="up">上传文件</button>' +
        (list.length ? '<button class="btn btn-sm" data-a="exp">导出清单</button>' : '') + '</span></div>' +
        '<div class="dropzone dz" data-a="dz">拖拽文件到此处，或点击选择（支持Word、Excel、PDF、图片、音视频、压缩包等任意格式）' +
        (opts.hint ? '<div class="hint" style="margin-top:5px">' + u.esc(opts.hint) + '</div>' : '') + '</div>' +
        (list.length ? '<div class="res-grid" style="margin-top:12px">' + list.map(f =>
          '<div class="res-card" data-id="' + f.id + '">' +
          '<div class="res-ic" style="background:var(--blue-50)">' + fileIcon(f.ext) + '</div>' +
          '<div class="res-name" title="' + u.esc(f.name) + '">' + u.esc(f.name) + '</div>' +
          (f.note ? '<div class="hint">' + u.esc(f.note) + '</div>' : '') +
          '<div class="res-meta"><span>' + u.fmtSize(f.size) + '</span><span>' + u.ymd(new Date(f.createdAt)) + '</span></div>' +
          '<div class="res-act"><button class="btn btn-sm" data-f="open">打开</button>' +
          '<button class="btn btn-sm" data-f="dl">下载</button>' +
          '<button class="btn btn-sm" data-f="note">备注</button>' +
          '<button class="btn btn-sm btn-danger" data-f="del">删</button></div></div>').join('') + '</div>'
          : '<div class="hint" style="margin-top:8px">尚未上传文件</div>');

      const dz = u.$('.dz', host);
      dz.onclick = pickUp;
      dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); };
      dz.ondragleave = () => dz.classList.remove('over');
      dz.ondrop = async e => {
        e.preventDefault(); dz.classList.remove('over');
        await upload(Array.from(e.dataTransfer.files));
      };
      u.$('[data-a="up"]', host).onclick = pickUp;
      const ex = u.$('[data-a="exp"]', host);
      if (ex) ex.onclick = () => {
        JZ.io.exportRows(list.map(f => ({
          文件名: f.name, 格式: f.ext, 大小: u.fmtSize(f.size), 备注: f.note || '',
          上传时间: new Date(f.createdAt).toLocaleString('zh-CN')
        })), (opts.title || '文件') + '清单_' + u.ymd(u.today()) + '.xlsx', '文件清单');
        u.toast('清单已导出', 'ok');
      };
      u.$$('.res-card', host).forEach(cd => {
        const rec = list.find(x => x.id === cd.dataset.id);
        u.$$('[data-f]', cd).forEach(b => b.onclick = async () => {
          const a = b.dataset.f;
          if (a === 'open') db.openFile(rec);
          else if (a === 'dl') db.downloadFile(rec);
          else if (a === 'note') {
            const v = await u.prompt({ title: '文件备注', label: rec.name, value: rec.note || '' });
            if (v !== null) { rec.note = v; db.save('files'); render(); }
          } else if (a === 'del') confirmDel(rec.name, async () => {
            await db.removeFile(rec.id); render(); opts.onChange && opts.onChange();
            u.toast('已删除', 'ok');
          });
        });
      });
    }
    async function pickUp() { const fs = await u.pickFile(opts.accept || '', true); if (fs && fs.length) await upload(fs); }
    async function upload(files) {
      let ok = 0;
      for (const f of files) {
        try { await db.addFile(f, opts.cat, opts.refId); ok++; }
        catch (e) { u.toast(f.name + ' 上传失败：' + e.message, 'err', 5000); }
      }
      if (ok) u.toast('已上传 ' + ok + ' 个文件', 'ok');
      render(); opts.onChange && opts.onChange();
    }
    host.refresh = render;
    return host;
  }

  /* ---------- 链接区 ---------- */
  const LINK_FIELDS = [
    { k: 'name', label: '名称', required: true },
    { k: 'tag', label: '分类标签', ph: '如 后台 / AI写作 / 文献源' },
    { k: 'url', label: '网址', required: true, full: true, ph: 'https://' },
    { k: 'note', label: '说明', type: 'textarea', rows: 2, full: true }
  ];
  /** opts: {cat, refId, title, tone, tip} */
  function linkZone(opts) {
    const host = u.el('div');
    render();
    function render() {
      const list = db.linksOf(opts.cat, opts.refId);
      host.innerHTML =
        '<div class="fz-head"><span class="fz-title">' + u.esc(opts.title || '常用入口') +
        '<span class="tag t-gray" style="margin-left:6px">' + list.length + '</span></span>' +
        '<button class="btn btn-sm btn-purple" data-a="add">添加网站</button></div>' +
        (opts.tip ? '<div class="hint" style="margin-bottom:8px">' + u.esc(opts.tip) + '</div>' : '') +
        (list.length ? '<div class="link-grid">' + list.map(l =>
          '<div class="link-card" data-id="' + u.esc(l.id) + '">' +
          '<a class="lk-main" href="' + u.esc(l.url) + '" target="_blank" rel="noopener">' +
          '<span class="lk-fav">' + u.esc((l.name || '?').slice(0, 1).toUpperCase()) + '</span>' +
          '<span class="lk-txt"><b>' + u.esc(l.name) + '</b><small>' + u.esc(l.note || l.url) + '</small></span></a>' +
          '<div class="lk-act">' + (l.tag ? '<span class="tag t-blue">' + u.esc(l.tag) + '</span>' : '') +
          '<button class="btn btn-sm" data-a="cp">复制</button>' +
          '<button class="btn btn-sm" data-a="ed">改</button>' +
          '<button class="btn btn-sm btn-danger" data-a="rm">删</button></div></div>').join('') + '</div>'
          : empty('还没有添加网站入口', '🔗'));

      u.$('[data-a="add"]', host).onclick = () => editRecord('links', LINK_FIELDS, null, {
        name: '网站入口', preset: { cat: opts.cat, refId: opts.refId || '' }
      }, render);
      u.$$('.link-card', host).forEach(c => {
        const rec = list.find(x => x.id === c.dataset.id);
        u.$$('[data-a]', c).forEach(b => b.onclick = () => {
          if (b.dataset.a === 'ed') editRecord('links', LINK_FIELDS, rec, { name: '网站入口' }, render);
          else if (b.dataset.a === 'rm') confirmDel(rec.name, () => { db.del('links', rec.id); render(); });
          else if (b.dataset.a === 'cp') {
            navigator.clipboard ? navigator.clipboard.writeText(rec.url).then(() => u.toast('网址已复制', 'ok'))
              : u.prompt({ title: '复制网址', label: rec.name, value: rec.url });
          }
        });
      });
    }
    host.refresh = render;
    return host;
  }

  /* ---------- 自动保存文本块 ---------- */
  /** opts:{title,tone,value,rows,ph,onSave(v),hint} */
  function textBlock(opts) {
    const box = u.el('div', { class: 'tb' });
    box.innerHTML = '<div class="tb-head"><span class="fz-title">' + u.esc(opts.title) + '</span>' +
      '<span class="tb-state hint">自动保存</span></div>' +
      '<textarea class="textarea" rows="' + (opts.rows || 5) + '" placeholder="' + u.esc(opts.ph || '') + '">' + u.esc(opts.value || '') + '</textarea>' +
      (opts.hint ? '<div class="hint">' + u.esc(opts.hint) + '</div>' : '');
    const ta = u.$('textarea', box), st = u.$('.tb-state', box);
    const doSave = u.debounce(() => { opts.onSave(ta.value); st.textContent = '已保存 ' + u.nowHm(); }, 600);
    ta.oninput = () => { st.textContent = '输入中…'; doSave(); };
    return box;
  }

  /* ---------- 标签页 ---------- */
  function tabs(items, active, onChange) {
    const box = u.el('div', { class: 'tabs' });
    items.forEach(it => {
      box.appendChild(u.el('div', {
        class: 'tab' + (it.k === active ? ' on' : ''),
        html: u.esc(it.t) + (it.n !== undefined ? ' <b style="opacity:.6">' + it.n + '</b>' : ''),
        onclick: () => onChange(it.k)
      }));
    });
    return box;
  }

  /* ---------- 统计块 ---------- */
  function stats(items) {
    return '<div class="grid g4">' + items.map(s =>
      '<div class="stat ' + (s.tone || '') + '"><div class="s-k">' + u.esc(s.k) + '</div>' +
      '<div class="s-v">' + u.esc(String(s.v)) + '</div>' +
      (s.x ? '<div class="s-x">' + u.esc(s.x) + '</div>' : '') + '</div>').join('') + '</div>';
  }

  /* ---------- 进度条 ---------- */
  function bar(pct, tone) {
    pct = Math.max(0, Math.min(100, Math.round(pct || 0)));
    return '<div class="pbar ' + (tone || '') + '"><i style="width:' + pct + '%"></i><b>' + pct + '%</b></div>';
  }

  /* ---------- 时间线 ---------- */
  function timeline(items) {
    if (!items.length) return empty('暂无记录', '🕒');
    return '<div class="tl">' + items.map(it =>
      '<div class="tl-i ' + (it.tone || '') + '"><div class="tl-d">' + u.esc(it.date || '') + '</div>' +
      '<div class="tl-c"><b>' + u.esc(it.title || '') + '</b>' +
      (it.text ? '<div class="tl-x">' + u.esc(it.text) + '</div>' : '') + '</div></div>').join('') + '</div>';
  }

  JZ.ui = {
    page, card, empty, formHtml, collect, editModal, editRecord, confirmDel,
    fileZone, linkZone, textBlock, tabs, stats, bar, timeline, fileIcon, LINK_FIELDS
  };
})(window.JZ);
