/* =========================================================
   reflection.js  教学反思：课堂问题记录 / 反思存档
   ========================================================= */
(function (TW) {
  'use strict';
  const u = TW.u, db = TW.db, cal = TW.cal;
  TW.views = TW.views || {};

  const TYPES = ['课堂问题记录', '教学反思', '教学改进', '学生个案'];
  let fCls = '', fTerm = '', fType = '', fKw = '';

  function render(host) {
    const S = TW.S;
    const terms = Array.from(new Set(S.reflections.map(r => r.term).filter(Boolean)));
    if (terms.indexOf(cal.termLabel()) < 0) terms.unshift(cal.termLabel());

    host.innerHTML =
      '<div class="page-head"><div>' +
      '<h2 class="page-title">教学反思</h2>' +
      '<div class="page-sub">课堂问题即时记录，学期末沉淀为教学改进依据；支持按班级、学期筛选</div>' +
      '</div><div class="toolbar">' +
      '<button class="btn btn-sm" id="fExpX">导出 Excel</button>' +
      '<button class="btn btn-sm btn-purple" id="fExpW">导出 Word</button>' +
      '<button class="btn btn-sm btn-primary" id="fAdd">＋ 新增记录</button>' +
      '</div></div>' +

      '<div class="card"><div class="row" style="gap:9px">' +
      '<select class="select" id="sCls" style="width:170px"><option value="">全部班级</option>' +
      TW.term.classesOf().map(c => '<option value="' + c.id + '"' + (fCls === c.id ? ' selected' : '') + '>' + u.esc(c.name) + '</option>').join('') + '</select>' +
      '<select class="select" id="sTerm" style="width:190px"><option value="">全部学期</option>' +
      terms.map(t => '<option' + (fTerm === t ? ' selected' : '') + '>' + u.esc(t) + '</option>').join('') + '</select>' +
      '<select class="select" id="sType" style="width:140px"><option value="">全部类型</option>' +
      TYPES.map(t => '<option' + (fType === t ? ' selected' : '') + '>' + u.esc(t) + '</option>').join('') + '</select>' +
      '<input class="input" id="sKw" placeholder="搜索标题或内容…" style="flex:1;min-width:160px" value="' + u.esc(fKw) + '">' +
      '<span class="hint" id="fCount"></span>' +
      '</div></div>' +
      '<div id="fList" style="margin-top:16px"></div>';

    u.$('#fAdd').onclick = () => editDialog(null, () => render(host));
    u.$('#sCls').onchange = e => { fCls = e.target.value; draw(); };
    u.$('#sTerm').onchange = e => { fTerm = e.target.value; draw(); };
    u.$('#sType').onchange = e => { fType = e.target.value; draw(); };
    u.$('#sKw').oninput = u.debounce(e => { fKw = e.target.value.trim(); draw(); }, 240);
    u.$('#fExpX').onclick = () => expX(list());
    u.$('#fExpW').onclick = () => expW(list());

    draw();

    function list() {
      const k = fKw.toLowerCase();
      return TW.S.reflections.filter(r => {
        if (fCls && r.classId !== fCls) return false;
        if (fTerm && r.term !== fTerm) return false;
        if (fType && r.type !== fType) return false;
        if (k && !((r.title || '') + (r.content || '') + (r.measure || '') + (r.tags || '')).toLowerCase().includes(k)) return false;
        return true;
      }).sort((a, b) => b.date > a.date ? 1 : (b.date < a.date ? -1 : 0));
    }

    function draw() {
      const L = list();
      u.$('#fCount').textContent = '共 ' + L.length + ' 条';
      const box = u.$('#fList');
      if (!L.length) {
        box.innerHTML = '<div class="card"><div class="empty"><span class="em-ic">🖋️</span>还没有反思记录<br>' +
          '<span class="hint">可在课表的课次详情中点击「写入反思」快速创建</span></div></div>';
        return;
      }
      box.innerHTML = '<div class="grid g2">' + L.map(r => {
        const tc = r.type === '课堂问题记录' ? 't-amber' : r.type === '教学改进' ? 't-green' : r.type === '学生个案' ? 't-pink' : 't-purple';
        return '<div class="card" style="padding:15px">' +
          '<div class="row" style="justify-content:space-between;align-items:flex-start">' +
          '<h4 style="margin:0;font-size:14.5px;font-weight:650;flex:1;min-width:0">' + u.esc(r.title || '（无标题）') + '</h4>' +
          '<span class="tag ' + tc + '">' + u.esc(r.type || '反思') + '</span></div>' +
          '<div class="memo-f" style="margin:6px 0 8px">' +
          '<span class="tag t-gray">' + u.fmtCn(r.date) + '</span>' +
          (r.classId ? '<span class="tag t-blue">' + u.esc(db.clsName(r.classId)) + '</span>' : '') +
          (r.term ? '<span class="tag t-gray">' + u.esc(r.term) + '</span>' : '') +
          (r.tags ? '<span class="tag t-purple">' + u.esc(r.tags) + '</span>' : '') + '</div>' +
          '<div class="memo-x" style="max-height:120px;overflow:hidden">' + u.esc(r.content || '') + '</div>' +
          (r.measure ? '<div class="prog-line" style="margin-top:8px"><b>改进措施｜</b>' + u.esc(r.measure) + '</div>' : '') +
          '<div class="row" style="margin-top:10px;justify-content:flex-end">' +
          '<button class="btn btn-sm" data-ed="' + r.id + '">编辑</button>' +
          '<button class="btn btn-sm btn-danger" data-del="' + r.id + '">删除</button></div></div>';
      }).join('') + '</div>';
      u.$$('[data-ed]', box).forEach(b => b.onclick = () => editDialog(b.dataset.ed, () => render(host)));
      u.$$('[data-del]', box).forEach(b => b.onclick = () => u.confirm('删除这条记录？', () => {
        TW.S.reflections = TW.S.reflections.filter(x => x.id !== b.dataset.del);
        db.save('reflections'); render(host);
      }));
    }
  }

  function editDialog(id, done, preset) {
    const S = TW.S;
    const r = id ? S.reflections.find(x => x.id === id)
      : Object.assign({ id: u.uid('rf'), date: u.ymd(u.today()), classId: (S.classes[0] || {}).id || '', term: cal.termLabel(), type: TYPES[0], title: '', content: '', measure: '', tags: '' }, preset || {});
    const box = u.el('div');
    box.innerHTML = '<div class="form-grid">' +
      '<div class="field"><label>日期</label><input class="input" type="date" id="rD" value="' + u.esc(r.date) + '"></div>' +
      '<div class="field"><label>类型</label><select class="select" id="rT">' +
      TYPES.map(t => '<option' + (r.type === t ? ' selected' : '') + '>' + u.esc(t) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>班级</label><select class="select" id="rC"><option value="">不限班级</option>' +
      TW.term.classesOf().map(c => '<option value="' + c.id + '"' + (r.classId === c.id ? ' selected' : '') + '>' + u.esc(c.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>学期</label><input class="input" id="rTerm" value="' + u.esc(r.term || cal.termLabel()) + '"></div>' +
      '<div class="field full"><label>标题</label><input class="input" id="rTi" value="' + u.esc(r.title) + '" placeholder="如：Unit3 听力任务学生参与度偏低"></div>' +
      '<div class="field full"><label>记录内容</label><textarea class="textarea" id="rCo" style="min-height:120px" placeholder="课堂现象、学生反馈、教学环节问题…">' + u.esc(r.content) + '</textarea></div>' +
      '<div class="field full"><label>改进措施</label><textarea class="textarea" id="rM" style="min-height:70px" placeholder="下次课如何调整">' + u.esc(r.measure || '') + '</textarea></div>' +
      '<div class="field full"><label>标签</label><input class="input" id="rTg" value="' + u.esc(r.tags || '') + '" placeholder="听力,分组活动"></div>' +
      '</div>';
    u.modal({
      title: id ? '编辑记录' : '新增教学反思', body: box, wide: true,
      buttons: [{ text: '取消', class: 'btn', onClick: (b, c) => c() },
      {
        text: '保存', class: 'btn btn-primary', onClick: (b, c) => {
          r.date = b.querySelector('#rD').value; r.type = b.querySelector('#rT').value;
          r.classId = b.querySelector('#rC').value; r.term = b.querySelector('#rTerm').value.trim();
          r.title = b.querySelector('#rTi').value.trim(); r.content = b.querySelector('#rCo').value.trim();
          r.measure = b.querySelector('#rM').value.trim(); r.tags = b.querySelector('#rTg').value.trim();
          if (!r.title && !r.content) { u.toast('请至少填写标题或内容', 'warn'); return; }
          if (!id) TW.S.reflections.push(r);
          db.save('reflections'); c(); done && done(); u.toast('已保存', 'ok');
        }
      }]
    });
  }

  function quickAdd(preset) { editDialog(null, () => { if (TW.current === 'reflection') TW.go('reflection'); }, preset); }

  function expX(L) {
    if (!L.length) { u.toast('没有可导出的记录', 'warn'); return; }
    TW.io.exportRows(L.map((r, i) => ({
      序号: i + 1, 日期: r.date, 学期: r.term, 班级: db.clsName(r.classId), 类型: r.type,
      标题: r.title, 记录内容: r.content, 改进措施: r.measure, 标签: r.tags
    })), '教学反思记录_' + u.ymd(u.today()) + '.xlsx', '教学反思');
    u.toast('已导出 Excel', 'ok');
  }
  function expW(L) {
    if (!L.length) { u.toast('没有可导出的记录', 'warn'); return; }
    let h = '<h1>教学反思记录汇编</h1><div class="sub">' + u.esc(cal.termLabel()) + '　·　' +
      u.esc(TW.S.settings.teacherName || '') + '　·　共 ' + L.length + ' 条　·　整理日期 ' + u.ymd(u.today()) + '</div>';
    L.forEach((r, i) => {
      h += '<h2>' + (i + 1) + '. ' + u.esc(r.title || '（无标题）') + '</h2>' +
        '<p class="meta">日期：' + u.esc(r.date) + '　班级：' + u.esc(db.clsName(r.classId)) + '　类型：' + u.esc(r.type) + (r.tags ? '　标签：' + u.esc(r.tags) : '') + '</p>' +
        '<p>' + u.esc(r.content || '').replace(/\n/g, '<br>') + '</p>' +
        (r.measure ? '<p><b>改进措施：</b>' + u.esc(r.measure).replace(/\n/g, '<br>') + '</p>' : '');
    });
    TW.io.exportWord('教学反思记录汇编', h, '教学反思记录汇编_' + u.ymd(u.today()));
    u.toast('已导出 Word', 'ok');
  }

  TW.views.reflection = { title: '教学反思', render: render, quickAdd: quickAdd };
})(window.TW);
