/* =========================================================
   resources.js  教学资源：自有素材上传 / 分类检索 / 预览导出
   ========================================================= */
(function (TW) {
  'use strict';
  const u = TW.u, db = TW.db;
  TW.views = TW.views || {};

  /* 资源分类体系（贴合英语教师实际教学） */
  const CATS = [
    { k: '大学英语', icon: '📗', subs: ['电子课本', '配套课件', '配套音频', '配套视频', '教案与教参'] },
    { k: '新概念英语', icon: '📙', subs: ['电子课本', '课文详解', '练习题', '周测试卷', '期末试卷'] },
    { k: '英语B级考试', icon: '📘', subs: ['专项讲解', '专项练习', '历年真题', '答案详解'] },
    { k: '英语四级考试', icon: '📕', subs: ['专项讲解', '专项练习', '历年真题', '答案详解'] },
    { k: '语法基础知识', icon: '📐', subs: ['语法讲义PDF', '语法练习', '语法课件'] },
    { k: '音标基础知识', icon: '🔤', subs: ['音标视频', '音标课件', '跟读音频'] },
    { k: '课外补充内容', icon: '🎬', subs: ['视听素材', '拓展音频', '拓展课件', '文化背景'] }
  ];

  let curCat = '', curSub = '', kw = '';

  const EXT_IC = {
    pdf: ['📄', 'var(--red-50)'], doc: ['📝', 'var(--blue-50)'], docx: ['📝', 'var(--blue-50)'],
    ppt: ['📊', 'var(--amber-50)'], pptx: ['📊', 'var(--amber-50)'],
    xls: ['📈', 'var(--green-50)'], xlsx: ['📈', 'var(--green-50)'],
    mp3: ['🎵', 'var(--purple-50)'], wav: ['🎵', 'var(--purple-50)'], m4a: ['🎵', 'var(--purple-50)'],
    mp4: ['🎬', 'var(--pink-50)'], mov: ['🎬', 'var(--pink-50)'], avi: ['🎬', 'var(--pink-50)'], mkv: ['🎬', 'var(--pink-50)'],
    jpg: ['🖼️', 'var(--blue-50)'], png: ['🖼️', 'var(--blue-50)'], jpeg: ['🖼️', 'var(--blue-50)'],
    zip: ['🗜️', 'var(--line-soft)'], rar: ['🗜️', 'var(--line-soft)'], link: ['🔗', 'var(--green-50)']
  };
  function icOf(ext) { return EXT_IC[(ext || '').toLowerCase()] || ['📁', 'var(--line-soft)']; }

  function render(host) {
    host.innerHTML =
      '<div class="page-head"><div>' +
      '<h2 class="page-title">教学资源</h2>' +
      '<div class="page-sub">自有素材上传 · 分类检索 · 一键导出；文件存于本机浏览器，不上传云端</div>' +
      '</div><div class="toolbar">' +
      '<button class="btn btn-sm" id="rLink">＋ 添加外链</button>' +
      '<button class="btn btn-sm" id="rExp">导出资源清单</button>' +
      '<button class="btn btn-sm btn-primary" id="rUp">＋ 上传资源</button>' +
      '</div></div>' +

      '<div class="grid" style="grid-template-columns:216px minmax(0,1fr);gap:16px" id="rGrid">' +
      '<div class="card" style="padding:12px;align-self:start"><div class="res-tree" id="rTree"></div></div>' +
      '<div><div class="card">' +
      '<div class="card-head"><div class="row" style="flex:1">' +
      '<div style="position:relative;flex:1;max-width:340px">' +
      '<input class="input" id="rKw" placeholder="搜索资源名称、标签、备注…" value="' + u.esc(kw) + '" style="padding-left:32px">' +
      '<svg class="ic" style="position:absolute;left:9px;top:9px;color:var(--ink-400)"><use href="#ic-search"></use></svg></div>' +
      '<select class="select" id="rType" style="width:130px"><option value="">全部格式</option>' +
      ['pdf', 'ppt', 'word', '音频', '视频', '图片', '外链', '其他'].map(x => '<option>' + x + '</option>').join('') + '</select>' +
      '</div><span class="hint" id="rCount"></span></div>' +
      '<div class="dropzone" id="rDrop">拖拽文件到此处上传，或<b style="color:var(--blue-600)">点击选择文件</b><br>' +
      '<span class="hint">支持 PDF / Word / PPT / 音频 / 视频 / 图片，可多选</span></div>' +
      '<div style="margin-top:14px" id="rList"></div>' +
      '</div></div></div>';

    u.$('#rUp').onclick = () => doUpload();
    u.$('#rLink').onclick = () => linkDialog(null, () => { drawTree(); drawList(); });
    u.$('#rExp').onclick = exportList;
    u.$('#rKw').oninput = u.debounce(e => { kw = e.target.value.trim(); drawList(); }, 240);
    u.$('#rType').onchange = drawList;

    const dz = u.$('#rDrop');
    dz.onclick = () => doUpload();
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); };
    dz.ondragleave = () => dz.classList.remove('over');
    dz.ondrop = e => {
      e.preventDefault(); dz.classList.remove('over');
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length) uploadFiles(files);
    };

    drawTree(); drawList();

    function drawTree() {
      const S = TW.S;
      const cnt = c => S.resources.filter(r => r.cat === c).length;
      const cnt2 = (c, s) => S.resources.filter(r => r.cat === c && r.sub === s).length;
      let h = '<div class="rt-1' + (curCat === '' ? ' on' : '') + '" data-c=""><span>📚 全部资源</span><span>' + S.resources.length + '</span></div>';
      CATS.forEach(c => {
        h += '<div class="rt-1' + (curCat === c.k ? ' on' : '') + '" data-c="' + u.esc(c.k) + '"><span>' + c.icon + ' ' + u.esc(c.k) + '</span><span>' + cnt(c.k) + '</span></div>';
        if (curCat === c.k) c.subs.forEach(s => {
          h += '<div class="rt-2' + (curSub === s ? ' on' : '') + '" data-c="' + u.esc(c.k) + '" data-s="' + u.esc(s) + '"><span>' + u.esc(s) + '</span><span>' + cnt2(c.k, s) + '</span></div>';
        });
      });
      const tree = u.$('#rTree'); tree.innerHTML = h;
      u.$$('.rt-1', tree).forEach(n => n.onclick = () => { curCat = n.dataset.c; curSub = ''; drawTree(); drawList(); });
      u.$$('.rt-2', tree).forEach(n => n.onclick = e => { e.stopPropagation(); curSub = curSub === n.dataset.s ? '' : n.dataset.s; drawTree(); drawList(); });
    }

    function filtered() {
      const tf = u.$('#rType') ? u.$('#rType').value : '';
      const k = kw.toLowerCase();
      return TW.S.resources.filter(r => {
        if (curCat && r.cat !== curCat) return false;
        if (curSub && r.sub !== curSub) return false;
        if (k && !((r.title || '') + (r.tags || '') + (r.note || '') + (r.sub || '')).toLowerCase().includes(k)) return false;
        if (tf) {
          const e = (r.ext || '').toLowerCase();
          const g = { pdf: ['pdf'], ppt: ['ppt', 'pptx'], word: ['doc', 'docx'], 音频: ['mp3', 'wav', 'm4a', 'aac', 'flac'], 视频: ['mp4', 'mov', 'avi', 'mkv', 'wmv'], 图片: ['jpg', 'jpeg', 'png', 'gif', 'webp'], 外链: ['link'] };
          if (tf === '其他') { if (Object.keys(g).some(x => g[x].includes(e))) return false; }
          else if (!(g[tf] || []).includes(e)) return false;
        }
        return true;
      }).sort((a, b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1);
    }

    function drawList() {
      const list = filtered();
      u.$('#rCount').textContent = '共 ' + list.length + ' 项' + (curCat ? ' · ' + curCat + (curSub ? ' / ' + curSub : '') : '');
      const box = u.$('#rList');
      if (!list.length) {
        box.innerHTML = '<div class="empty"><span class="em-ic">📂</span>' + (kw ? '没有匹配的资源' : '此分类下还没有资源，上传后可随时检索取用') + '</div>';
        return;
      }
      box.innerHTML = '<div class="res-grid">' + list.map(r => {
        const ic = icOf(r.ext);
        return '<div class="res-card">' +
          '<div class="row" style="gap:9px;align-items:flex-start">' +
          '<div class="res-ic" style="background:' + ic[1] + '">' + ic[0] + '</div>' +
          '<div style="flex:1;min-width:0"><div class="res-name" title="' + u.esc(r.title) + '">' + u.esc(r.title) + '</div>' +
          '<div class="res-meta"><span>' + u.esc((r.ext || '').toUpperCase()) + '</span><span>' + (r.ext === 'link' ? '外链' : u.fmtSize(r.size)) + '</span></div></div></div>' +
          '<div class="row" style="gap:4px">' +
          '<span class="tag t-blue">' + u.esc(r.cat) + '</span>' +
          (r.sub ? '<span class="tag t-purple">' + u.esc(r.sub) + '</span>' : '') + '</div>' +
          (r.tags ? '<div class="hint ellipsis">🏷 ' + u.esc(r.tags) + '</div>' : '') +
          '<div class="res-act">' +
          '<button class="btn btn-sm" data-open="' + r.id + '">打开</button>' +
          (r.ext === 'link' ? '' : '<button class="btn btn-sm" data-dl="' + r.id + '">下载</button>') +
          '<button class="btn btn-sm" data-ed="' + r.id + '">编辑</button>' +
          '<button class="btn btn-sm btn-danger" data-del="' + r.id + '">删</button>' +
          '</div></div>';
      }).join('') + '</div>';

      u.$$('[data-open]', box).forEach(b => b.onclick = () => openRes(b.dataset.open));
      u.$$('[data-dl]', box).forEach(b => b.onclick = () => downloadRes(b.dataset.dl));
      u.$$('[data-ed]', box).forEach(b => b.onclick = () => metaDialog(b.dataset.ed, () => { drawTree(); drawList(); }));
      u.$$('[data-del]', box).forEach(b => b.onclick = () => {
        const r = TW.S.resources.find(x => x.id === b.dataset.del);
        u.confirm('删除资源「' + (r ? r.title : '') + '」？文件将从本机存储中移除。', async () => {
          if (r && r.fileId) await db.delFile(r.fileId);
          TW.S.resources = TW.S.resources.filter(x => x.id !== b.dataset.del);
          db.save('resources'); drawTree(); drawList(); u.toast('已删除', 'ok');
        });
      });
    }

    async function doUpload() {
      const files = await u.pickFile('', true);
      if (files && files.length) uploadFiles(files);
    }

    async function uploadFiles(files) {
      const cat = curCat || CATS[0].k;
      const sub = curSub || (CATS.find(c => c.k === cat) || CATS[0]).subs[0];
      const box = u.el('div');
      box.innerHTML =
        '<div class="hint" style="margin-bottom:10px">共 ' + files.length + ' 个文件，' + u.fmtSize(files.reduce((a, f) => a + f.size, 0)) + '</div>' +
        '<div class="form-grid">' +
        '<div class="field"><label>所属分类</label><select class="select" id="uCat">' +
        CATS.map(c => '<option value="' + u.esc(c.k) + '"' + (c.k === cat ? ' selected' : '') + '>' + c.icon + ' ' + u.esc(c.k) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>子类</label><select class="select" id="uSub"></select></div>' +
        '<div class="field full"><label>标签（用于检索，逗号分隔）</label><input class="input" id="uTags" placeholder="Unit1, 听力, 2025级"></div>' +
        '</div>' +
        '<div class="tbl-wrap" style="margin-top:12px;max-height:180px"><table class="tbl"><tbody>' +
        files.map(f => '<tr><td>' + u.esc(f.name) + '</td><td class="num">' + u.fmtSize(f.size) + '</td></tr>').join('') +
        '</tbody></table></div>';
      const syncSub = () => {
        const c = CATS.find(x => x.k === box.querySelector('#uCat').value) || CATS[0];
        box.querySelector('#uSub').innerHTML = c.subs.map(s => '<option' + (s === sub ? ' selected' : '') + '>' + u.esc(s) + '</option>').join('');
      };
      box.querySelector('#uCat').onchange = syncSub; syncSub();

      u.modal({
        title: '上传教学资源', body: box,
        buttons: [{ text: '取消', class: 'btn', onClick: (b, c) => c() },
        {
          text: '开始上传', class: 'btn btn-primary', onClick: async (b, c) => {
            const cc = b.querySelector('#uCat').value, ss = b.querySelector('#uSub').value, tg = b.querySelector('#uTags').value.trim();
            c(); u.toast('正在写入本地存储…', 'ok', 2000);
            let ok = 0, fail = 0;
            for (const f of files) {
              try {
                const fid = u.uid('f');
                await db.putFile(fid, f);
                TW.S.resources.push({
                  id: u.uid('r'), cat: cc, sub: ss, title: f.name.replace(/\.[^.]+$/, ''),
                  fileId: fid, ext: (f.name.split('.').pop() || '').toLowerCase(), size: f.size,
                  mime: f.type, tags: tg, note: '', createdAt: new Date().toISOString()
                });
                ok++;
              } catch (e) { fail++; console.error(e); }
            }
            db.save('resources'); db.updateQuota();
            drawTree(); drawList();
            u.toast('上传完成：成功 ' + ok + (fail ? '，失败 ' + fail : ''), fail ? 'warn' : 'ok', 3200);
          }
        }]
      });
    }
  }

  /* ---------- 打开 / 下载 ---------- */
  async function openRes(id) {
    const r = TW.S.resources.find(x => x.id === id); if (!r) return;
    if (r.ext === 'link') { window.open(r.link, '_blank'); return; }
    const blob = await db.getFile(r.fileId);
    if (!blob) { u.toast('文件已丢失，可能被清理或未同步', 'err'); return; }
    const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: guessMime(r.ext) }));
    const e = (r.ext || '').toLowerCase();
    if (['mp4', 'mov', 'webm', 'mp3', 'wav', 'm4a', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(e)) {
      const isA = ['mp3', 'wav', 'm4a'].includes(e), isV = ['mp4', 'mov', 'webm'].includes(e);
      u.modal({
        title: r.title, wide: true, footer: false,
        body: isV ? '<video src="' + url + '" controls autoplay style="width:100%;border-radius:12px;background:#000"></video>'
          : isA ? '<audio src="' + url + '" controls autoplay style="width:100%"></audio>'
            : '<img src="' + url + '" style="width:100%;border-radius:12px">',
        onClose: () => URL.revokeObjectURL(url)
      });
    } else {
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  }
  function guessMime(ext) {
    const m = { pdf: 'application/pdf', mp3: 'audio/mpeg', mp4: 'video/mp4', jpg: 'image/jpeg', png: 'image/png', wav: 'audio/wav' };
    return m[(ext || '').toLowerCase()] || 'application/octet-stream';
  }
  async function downloadRes(id) {
    const r = TW.S.resources.find(x => x.id === id); if (!r) return;
    const blob = await db.getFile(r.fileId);
    if (!blob) { u.toast('文件已丢失', 'err'); return; }
    u.download(blob, r.title + '.' + r.ext);
  }

  /* ---------- 元信息编辑 ---------- */
  function metaDialog(id, done) {
    const r = TW.S.resources.find(x => x.id === id); if (!r) return;
    const cat = CATS.find(c => c.k === r.cat) || CATS[0];
    const box = u.el('div');
    box.innerHTML = '<div class="form-grid">' +
      '<div class="field full"><label>资源名称</label><input class="input" id="mT" value="' + u.esc(r.title) + '"></div>' +
      '<div class="field"><label>分类</label><select class="select" id="mC">' +
      CATS.map(c => '<option value="' + u.esc(c.k) + '"' + (c.k === r.cat ? ' selected' : '') + '>' + u.esc(c.k) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>子类</label><select class="select" id="mS">' +
      cat.subs.map(s => '<option' + (s === r.sub ? ' selected' : '') + '>' + u.esc(s) + '</option>').join('') + '</select></div>' +
      '<div class="field full"><label>标签</label><input class="input" id="mG" value="' + u.esc(r.tags || '') + '"></div>' +
      (r.ext === 'link' ? '<div class="field full"><label>链接地址</label><input class="input" id="mL" value="' + u.esc(r.link || '') + '"></div>' : '') +
      '<div class="field full"><label>备注</label><textarea class="textarea" id="mN" style="min-height:60px">' + u.esc(r.note || '') + '</textarea></div>' +
      '</div>';
    box.querySelector('#mC').onchange = e => {
      const c = CATS.find(x => x.k === e.target.value) || CATS[0];
      box.querySelector('#mS').innerHTML = c.subs.map(s => '<option>' + u.esc(s) + '</option>').join('');
    };
    u.modal({
      title: '编辑资源信息', body: box,
      buttons: [{ text: '取消', class: 'btn', onClick: (b, c) => c() },
      {
        text: '保存', class: 'btn btn-primary', onClick: (b, c) => {
          r.title = b.querySelector('#mT').value.trim() || r.title;
          r.cat = b.querySelector('#mC').value; r.sub = b.querySelector('#mS').value;
          r.tags = b.querySelector('#mG').value.trim(); r.note = b.querySelector('#mN').value.trim();
          const l = b.querySelector('#mL'); if (l) r.link = l.value.trim();
          db.save('resources'); c(); done && done(); u.toast('已保存', 'ok');
        }
      }]
    });
  }

  /* ---------- 外链资源 ---------- */
  function linkDialog(id, done) {
    const box = u.el('div');
    box.innerHTML = '<div class="form-grid">' +
      '<div class="field full"><label>资源名称 *</label><input class="input" id="lT" placeholder="如：BBC 6 Minute English 合集"></div>' +
      '<div class="field full"><label>链接地址 *</label><input class="input" id="lU" placeholder="https://"></div>' +
      '<div class="field"><label>分类</label><select class="select" id="lC">' + CATS.map(c => '<option>' + u.esc(c.k) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>子类</label><select class="select" id="lS">' + CATS[0].subs.map(s => '<option>' + u.esc(s) + '</option>').join('') + '</select></div>' +
      '<div class="field full"><label>标签</label><input class="input" id="lG"></div></div>';
    box.querySelector('#lC').onchange = e => {
      const c = CATS.find(x => x.k === e.target.value) || CATS[0];
      box.querySelector('#lS').innerHTML = c.subs.map(s => '<option>' + u.esc(s) + '</option>').join('');
    };
    u.modal({
      title: '添加外链资源', body: box,
      buttons: [{ text: '取消', class: 'btn', onClick: (b, c) => c() },
      {
        text: '添加', class: 'btn btn-primary', onClick: (b, c) => {
          const t = b.querySelector('#lT').value.trim(), l = b.querySelector('#lU').value.trim();
          if (!t || !l) { u.toast('请填写名称与链接', 'warn'); return; }
          TW.S.resources.push({
            id: u.uid('r'), cat: b.querySelector('#lC').value, sub: b.querySelector('#lS').value,
            title: t, link: l, ext: 'link', size: 0, tags: b.querySelector('#lG').value.trim(),
            note: '', createdAt: new Date().toISOString()
          });
          db.save('resources'); c(); done && done(); u.toast('已添加', 'ok');
        }
      }]
    });
  }

  /* ---------- 导出清单 ---------- */
  function exportList() {
    const list = TW.S.resources;
    if (!list.length) { u.toast('暂无资源可导出', 'warn'); return; }
    TW.io.exportRows(list.map((r, i) => ({
      序号: i + 1, 分类: r.cat, 子类: r.sub, 资源名称: r.title, 格式: (r.ext || '').toUpperCase(),
      大小: r.ext === 'link' ? '外链' : u.fmtSize(r.size), 标签: r.tags || '', 备注: r.note || '',
      链接: r.link || '', 入库时间: (r.createdAt || '').slice(0, 10)
    })), '教学资源清单_' + u.ymd(u.today()) + '.xlsx', '资源清单');
    u.toast('资源清单已导出', 'ok');
  }

  TW.views.resources = { title: '教学资源', render: render, CATS: CATS };
})(window.TW);
