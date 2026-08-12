/* =========================================================
   todo.js  教学待办备忘：待办事项 / 重要提醒
   ========================================================= */
(function (TW) {
  'use strict';
  const u = TW.u, db = TW.db;
  TW.views = TW.views || {};

  const PRI = { 1: ['紧急重要', 't-red'], 2: ['重要', 't-amber'], 3: ['一般', 't-blue'] };
  const TAGS = ['备课', '批改作业', '成绩录入', '教研活动', '会议', '考试安排', '学生沟通', '材料上交', '个人提升'];
  let filter = 'open';

  function render(host) {
    const S = TW.S, t = u.ymd(u.today());
    const all = TW.term.todosOf();
    const cnt = {
      open: all.filter(x => !x.done).length,
      today: all.filter(x => !x.done && x.due === t).length,
      late: all.filter(x => !x.done && x.due && x.due < t).length,
      done: all.filter(x => x.done).length
    };

    host.innerHTML =
      '<div class="page-head"><div>' +
      '<h2 class="page-title">教学待办备忘</h2>' +
      '<div class="page-sub">待办事项与重要提醒，未完成项同步显示在工作台首页看板</div>' +
      '</div><div class="toolbar">' +
      '<button class="btn btn-sm" id="tExp">导出清单</button>' +
      '<button class="btn btn-sm btn-primary" id="tAdd">＋ 新增待办</button>' +
      '</div></div>' +

      '<div class="grid g4" style="margin-bottom:16px">' +
      '<div class="stat"><div class="s-k">未完成</div><div class="s-v">' + cnt.open + '</div><div class="s-x">项待处理</div></div>' +
      '<div class="stat a"><div class="s-k">今日到期</div><div class="s-v">' + cnt.today + '</div><div class="s-x">今天需完成</div></div>' +
      '<div class="stat k"><div class="s-k">已逾期</div><div class="s-v">' + cnt.late + '</div><div class="s-x">' + (cnt.late ? '请尽快处理' : '状态良好') + '</div></div>' +
      '<div class="stat g"><div class="s-k">已完成</div><div class="s-v">' + cnt.done + '</div><div class="s-x">累计完成</div></div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="tabs">' +
      [['open', '未完成 ' + cnt.open], ['today', '今日 ' + cnt.today], ['late', '逾期 ' + cnt.late], ['done', '已完成 ' + cnt.done], ['all', '全部 ' + all.length]]
        .map(x => '<div class="tab' + (filter === x[0] ? ' on' : '') + '" data-f="' + x[0] + '">' + x[1] + '</div>').join('') +
      '</div>' +
      '<div class="row" style="margin-bottom:12px">' +
      '<input class="input" id="qAdd" placeholder="快速添加：输入内容后按回车…" style="flex:1">' +
      '<select class="select" id="qPri" style="width:110px"><option value="3">一般</option><option value="2">重要</option><option value="1">紧急重要</option></select>' +
      '<input class="input" type="date" id="qDue" style="width:150px">' +
      '</div>' +
      '<div id="tList"></div></div>';

    u.$$('[data-f]', host).forEach(b => b.onclick = () => { filter = b.dataset.f; render(host); });
    u.$('#tAdd').onclick = () => editDialog(null, () => render(host));
    u.$('#tExp').onclick = exportList;
    u.$('#qAdd').onkeydown = e => {
      if (e.key !== 'Enter') return;
      const v = e.target.value.trim(); if (!v) return;
      TW.S.todos.push({
        id: u.uid('t'), title: v, detail: '', due: u.$('#qDue').value || '',
        priority: +u.$('#qPri').value, done: false, classId: '', tag: '', termId: TW.term.currentId(), createdAt: new Date().toISOString()
      });
      db.save('todos'); e.target.value = ''; render(host); u.toast('已添加', 'ok');
    };

    draw();

    function draw() {
      const t = u.ymd(u.today());
      let L = TW.term.todosOf().slice();
      if (filter === 'open') L = L.filter(x => !x.done);
      else if (filter === 'today') L = L.filter(x => !x.done && x.due === t);
      else if (filter === 'late') L = L.filter(x => !x.done && x.due && x.due < t);
      else if (filter === 'done') L = L.filter(x => x.done);
      L.sort((a, b) => {
        if (!!a.done !== !!b.done) return a.done ? 1 : -1;
        const ad = a.due || '9999-99-99', bd = b.due || '9999-99-99';
        if (ad !== bd) return ad < bd ? -1 : 1;
        return (a.priority || 3) - (b.priority || 3);
      });
      const box = u.$('#tList');
      if (!L.length) { box.innerHTML = '<div class="empty"><span class="em-ic">🌿</span>此分类下暂无事项</div>'; return; }
      box.innerHTML = L.map(x => {
        const late = !x.done && x.due && x.due < t, soon = !x.done && x.due === t;
        const p = PRI[x.priority || 3];
        return '<div class="memo p' + (x.priority || 3) + (x.done ? ' done' : '') + '">' +
          '<div class="row" style="align-items:flex-start;gap:10px">' +
          '<span class="chk' + (x.done ? ' on' : '') + '" data-tg="' + x.id + '"></span>' +
          '<div style="flex:1;min-width:0">' +
          '<div class="memo-t">' + u.esc(x.title) + '</div>' +
          (x.detail ? '<div class="memo-x">' + u.esc(x.detail) + '</div>' : '') +
          '<div class="memo-f">' +
          '<span class="tag ' + p[1] + '">' + p[0] + '</span>' +
          (x.due ? '<span class="tag ' + (late ? 't-red' : soon ? 't-amber' : 't-gray') + '">' + (late ? '已逾期 ' : soon ? '今日 ' : '截止 ') + u.fmtCn(x.due) + '</span>' : '') +
          (x.classId ? '<span class="tag t-blue">' + u.esc(db.clsName(x.classId)) + '</span>' : '') +
          (x.tag ? '<span class="tag t-purple">' + u.esc(x.tag) + '</span>' : '') +
          (x.done && x.doneAt ? '<span class="muted">完成于 ' + x.doneAt.slice(0, 10) + '</span>' : '') +
          '</div></div>' +
          '<div class="row nowrap"><button class="btn btn-sm" data-ed="' + x.id + '">编辑</button>' +
          '<button class="btn btn-sm btn-danger" data-del="' + x.id + '">删</button></div>' +
          '</div></div>';
      }).join('');
      u.$$('[data-tg]', box).forEach(n => n.onclick = () => {
        const x = TW.S.todos.find(y => y.id === n.dataset.tg);
        if (!x) return;
        x.done = !x.done; x.doneAt = x.done ? new Date().toISOString() : '';
        db.save('todos'); render(host);
        if (x.done) u.toast('完成一项 👏', 'ok', 1600);
      });
      u.$$('[data-ed]', box).forEach(n => n.onclick = () => editDialog(n.dataset.ed, () => render(host)));
      u.$$('[data-del]', box).forEach(n => n.onclick = () => u.confirm('删除这条待办？', () => {
        TW.S.todos = TW.S.todos.filter(y => y.id !== n.dataset.del); db.save('todos'); render(host);
      }));
    }
  }

  function editDialog(id, done, preset) {
    const S = TW.S;
    const x = id ? S.todos.find(y => y.id === id)
      : Object.assign({ id: u.uid('t'), title: '', detail: '', due: '', priority: 3, done: false, classId: '', tag: '', createdAt: new Date().toISOString() }, preset || {});
    const box = u.el('div');
    box.innerHTML = '<div class="form-grid">' +
      '<div class="field full"><label>事项 *</label><input class="input" id="tT" value="' + u.esc(x.title) + '" placeholder="如：批改 2025级英语1班 Unit3 作文"></div>' +
      '<div class="field"><label>截止日期</label><input class="input" type="date" id="tD" value="' + u.esc(x.due || '') + '"></div>' +
      '<div class="field"><label>优先级</label><select class="select" id="tP">' +
      [1, 2, 3].map(p => '<option value="' + p + '"' + ((x.priority || 3) === p ? ' selected' : '') + '>' + PRI[p][0] + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>关联班级</label><select class="select" id="tC"><option value="">不限</option>' +
      TW.term.classesOf().map(c => '<option value="' + c.id + '"' + (x.classId === c.id ? ' selected' : '') + '>' + u.esc(c.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>分类标签</label><input class="input" id="tG" value="' + u.esc(x.tag || '') + '" list="todoTags">' +
      '<datalist id="todoTags">' + TAGS.map(g => '<option value="' + g + '">').join('') + '</datalist></div>' +
      '<div class="field full"><label>详细说明</label><textarea class="textarea" id="tX" style="min-height:80px">' + u.esc(x.detail || '') + '</textarea></div>' +
      '</div>';
    u.modal({
      title: id ? '编辑待办' : '新增待办', body: box,
      buttons: [{ text: '取消', class: 'btn', onClick: (b, c) => c() },
      {
        text: '保存', class: 'btn btn-primary', onClick: (b, c) => {
          const t = b.querySelector('#tT').value.trim();
          if (!t) { u.toast('请填写事项内容', 'warn'); return; }
          x.title = t; x.due = b.querySelector('#tD').value; x.priority = +b.querySelector('#tP').value;
          x.classId = b.querySelector('#tC').value; x.tag = b.querySelector('#tG').value.trim();
          x.detail = b.querySelector('#tX').value.trim();
          if (!id) { x.termId = TW.term.currentId(); TW.S.todos.push(x); }
          db.save('todos'); c(); done && done(); u.toast('已保存', 'ok');
        }
      }]
    });
  }

  function quickAdd(done) { editDialog(null, done); }

  function exportList() {
    const L = TW.S.todos || [];
    if (!L.length) { u.toast('暂无待办', 'warn'); return; }
    TW.io.exportRows(L.map((x, i) => ({
      序号: i + 1, 事项: x.title, 详细说明: x.detail, 优先级: PRI[x.priority || 3][0],
      截止日期: x.due, 关联班级: x.classId ? db.clsName(x.classId) : '', 标签: x.tag,
      状态: x.done ? '已完成' : '未完成', 完成时间: (x.doneAt || '').slice(0, 10)
    })), '教学待办清单_' + u.ymd(u.today()) + '.xlsx', '待办');
    u.toast('已导出', 'ok');
  }

  TW.views.todo = { title: '教学待办备忘', render: render, quickAdd: quickAdd };
})(window.TW);
