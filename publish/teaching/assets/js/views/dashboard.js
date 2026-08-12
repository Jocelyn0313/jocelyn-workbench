/* =========================================================
   dashboard.js  主数据看板：当日课表 + 授课进度 + 教学待办
   ========================================================= */
(function (TW) {
  'use strict';
  const u = TW.u, db = TW.db, cal = TW.cal;
  TW.views = TW.views || {};

  let timer = null;

  function render(host) {
    const S = TW.S;
    const todayStr = u.ymd(u.today());
    const list = cal.lessonsOn(todayStr);
    const w = cal.weekOf(todayStr);
    const cur = cal.currentLesson(list);
    const tp = cal.termProgress();
    const undone = TW.term.todosOf().filter(t => !t.done);
    const overdue = undone.filter(t => t.due && t.due < todayStr);
    const weekCount = (function () {
      if (!w) return 0;
      let n = 0; for (let d = 1; d <= 7; d++) n += cal.lessonsOn(cal.dateOf(w, d)).length; return n;
    })();

    host.innerHTML =
      '<div class="page-head"><div>' +
      '<h2 class="page-title">' + greet() + (S.settings.teacherName ? '，' + u.esc(S.settings.teacherName) + '老师' : '') + '</h2>' +
      '<div class="page-sub">' + u.fmtFull(todayStr) + ' · ' + cal.termLabel() + (w ? ' · 第' + w + '教学周' : ' · 假期/学期外') + '</div>' +
      '</div><div class="toolbar">' +
      '<button class="btn btn-sm" id="dRefresh">刷新</button>' +
      '<button class="btn btn-sm btn-purple" id="dWord">导出今日工作记录</button>' +
      '</div></div>' +

      '<div class="grid g4" style="margin-bottom:16px">' +
      stat('今日课时', list.length + ' 节', list.length ? (cur.current ? '正在上：' + cur.current.course : (cur.next ? '下一节 ' + cur.next.start : '今日课程已结束')) : '今日无课，可安排备课', '') +
      stat('本周课次', weekCount + ' 节', w ? '第' + w + ' / ' + (S.settings.totalWeeks || 20) + ' 周' : '不在教学周内', 'p') +
      stat('待办未完成', undone.length + ' 项', overdue.length ? '⚠ ' + overdue.length + ' 项已逾期' : '暂无逾期事项', overdue.length ? 'k' : 'g') +
      stat('学期进度', tp.pct + '%', '第' + tp.passed + ' / ' + tp.total + ' 天', 'a') +
      '</div>' +

      '<div class="grid g-2-1">' +
      '<div>' +
      '<div class="card"><div class="card-head"><h3 class="card-title"><i class="dot"></i>今日课表与授课进度</h3>' +
      '<div class="toolbar"><span class="hint">' + u.fmtCn(todayStr) + ' 周' + u.DAY_CN[u.isoDow(todayStr) % 7] + '</span>' +
      '<button class="btn btn-sm" id="dGoSch">完整课表</button></div></div>' +
      '<div id="dToday"></div></div>' +

      '<div class="card"><div class="card-head"><h3 class="card-title g"><i class="dot"></i>明日课程预告</h3>' +
      '<button class="btn btn-sm" id="dPrepAll">批量备课</button></div><div id="dTomorrow"></div></div>' +
      '</div>' +

      '<div>' +
      '<div class="card"><div class="card-head"><h3 class="card-title k"><i class="dot"></i>教学待办备忘</h3>' +
      '<button class="btn btn-sm btn-pink" id="dAddTodo">＋ 添加</button></div><div id="dTodo"></div></div>' +

      '<div class="card"><div class="card-head"><h3 class="card-title p"><i class="dot"></i>本周教学一览</h3></div>' +
      '<div id="dWeek"></div></div>' +

      '<div class="card"><div class="card-head"><h3 class="card-title a"><i class="dot"></i>最近教学反思</h3>' +
      '<button class="btn btn-sm" id="dGoRef">全部</button></div><div id="dRef"></div></div>' +
      '</div></div>';

    u.$('#dRefresh').onclick = () => render(host);
    u.$('#dGoSch').onclick = () => TW.go('schedule');
    u.$('#dGoRef').onclick = () => TW.go('reflection');
    u.$('#dAddTodo').onclick = () => TW.views.todo.quickAdd(() => render(host));
    u.$('#dWord').onclick = () => exportDaily(todayStr, list);
    u.$('#dPrepAll').onclick = () => {
      const tm = u.ymd(u.addDays(u.today(), 1));
      const l = cal.lessonsOn(tm);
      if (!l.length) { u.toast('明日无课', 'warn'); return; }
      TW.views.schedule.openLesson(l[0], () => render(host));
    };

    renderLessons(u.$('#dToday'), list, cur, true, host);
    renderLessons(u.$('#dTomorrow'), cal.lessonsOn(u.ymd(u.addDays(u.today(), 1))), { current: null }, false, host);
    renderTodo(u.$('#dTodo'), host);
    renderWeekBrief(u.$('#dWeek'), w);
    renderRef(u.$('#dRef'));

    clearInterval(timer);
    timer = setInterval(() => {
      if (!document.body.contains(host)) { clearInterval(timer); return; }
      const c = cal.currentLesson();
      renderLessons(u.$('#dToday'), cal.lessonsOn(u.ymd(u.today())), c, true, host);
    }, 60000);

    function stat(k, v, x, c) {
      return '<div class="stat ' + (c || '') + '"><div class="s-k">' + k + '</div><div class="s-v">' + v + '</div><div class="s-x">' + u.esc(x) + '</div></div>';
    }
  }

  function greet() {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }

  function renderLessons(box, list, cur, showProgress, host) {
    if (!box) return;
    if (!list.length) {
      box.innerHTML = '<div class="empty"><span class="em-ic">🍵</span>今日无课</div>';
      return;
    }
    const now = u.hm2min(u.nowHm());
    box.innerHTML = list.map(o => {
      const p = cal.progressOf(o);
      const isNow = cur.current && cur.current.key === o.key;
      const done = u.hm2min(o.end) < now && o.date === u.ymd(u.today());
      return '<div class="lesson' + (isNow ? ' now' : '') + (done && !isNow ? ' done' : '') + '" data-k="' + o.date + '|' + o.scheduleId + '">' +
        '<div class="lesson-time"><b>' + o.start + '</b><small>' + o.end + '</small><small>' + u.esc(o.pname) + '</small></div>' +
        '<div class="lesson-body"><h4>' + u.esc(o.course) +
        (isNow ? '<span class="tag t-green">进行中</span>' : '') +
        (o.flag === 'move' ? '<span class="tag t-pink">调课</span>' : '') +
        (o.flag === 'extra' ? '<span class="tag t-amber">补课</span>' : '') +
        (p.content ? '' : '<span class="tag t-gray">未备课</span>') + '</h4>' +
        '<div class="lesson-meta"><span>👥 ' + u.esc(db.clsName(o.classId)) + '</span>' +
        (o.room ? '<span>📍 ' + u.esc(o.room) + '</span>' : '') +
        '<span>🗓 第' + o.week + '周</span></div>' +
        (showProgress ?
          '<div class="prog-line"><b>课前进度｜</b>' + (p.pre ? u.esc(p.pre) : '<span class="muted">未记录</span>') + '\n' +
          '<b>授课内容｜</b>' + (p.content ? u.esc(p.content) : '<span class="muted">待填写</span>') +
          (p.post ? '\n<b>课后进度｜</b>' + u.esc(p.post) : '') +
          (p.homework ? '\n<b>作业｜</b>' + u.esc(p.homework) : '') + '</div>'
          : (p.content ? '<div class="prog-line">' + u.esc(p.content) + '</div>' : '')) +
        '</div></div>';
    }).join('');
    u.$$('.lesson', box).forEach(n => n.onclick = () => {
      const [d, sid] = n.dataset.k.split('|');
      const occ = cal.lessonsOn(d).find(x => x.scheduleId === sid);
      if (occ) TW.views.schedule.openLesson(occ, () => render(u.$('#view')));
    });
  }

  function renderTodo(box, host) {
    const S = TW.S, t = u.ymd(u.today());
    const list = TW.term.todosOf().filter(x => !x.done)
      .sort((a, b) => (a.due || '9999') === (b.due || '9999') ? (a.priority || 3) - (b.priority || 3) : ((a.due || '9999') < (b.due || '9999') ? -1 : 1))
      .slice(0, 8);
    if (!list.length) { box.innerHTML = '<div class="empty" style="padding:26px"><span class="em-ic">✅</span>待办已清空</div>'; return; }
    box.innerHTML = list.map(x => {
      const late = x.due && x.due < t;
      const soon = x.due === t;
      return '<div class="memo p' + (x.priority || 3) + '" style="padding:10px 12px;margin-bottom:8px">' +
        '<div class="row" style="align-items:flex-start;gap:8px">' +
        '<span class="chk" data-done="' + x.id + '"></span>' +
        '<div style="flex:1;min-width:0"><div class="memo-t" style="font-size:13px">' + u.esc(x.title) + '</div>' +
        (x.detail ? '<div class="memo-x" style="font-size:11.5px">' + u.esc(x.detail.slice(0, 60)) + '</div>' : '') +
        '<div class="memo-f">' +
        (x.due ? '<span class="tag ' + (late ? 't-red' : soon ? 't-amber' : 't-gray') + '">' + (late ? '逾期 ' : soon ? '今天 ' : '') + u.fmtCn(x.due) + '</span>' : '') +
        (x.classId ? '<span class="tag t-blue">' + u.esc(db.clsName(x.classId)) + '</span>' : '') +
        (x.tag ? '<span class="tag t-purple">' + u.esc(x.tag) + '</span>' : '') +
        '</div></div></div></div>';
    }).join('') + '<button class="btn btn-sm" style="width:100%;justify-content:center" id="dMoreTodo">查看全部待办</button>';
    u.$$('[data-done]', box).forEach(n => n.onclick = () => {
      const x = TW.S.todos.find(y => y.id === n.dataset.done);
      if (x) { x.done = true; x.doneAt = new Date().toISOString(); db.save('todos'); u.toast('已完成 👏', 'ok'); render(u.$('#view')); }
    });
    const m = u.$('#dMoreTodo'); if (m) m.onclick = () => TW.go('todo');
  }

  function renderWeekBrief(box, w) {
    if (!w) { box.innerHTML = '<div class="empty" style="padding:22px">当前不在教学周内</div>'; return; }
    const t = u.ymd(u.today());
    let h = '';
    for (let d = 1; d <= 7; d++) {
      const ds = cal.dateOf(w, d);
      const l = cal.lessonsOn(ds);
      if (!l.length) continue;
      const doneN = l.filter(o => cal.progressOf(o).content).length;
      h += '<div class="row" style="padding:7px 0;border-bottom:1px dashed var(--line)">' +
        '<b style="width:66px;font-size:12.5px;' + (ds === t ? 'color:var(--pink-600)' : '') + '">周' + u.DAY_CN[d % 7] + '</b>' +
        '<span style="font-size:12px;flex:1;min-width:0" class="ellipsis">' + l.map(o => u.esc(o.course) + '·' + u.esc(db.clsName(o.classId))).join('；') + '</span>' +
        '<span class="tag ' + (doneN === l.length ? 't-green' : 't-gray') + '">' + doneN + '/' + l.length + '</span></div>';
    }
    box.innerHTML = h || '<div class="empty" style="padding:22px">本周暂无课程</div>';
  }

  function renderRef(box) {
    const list = (TW.S.reflections || []).slice().sort((a, b) => b.date > a.date ? 1 : -1).slice(0, 4);
    if (!list.length) { box.innerHTML = '<div class="empty" style="padding:22px">还没有教学反思记录</div>'; return; }
    box.innerHTML = list.map(r =>
      '<div style="padding:8px 0;border-bottom:1px dashed var(--line)">' +
      '<div style="font-size:12.8px;font-weight:600" class="ellipsis">' + u.esc(r.title || '（无标题）') + '</div>' +
      '<div class="memo-f"><span class="tag t-gray">' + u.fmtCn(r.date) + '</span>' +
      (r.classId ? '<span class="tag t-blue">' + u.esc(db.clsName(r.classId)) + '</span>' : '') +
      '<span class="tag ' + (r.type === '问题记录' ? 't-amber' : 't-purple') + '">' + u.esc(r.type || '反思') + '</span></div></div>').join('');
  }

  /* ---------- 导出今日工作记录 ---------- */
  function exportDaily(date, list) {
    const S = TW.S;
    const todos = TW.term.todosOf().filter(t => !t.done).slice(0, 20);
    let h = '<h1>教学工作日志</h1><div class="sub">' + u.fmtFull(date) + '　·　' + cal.termLabel() +
      '　·　第' + (cal.weekOf(date) || '—') + '教学周　·　' + u.esc(S.settings.teacherName || '') + '</div>';
    h += '<h2>一、今日授课</h2>';
    if (!list.length) h += '<p>今日无授课任务。</p>';
    else {
      h += '<table><thead><tr><th>节次</th><th>时间</th><th>班级</th><th>课程</th><th>课前进度</th><th>授课内容</th><th>课后进度</th><th>作业</th></tr></thead><tbody>';
      list.forEach(o => {
        const p = cal.progressOf(o);
        h += '<tr><td>' + u.esc(o.pname) + '</td><td>' + o.start + '-' + o.end + '</td><td>' + u.esc(db.clsName(o.classId)) + '</td>' +
          '<td>' + u.esc(o.course) + '</td><td>' + u.esc(p.pre) + '</td><td>' + u.esc(p.content) + '</td><td>' + u.esc(p.post) + '</td><td>' + u.esc(p.homework) + '</td></tr>';
      });
      h += '</tbody></table>';
      const notes = list.map(o => ({ o: o, p: cal.progressOf(o) })).filter(x => x.p.note);
      if (notes.length) {
        h += '<h2>二、课堂情况备注</h2><ul>' + notes.map(x => '<li><b>' + u.esc(x.o.course) + '（' + u.esc(db.clsName(x.o.classId)) + '）：</b>' + u.esc(x.p.note) + '</li>').join('') + '</ul>';
      }
    }
    h += '<h2>' + (list.length ? '三' : '二') + '、待办事项</h2>';
    h += todos.length ? '<ul>' + todos.map(t => '<li>' + u.esc(t.title) + (t.due ? '（截止 ' + t.due + '）' : '') + '</li>').join('') + '</ul>' : '<p>无未完成待办。</p>';
    h += '<p class="meta" style="margin-top:24pt">记录人：' + u.esc(S.settings.teacherName || '　　　　') + '　　　　日期：' + date + '</p>';
    TW.io.exportWord('教学工作日志_' + date, h, '教学工作日志_' + date);
    u.toast('工作记录已导出为 Word', 'ok');
  }

  TW.views.dashboard = { title: '工作台首页', render: render };
})(window.TW);
