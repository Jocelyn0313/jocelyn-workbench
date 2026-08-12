/* =========================================================
   dashboard.js  主数据看板（简洁版：按板块聚合待办，逐条勾选完成）
   ========================================================= */
window.JZ.views = window.JZ.views || {};
(function (JZ) {
  'use strict';
  const u = JZ.u, db = JZ.db, cal = JZ.cal, ui = JZ.ui;

  const TPRI = { 1: ['紧急重要', 't-red'], 2: ['重要', 't-amber'], 3: ['一般', 't-blue'] };
  const COMP_DONE = ['已提交', '已获奖'];

  function greet() {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }

  function dueTag(due, t) {
    if (!due) return '';
    const late = due < t, soon = due === t;
    const cls = late ? 't-red' : soon ? 't-amber' : 't-gray';
    const pre = late ? '逾期 ' : soon ? '今日 ' : '截止 ';
    return '<span class="tag ' + cls + '">' + pre + u.fmtCn(due) + '</span>';
  }

  const PRI = [{ v: '1', t: '高' }, { v: '2', t: '中' }, { v: '3', t: '低' }];
  const EDIT_F = {
    deptTodos: [
      { k: 'title', label: '事项', required: true, full: true },
      { k: 'detail', label: '具体要求', type: 'textarea', rows: 3, full: true },
      { k: 'due', label: '截止日期', type: 'date' },
      { k: 'priority', label: '优先级', type: 'select', opts: PRI },
      { k: 'tag', label: '来源 / 标签' },
      { k: 'owner', label: '协作人' }
    ],
    rsTasks: [
      { k: 'title', label: '任务', required: true, full: true },
      { k: 'date', label: '计划日期', type: 'date' },
      { k: 'type', label: '类型', type: 'select', opts: ['读文献', '写论文', '做实验', '数据分析', '开会', '申报', '其它'] },
      { k: 'minutes', label: '预计用时（分钟）', type: 'number', def: 45, min: 0 },
      { k: 'note', label: '备注', type: 'textarea', rows: 3, full: true }
    ],
    otherMemos: [
      { k: 'title', label: '工作要求', required: true, full: true },
      { k: 'source', label: '来源' },
      { k: 'content', label: '具体要求', type: 'textarea', rows: 5, full: true },
      { k: 'due', label: '截止日期', type: 'date' },
      { k: 'priority', label: '优先级', type: 'select', opts: PRI },
      { k: 'link', label: '相关链接', full: true }
    ],
    compWorks: [
      { k: 'name', label: '作品名称', required: true, full: true },
      { k: 'members', label: '参赛人 / 团队' },
      { k: 'track', label: '组别 / 赛道' },
      { k: 'status', label: '当前状态', type: 'select', opts: ['构思', '制作中', '待修改', '已定稿', '已提交', '已获奖'] },
      { k: 'award', label: '获奖情况' },
      { k: 'summary', label: '作品简介', type: 'textarea', rows: 3, full: true }
    ]
  };
  function editName(src) {
    return ({ deptTodos: '部门待办', rsTasks: '科研任务', otherMemos: '其它备忘', compWorks: '竞赛作品' })[src] || '待办';
  }

  function rowHtml(it) {
    const attr = it.teach
      ? ' data-teach="1"'
      : ' data-src="' + it.src + '"';
    return '<div class="todo-row">' +
      '<span class="chk" data-todo data-id="' + it.id + '"' + attr + '></span>' +
      '<div class="t-main"><div class="t-title">' + u.esc(it.title) + '</div>' +
      (it.tagsHtml ? '<div class="t-tags">' + it.tagsHtml + '</div>' : '') + '</div>' +
      (it.go ? '<span class="todo-go" data-go="' + it.go + '">前往 →</span>' : '') +
      '<span class="todo-ed" data-edit data-id="' + it.id + '"' + attr + ' title="编辑">✎</span>' +
      '</div>';
  }

  function editTodo(el) {
    const id = el.dataset.id, teach = el.dataset.teach === '1', src = el.dataset.src;
    if (teach) { openTeachEdit(id); return; }
    const rec = db.one(src, id);
    if (!rec) { u.toast('记录不存在', 'warn'); return; }
    const cfg = EDIT_F[src];
    if (!cfg) { u.toast('该类型暂不支持首页编辑', 'warn'); return; }
    ui.editRecord(src, cfg, rec, { name: editName(src), wide: src === 'otherMemos' || src === 'compWorks' }, () => JZ.go('dashboard'));
  }

  async function openTeachEdit(id) {
    const arr = await JZ.teach.readTodos();
    const x = arr.find(y => y.id === id);
    if (!x) { u.toast('未找到该项', 'warn'); return; }
    const f = [
      { k: 'title', label: '待办内容', required: true, full: true },
      { k: 'due', label: '截止日期', type: 'date' },
      { k: 'priority', label: '优先级', type: 'select', opts: [{ v: '1', t: '紧急重要' }, { v: '2', t: '重要' }, { v: '3', t: '一般' }] }
    ];
    const wrap = u.el('div');
    wrap.innerHTML = ui.formHtml(f, x);
    u.modal({
      title: '编辑教学待办', wide: true, body: wrap,
      buttons: [
        { text: '取消', class: 'btn', onClick: (b, c) => c() },
        {
          text: '保存', class: 'btn btn-primary', onClick: async (b, c) => {
            const d = ui.collect(b, f);
            if (!d.title || !d.title.trim()) { u.toast('内容不能为空', 'warn'); return; }
            const t2 = arr.find(y => y.id === id);
            Object.assign(t2, { title: d.title, due: d.due, priority: d.priority });
            await JZ.teach.writeTodos(arr);
            c(); u.toast('已保存', 'ok'); JZ.go('dashboard');
          }
        }
      ]
    });
  }

  function mapDept(t) {
    return JZ.S.deptTodos.filter(x => !x.done).map(x => ({
      id: x.id, src: 'deptTodos', title: x.title, go: 'deptTodo',
      tagsHtml: (x.tag ? '<span class="tag t-purple">' + u.esc(x.tag) + '</span>' : '') + dueTag(x.due, t)
    }));
  }
  function mapRs(t) {
    return JZ.S.rsTasks.filter(x => !x.done).map(x => ({
      id: x.id, src: 'rsTasks', title: x.title, go: 'rsToday',
      tagsHtml: (x.type ? '<span class="tag t-pink">' + u.esc(x.type) + '</span>' : '') + dueTag(x.date, t)
    }));
  }
  function mapOther(t) {
    return JZ.S.otherMemos.filter(x => !x.done).map(x => ({
      id: x.id, src: 'otherMemos', title: x.title, go: 'otherMemo',
      tagsHtml: (x.source ? '<span class="tag t-amber">' + u.esc(x.source) + '</span>' : '') + dueTag(x.due, t)
    }));
  }
  function mapComp() {
    return JZ.S.compWorks.filter(w => !w.done && COMP_DONE.indexOf(w.status) < 0).map(w => {
      const c = db.one('comps', w.compId);
      const tags = ['<span class="tag t-green">' + u.esc((c ? c.name : '竞赛') + (w.year ? ' ' + w.year : '')) + '</span>'];
      if (w.status) tags.push('<span class="tag t-gray">' + u.esc(w.status) + '</span>');
      return { id: w.id, src: 'compWorks', title: w.name, tagsHtml: tags.join(''), go: (c && c.side === 'student' ? 'compStudent' : 'compTeacher') };
    });
  }
  function mapTeach(arr, t) {
    return (arr || []).filter(x => !x.done).map(x => {
      const p = TPRI[x.priority || 3];
      return {
        id: x.id, teach: true, title: x.title, go: 'teach',
        tagsHtml: (p ? '<span class="tag ' + p[1] + '">' + p[0] + '</span>' : '') + dueTag(x.due, t)
      };
    });
  }

  function groupCard(g, t) {
    const el = u.el('div', { class: 'card todo-group' });
    const items = g.loading ? [] : g.items;
    el.innerHTML =
      '<div class="card-head"><div class="card-title ' + (g.dot || '') + '"><i class="dot"></i>' + u.esc(g.name) + '</div>' +
      '<div class="row nowrap" style="gap:8px"><span class="tag t-gray gh-count">' + (g.loading ? '…' : items.length) + '</span>' +
      '<button class="btn btn-sm" data-go="' + g.view + '">前往板块</button></div></div>' +
      '<div id="body-' + g.view + '" class="grp-body">' +
      (g.loading ? '<div class="hint" style="padding:8px 4px">正在读取教学工作台待办…</div>'
        : (items.length ? items.map(rowHtml).join('')
          : '<div class="hint" style="padding:8px 4px">本板块暂无待办，皆已完成 ✓</div>')) +
      '</div>';
    return el;
  }

  function bind(page) {
    u.$$('.chk[data-todo]', page).forEach(ch => {
      if (ch._b) return; ch._b = 1;
      ch.onclick = async () => {
        const id = ch.dataset.id, teach = ch.dataset.teach === '1', src = ch.dataset.src;
        if (teach) {
          const arr = await JZ.teach.readTodos();
          const x = arr.find(y => y.id === id);
          if (!x) return;
          x.done = true; x.doneAt = new Date().toISOString();
          await JZ.teach.writeTodos(arr);
        } else {
          db.upd(src, id, { done: true, doneAt: Date.now() });
        }
        u.toast('已完成 ✓', 'ok'); JZ.go('dashboard');
      };
    });
    u.$$('[data-go]', page).forEach(b => {
      if (b._b) return; b._b = 1;
      b.onclick = () => {
        const v = b.dataset.go;
        if (v === 'teach') window.open('teaching/index.html#todo', '_blank');
        else JZ.go(v);
      };
    });
    u.$$('[data-edit]', page).forEach(b => {
      if (b._b) return; b._b = 1;
      b.onclick = (e) => { e.stopPropagation(); editTodo(b); };
    });
  }

  JZ.views.dashboard = {
    render: function (host) {
      const S = JZ.S, t = u.ymd(u.today());

      const page = ui.page(host, {
        title: '工作台首页',
        sub: cal.termLabel() + ' · ' + cal.weekText(t) + ' · ' + u.fmtFull(t),
        actions: [
          { text: '打开教学工作台', class: 'btn-green', onClick: () => window.open('teaching/index.html', '_blank') }
        ]
      });

      const syncTotal = mapDept(t).length + mapRs(t).length + mapOther(t).length + mapComp().length;
      const greetEl = u.el('div', { class: 'cn-corner' });
      greetEl.innerHTML =
        '<div class="row" style="justify-content:space-between;align-items:center">' +
        '<div><div style="font-family:var(--font-cn);font-size:18px;font-weight:700">' + u.esc(greet()) + '，' + u.esc(S.settings.ownerName || '老师') + '</div>' +
        '<div class="hint" style="margin-top:4px" id="greetSub">今天共 <b>' + syncTotal + '</b> 项待处理（教学工作台事项加载中…）</div></div>' +
        '<button class="btn btn-sm btn-primary" id="gAdd">＋记一条</button></div>';
      page.appendChild(greetEl);
      u.$('#gAdd', greetEl).onclick = () => JZ.quickAdd();

      const wrap = u.el('div');
      page.appendChild(wrap);

      const groups = [
        { name: '教学工作', dot: '', view: 'teach', items: [], loading: true },
        { name: '部门工作', dot: 'p', view: 'deptTodo', items: mapDept(t) },
        { name: '竞赛工作', dot: 'g', view: 'compTeacher', items: mapComp() },
        { name: '科研工作', dot: 'k', view: 'rsToday', items: mapRs(t) },
        { name: '其它工作', dot: 'a', view: 'otherMemo', items: mapOther(t) }
      ];
      groups.forEach(g => wrap.appendChild(groupCard(g, t)));
      bind(page);

      JZ.teach.readTodos().then(arr => {
        const items = mapTeach(arr, t);
        const sub = u.$('#greetSub', page);
        if (sub) sub.innerHTML = '今天共 <b>' + (syncTotal + items.length) + '</b> 项待处理 · 含教学工作台互通 ' + items.length + ' 项';
        const card = u.$('#body-teach', page);
        if (card) {
          card.innerHTML = items.length ? items.map(rowHtml).join('')
            : '<div class="hint" style="padding:8px 4px">教学工作台暂无待办，或本机尚未保存过教学待办</div>';
          const c2 = card.parentNode.querySelector('.gh-count');
          if (c2) c2.textContent = items.length;
        }
        bind(page);
      }).catch(() => {
        const card = u.$('#body-teach', page);
        if (card) {
          card.innerHTML = '<div class="hint" style="padding:8px 4px">读取教学工作台待办失败。请用「启动工作台（推荐）.bat」以本地服务模式打开，即可启用互通</div>';
          const c2 = card.parentNode.querySelector('.gh-count');
          if (c2) c2.textContent = '!';
        }
      });
    }
  };
})(window.JZ);
