/* =========================================================
   research.js  四、科研工作（一）：今日科研 / 科研日历 / 文献雷达 / 科研复盘
   ========================================================= */
window.JZ.views = window.JZ.views || {};
(function (JZ) {
  'use strict';
  const u = JZ.u, db = JZ.db, cal = JZ.cal, ui = JZ.ui;

  const T_TYPES = ['读文献', '写作', '数据处理', '实验调查', '投稿事务', '课题事务', '会议', '其它'];

  function dirs() { return (JZ.S.settings.researchDirs || []).filter(Boolean); }
  function projOpts(all) {
    const arr = [{ v: '', t: '不关联项目' }];
    JZ.S.projects.filter(p => all || p.status !== '已结题').forEach(p => arr.push({ v: p.id, t: (p.kind === 'topic' ? '［课题］' : '［个人］') + p.name }));
    return arr;
  }
  function projName(id) { const p = db.one('projects', id); return p ? p.name : ''; }

  const TASK_F = () => [
    { k: 'title', label: '任务', required: true, full: true },
    { k: 'date', label: '计划日期', type: 'date' },
    { k: 'type', label: '类型', type: 'select', opts: T_TYPES, def: '读文献' },
    { k: 'projectId', label: '关联项目', type: 'select', opts: projOpts(true) },
    { k: 'minutes', label: '预计用时（分钟）', type: 'number', def: 45, min: 0 },
    { k: 'note', label: '备注 / 具体做什么', type: 'textarea', rows: 3, full: true }
  ];

  /* ================= 1 今日科研 ================= */
  JZ.views.rsToday = {
    render: function (host) {
      const t = u.ymd(u.today()), S = JZ.S;
      const body = ui.page(host, {
        title: '今日科研',
        sub: cal.termLabel() + '　' + cal.weekText(t) + '　每天固定投入，是科研唯一可靠的复利来源',
        actions: [
          { text: '＋今日任务', class: 'btn-primary', onClick: () => ui.editRecord('rsTasks', TASK_F(), null, { name: '任务', wide: true, preset: { date: t, done: false } }, () => JZ.go('rsToday')) },
          { text: '写今日日记', class: 'btn-purple', onClick: () => diaryModal(t, () => JZ.go('rsToday')) },
          { text: '去文献雷达', onClick: () => JZ.go('rsRadar') }
        ]
      });

      /* 指标 */
      const todayTasks = S.rsTasks.filter(x => x.date === t);
      const doneT = todayTasks.filter(x => x.done);
      const wk = cal.weekOf(t), r = wk ? cal.weekRange(wk) : null;
      const wkTasks = r ? S.rsTasks.filter(x => x.date >= r.start && x.date <= r.end && x.done) : [];
      const wkMin = wkTasks.reduce((a, b) => a + (u.num(b.minutes) || 0), 0);
      const dTarget = u.num(S.settings.hourTarget) || 2;
      const todayMin = doneT.reduce((a, b) => a + (u.num(b.minutes) || 0), 0);
      const unread = S.radar.filter(x => !x.read).length;
      body.innerHTML += ui.stats([
        { k: '今日任务', v: doneT.length + ' / ' + todayTasks.length, x: todayTasks.length ? '完成率 ' + Math.round(doneT.length / todayTasks.length * 100) + '%' : '还没有安排' },
        { k: '今日投入', v: (todayMin / 60).toFixed(1) + ' h', x: '目标 ' + dTarget + ' h', tone: 'p' },
        { k: '本周投入', v: (wkMin / 60).toFixed(1) + ' h', x: '第' + (wk || '-') + '周累计' },
        { k: '待读文献', v: unread, x: '文献雷达未读', tone: 'k' }
      ]);

      /* 今日任务清单 */
      const taskBox = u.el('div');
      body.appendChild(ui.card({
        title: '今日任务清单', count: todayTasks.length,
        actions: [
          { text: '顺延未完成到明天', class: 'btn-sm', onClick: postpone }
        ],
        body: taskBox
      }));
      drawTasks();
      function drawTasks() {
        const list = S.rsTasks.filter(x => x.date === t).sort((a, b) => (a.done === b.done) ? 0 : (a.done ? 1 : -1));
        taskBox.innerHTML = list.length ? list.map(x =>
          '<div class="item ' + (x.done ? 'ok' : 'hl') + '" data-id="' + x.id + '"><div class="item-h">' +
          '<div class="row" style="gap:9px;align-items:flex-start"><span class="chk' + (x.done ? ' on' : '') + '" data-a="tg"></span><div>' +
          '<div class="item-t" style="' + (x.done ? 'text-decoration:line-through;opacity:.6' : '') + '">' + u.esc(x.title) + '</div>' +
          (x.note ? '<div class="item-x">' + u.esc(x.note) + '</div>' : '') +
          '<div class="item-f"><span class="tag t-blue">' + u.esc(x.type || '') + '</span>' +
          '<span class="tag t-gray">' + (u.num(x.minutes) || 0) + ' 分钟</span>' +
          (x.projectId ? '<span class="tag t-purple">' + u.esc(projName(x.projectId)) + '</span>' : '') +
          '</div></div></div><div class="row">' +
          '<button class="btn btn-sm" data-a="ed">改</button><button class="btn btn-sm btn-danger" data-a="rm">删</button>' +
          '</div></div></div>').join('') : ui.empty('今天还没有安排科研任务，哪怕只读一篇也好', '📖');
        u.$$('.item', taskBox).forEach(it => {
          const rec = db.one('rsTasks', it.dataset.id);
          u.$('[data-a="tg"]', it).onclick = () => { db.upd('rsTasks', rec.id, { done: !rec.done, doneAt: Date.now() }); JZ.go('rsToday'); };
          u.$('[data-a="ed"]', it).onclick = () => ui.editRecord('rsTasks', TASK_F(), rec, { name: '任务', wide: true }, () => JZ.go('rsToday'));
          u.$('[data-a="rm"]', it).onclick = () => ui.confirmDel(rec.title, () => { db.del('rsTasks', rec.id); JZ.go('rsToday'); });
        });
      }
      function postpone() {
        const n = S.rsTasks.filter(x => x.date === t && !x.done);
        if (!n.length) { u.toast('今日任务都已完成', 'ok'); return; }
        const tm = u.ymd(u.addDays(u.today(), 1));
        n.forEach(x => db.upd('rsTasks', x.id, { date: tm }));
        u.toast('已顺延 ' + n.length + ' 条到明天', 'ok'); JZ.go('rsToday');
      }

      /* 当前进度 */
      const act = S.projects.filter(p => p.status !== '已结题').sort((a, b) => (u.num(b.pct) || 0) - (u.num(a.pct) || 0));
      const pg = u.el('div');
      pg.innerHTML = act.length ? act.map(p => {
        const lits = S.lits.filter(l => l.projectId === p.id).length;
        const last = S.progress.filter(x => x.projectId === p.id).sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1)[0];
        return '<div class="item hl" data-id="' + p.id + '" data-kind="' + p.kind + '"><div class="item-h"><div style="min-width:0;flex:1">' +
          '<div class="item-t">' + (p.kind === 'topic' ? '📜 ' : '🖋 ') + u.esc(p.name) + '</div>' +
          '<div class="item-f"><span class="tag t-blue">' + u.esc(p.status || '') + '</span>' +
          (p.endDate ? '<span class="tag ' + (u.diffDays(p.endDate, t) < 0 ? 't-red' : 't-amber') + '">结题 ' + u.esc(p.endDate) + '　' + cal.dueText(p.endDate) + '</span>' : '') +
          '<span class="tag t-gray">文献 ' + lits + '</span>' +
          (last ? '<span class="tag t-purple">最近 ' + u.esc(last.date) + '　' + u.esc((last.title || '').slice(0, 18)) + '</span>' : '') +
          '</div><div style="margin-top:8px">' + ui.bar(u.num(p.pct) || 0) + '</div></div>' +
          '<button class="btn btn-sm" data-a="go">进入</button></div></div>';
      }).join('') : ui.empty('还没有在研项目，去「课题研究」或「个人研究」建立一个', '🧭');
      body.appendChild(ui.card({ title: '当前研究进度', tone: 'p', count: act.length, body: pg }));
      u.$$('.item[data-kind]', pg).forEach(it => {
        u.$('[data-a="go"]', it).onclick = () => JZ.go(it.dataset.kind === 'topic' ? 'rsTopic' : 'rsPersonal', it.dataset.id);
      });

      /* 今日文献推荐 */
      const need = u.num(S.settings.litTarget) || 3;
      const pool = S.radar.filter(x => !x.read).sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1);
      const rec = pool.slice(0, need);
      const rb = u.el('div');
      rb.innerHTML = rec.length ? rec.map(x =>
        '<div class="item hl" data-id="' + x.id + '"><div class="item-h"><div style="min-width:0">' +
        '<div class="item-t">' + u.esc(x.title) + '</div>' +
        (x.note ? '<div class="item-x">' + u.esc(x.note) + '</div>' : '') +
        '<div class="item-f"><span class="tag t-purple">' + u.esc(x.dir || '未分类') + '</span>' +
        (x.source ? '<span class="tag t-gray">' + u.esc(x.source) + '</span>' : '') +
        (x.date ? '<span class="tag t-blue">' + u.esc(x.date) + '</span>' : '') +
        (x.url ? '<a class="tag t-green" href="' + u.esc(x.url) + '" target="_blank">打开 ↗</a>' : '') + '</div></div>' +
        '<div class="row"><button class="btn btn-sm btn-green" data-a="read">已读</button>' +
        '<button class="btn btn-sm" data-a="lib">收入文献库</button></div></div></div>').join('')
        : ui.empty('雷达里没有待读条目，去文献雷达补充今日更新', '📡');
      body.appendChild(ui.card({
        title: '今日文献推荐（每日 ' + need + ' 篇）', tone: 'k',
        actions: [{ text: '去雷达', class: 'btn-sm', onClick: () => JZ.go('rsRadar') }],
        body: rb
      }));
      u.$$('.item', rb).forEach(it => {
        const x = db.one('radar', it.dataset.id);
        u.$('[data-a="read"]', it).onclick = () => { db.upd('radar', x.id, { read: true }); JZ.go('rsToday'); };
        u.$('[data-a="lib"]', it).onclick = () => JZ.radarToLit(x, () => JZ.go('rsToday'));
      });

      /* 今日日记 */
      const d = S.rsDiary.find(x => x.date === t);
      body.appendChild(ui.card({
        title: '今日科研日记', tone: 'g',
        body: ui.textBlock({
          title: t + '　' + (wk ? '第' + wk + '周' : '假期'), rows: 5, value: d ? d.content : '',
          ph: '今天做了什么、卡在哪里、明天从哪继续…',
          onSave: v => {
            const ex = JZ.S.rsDiary.find(x => x.date === t);
            if (ex) db.upd('rsDiary', ex.id, { content: v });
            else db.add('rsDiary', { date: t, content: v, hours: 0, tags: '' });
          }
        })
      }));
    }
  };

  /* 日记弹窗（供日历与今日共用） */
  function diaryModal(date, after) {
    const ex = JZ.S.rsDiary.find(x => x.date === date);
    ui.editModal({
      title: '科研日记 · ' + date + (cal.weekOf(date) ? '（第' + cal.weekOf(date) + '周）' : ''),
      wide: true,
      fields: [
        { k: 'content', label: '今日记录', type: 'textarea', rows: 8, full: true, ph: '进展、困难、想法、明日计划' },
        { k: 'hours', label: '有效投入（小时）', type: 'number', step: '0.5', min: 0, def: 0 },
        { k: 'mood', label: '状态', type: 'select', opts: ['高效', '正常', '一般', '低效'], def: '正常' },
        { k: 'tags', label: '标签', ph: '如 写作 / 数据' }
      ],
      value: ex || {},
      onOk: d => {
        if (ex) db.upd('rsDiary', ex.id, d);
        else db.add('rsDiary', Object.assign({ date: date }, d));
        u.toast('日记已保存', 'ok'); after && after();
      }
    });
  }
  JZ.diaryModal = diaryModal;

  /* ================= 2 科研日历 ================= */
  JZ.views.rsCal = {
    render: function (host) {
      const S = JZ.S;
      let mode = JZ.viewState.rsCalMode || 'month';
      const now = u.parseYmd(u.today());
      let y = JZ.viewState.rsCalY || now.getFullYear();
      let m = JZ.viewState.rsCalM || (now.getMonth() + 1);
      let wsel = JZ.viewState.rsCalW || cal.weekOf(u.today()) || 1;

      const body = ui.page(host, {
        title: '科研日历',
        sub: '按月看全貌、按周写日记，所有周次与教学校历一致',
        actions: [
          { text: '写今天的日记', class: 'btn-primary', onClick: () => diaryModal(u.ymd(u.today()), () => JZ.go('rsCal')) },
          { text: '导出本月日记', onClick: expMonth },
          { text: '导出本学期日记', onClick: expTerm }
        ]
      });
      const box = u.el('div');
      body.appendChild(box);
      draw();

      function draw() {
        box.innerHTML = '';
        box.appendChild(ui.tabs([{ k: 'month', t: '月视图' }, { k: 'week', t: '周视图 · 日记' }], mode,
          k => { mode = k; JZ.viewState.rsCalMode = k; draw(); }));
        mode === 'month' ? drawMonth() : drawWeek();
      }

      function drawMonth() {
        const cells = cal.monthGrid(y, m), t = u.ymd(u.today());
        const head = u.el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:12px;flex-wrap:wrap' });
        head.innerHTML = '<div class="row"><button class="btn btn-sm" data-a="pv">← 上月</button>' +
          '<b style="font-size:16px;padding:0 8px">' + y + ' 年 ' + m + ' 月</b>' +
          '<button class="btn btn-sm" data-a="nx">下月 →</button>' +
          '<button class="btn btn-sm btn-ghost" data-a="td">回到本月</button></div>' +
          '<div class="hint">🔵任务　🟢日记　🌸截止 / 会议</div>';
        box.appendChild(head);
        u.$('[data-a="pv"]', head).onclick = () => { m--; if (m < 1) { m = 12; y--; } JZ.viewState.rsCalY = y; JZ.viewState.rsCalM = m; draw(); };
        u.$('[data-a="nx"]', head).onclick = () => { m++; if (m > 12) { m = 1; y++; } JZ.viewState.rsCalY = y; JZ.viewState.rsCalM = m; draw(); };
        u.$('[data-a="td"]', head).onclick = () => { y = now.getFullYear(); m = now.getMonth() + 1; JZ.viewState.rsCalY = y; JZ.viewState.rsCalM = m; draw(); };

        const g = u.el('div', { class: 'mcal' });
        let html = ['一', '二', '三', '四', '五', '六', '日'].map(d => '<div class="mc-h">' + d + '</div>').join('');
        cells.forEach(c => {
          const tk = S.rsTasks.filter(x => x.date === c.date);
          const dy = S.rsDiary.find(x => x.date === c.date);
          const ddl = S.venues.filter(v => v.deadline === c.date).map(v => v.name)
            .concat(S.subs.filter(s => s.submitDate === c.date).map(s => '投稿 ' + s.title));
          html += '<div class="mc-d' + (c.inMonth ? '' : ' out') + (c.date === t ? ' today' : '') + '" data-d="' + c.date + '">' +
            '<div class="mc-n"><span>' + c.day + '</span><small>' + (c.week ? '第' + c.week + '周' : '') + '</small></div>' +
            (tk.length ? '<div class="mc-t">📌 任务 ' + tk.filter(x => x.done).length + '/' + tk.length + '</div>' : '') +
            (dy && dy.content ? '<div class="mc-t g">✍ ' + u.esc(dy.content.slice(0, 10)) + '</div>' : '') +
            (ddl.length ? '<div class="mc-t k">⏰ ' + u.esc(ddl[0].slice(0, 10)) + '</div>' : '') + '</div>';
        });
        g.innerHTML = html;
        box.appendChild(ui.card({ title: y + '年' + m + '月　科研安排总览', body: g }));
        u.$$('.mc-d', g).forEach(c => c.onclick = () => dayPanel(c.dataset.d));
      }

      function drawWeek() {
        const total = u.num(S.settings.totalWeeks) || 20;
        const head = u.el('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap;margin-bottom:12px' });
        head.innerHTML = '<button class="btn btn-sm" data-a="pv">← 上一周</button>' +
          '<select class="select" style="width:auto" id="wkSel">' +
          cal.weeks().map(w => '<option value="' + w.w + '"' + (w.w === wsel ? ' selected' : '') + '>第' + w.w + '周（' + w.start + ' 至 ' + w.end + '）</option>').join('') +
          '</select><button class="btn btn-sm" data-a="nx">下一周 →</button>' +
          '<button class="btn btn-sm btn-ghost" data-a="tw">回到本周</button>';
        box.appendChild(head);
        u.$('[data-a="pv"]', head).onclick = () => { wsel = Math.max(1, wsel - 1); JZ.viewState.rsCalW = wsel; draw(); };
        u.$('[data-a="nx"]', head).onclick = () => { wsel = Math.min(total, wsel + 1); JZ.viewState.rsCalW = wsel; draw(); };
        u.$('[data-a="tw"]', head).onclick = () => { wsel = cal.weekOf(u.today()) || 1; JZ.viewState.rsCalW = wsel; draw(); };
        u.$('#wkSel', head).onchange = e => { wsel = +e.target.value; JZ.viewState.rsCalW = wsel; draw(); };

        const rows = u.el('div');
        let hrs = 0, cnt = 0;
        let html = '';
        for (let i = 1; i <= 7; i++) {
          const date = cal.dateOf(wsel, i);
          const d = S.rsDiary.find(x => x.date === date);
          const tk = S.rsTasks.filter(x => x.date === date);
          if (d) { hrs += u.num(d.hours) || 0; if ((d.content || '').trim()) cnt++; }
          html += '<div class="wk-row"><div class="wk-d"><b>周' + u.DAY_CN[i % 7] + '</b>' + date +
            (date === u.ymd(u.today()) ? '<span class="tag t-pink" style="margin-top:4px;display:inline-block">今天</span>' : '') +
            (tk.length ? '<div class="hint">任务 ' + tk.filter(x => x.done).length + '/' + tk.length + '</div>' : '') +
            (d && u.num(d.hours) ? '<div class="hint">' + u.num(d.hours) + ' 小时</div>' : '') + '</div>' +
            '<div class="wk-c' + (d && d.content ? '' : ' emp') + '" data-d="' + date + '">' +
            (d && d.content ? u.esc(d.content) : '点此记录当天科研进展…') + '</div></div>';
        }
        rows.innerHTML = html;
        box.appendChild(ui.card({
          title: '第' + wsel + '周　科研日记', tone: 'g',
          hint: '有记录 ' + cnt + '/7 天　累计 ' + hrs + ' 小时',
          body: rows
        }));
        u.$$('.wk-c', rows).forEach(c => c.onclick = () => diaryModal(c.dataset.d, draw));
      }

      function dayPanel(date) {
        const tk = S.rsTasks.filter(x => x.date === date);
        const d = S.rsDiary.find(x => x.date === date);
        const wrap = u.el('div');
        wrap.innerHTML = '<div class="row" style="gap:8px;margin-bottom:10px;flex-wrap:wrap">' +
          '<span class="tag t-blue">' + u.fmtCn(date) + '</span>' +
          (cal.weekOf(date) ? '<span class="tag t-purple">第' + cal.weekOf(date) + '周 周' + u.DAY_CN[u.isoDow(date) % 7] + '</span>' : '<span class="tag t-gray">学期外</span>') + '</div>' +
          '<h4 style="margin:10px 0 6px;font-size:13.5px">当日任务</h4>' +
          (tk.length ? tk.map(x => '<div class="item ' + (x.done ? 'ok' : 'hl') + '"><div class="item-t">' +
            (x.done ? '✅ ' : '⬜ ') + u.esc(x.title) + '</div><div class="item-f"><span class="tag t-gray">' + u.esc(x.type || '') + '</span>' +
            (x.projectId ? '<span class="tag t-purple">' + u.esc(projName(x.projectId)) + '</span>' : '') + '</div></div>').join('')
            : '<div class="hint">当天没有安排任务</div>') +
          '<h4 style="margin:14px 0 6px;font-size:13.5px">当日日记</h4>' +
          '<div class="item-x">' + (d && d.content ? u.esc(d.content) : '（空）') + '</div>';
        u.modal({
          title: '科研日 · ' + date, body: wrap, autofocus: false,
          buttons: [
            { text: '＋加任务', class: 'btn', onClick: (b, c) => { c(); ui.editRecord('rsTasks', TASK_F(), null, { name: '任务', wide: true, preset: { date: date, done: false } }, draw); } },
            { text: '写日记', class: 'btn btn-purple', onClick: (b, c) => { c(); diaryModal(date, draw); } },
            { text: '关闭', class: 'btn btn-primary', onClick: (b, c) => c() }
          ]
        });
      }

      function expMonth() {
        const pre = y + '-' + u.pad(m);
        const rows = S.rsDiary.filter(x => (x.date || '').indexOf(pre) === 0).sort((a, b) => a.date < b.date ? -1 : 1);
        if (!rows.length) { u.toast('本月还没有日记', 'warn'); return; }
        JZ.io.exportRows(rows.map(x => ({
          日期: x.date, 周次: cal.weekOf(x.date) ? '第' + cal.weekOf(x.date) + '周' : '',
          投入小时: x.hours || 0, 状态: x.mood || '', 标签: x.tags || '', 内容: x.content || ''
        })), '科研日记_' + pre + '.xlsx', '科研日记');
        u.toast('已导出', 'ok');
      }
      function expTerm() {
        const r = cal.termRange();
        const rows = S.rsDiary.filter(x => x.date >= r.start && x.date <= r.end).sort((a, b) => a.date < b.date ? -1 : 1);
        if (!rows.length) { u.toast('本学期还没有日记', 'warn'); return; }
        const hrs = rows.reduce((a, b) => a + (u.num(b.hours) || 0), 0);
        JZ.io.exportWord('科研日记汇编',
          '<h1>科研日记汇编</h1><div class="sub">' + cal.termLabel() + '　' + r.start + ' 至 ' + r.end +
          '　共 ' + rows.length + ' 天　累计 ' + hrs + ' 小时</div>' +
          rows.map(x => '<h3>' + x.date + (cal.weekOf(x.date) ? '（第' + cal.weekOf(x.date) + '周）' : '') +
            '　' + (x.hours ? x.hours + 'h' : '') + '　' + u.esc(x.mood || '') + '</h3>' +
            '<p>' + u.esc(x.content || '').replace(/\n/g, '<br>') + '</p>').join(''),
          '科研日记汇编_' + (JZ.S.settings.schoolYear || ''));
        u.toast('Word已生成', 'ok');
      }
    }
  };

  /* ================= 3 文献雷达 ================= */
  const RADAR_F = () => [
    { k: 'title', label: '文献标题', required: true, full: true },
    { k: 'dir', label: '研究方向', type: 'select', opts: [''].concat(dirs()) },
    { k: 'source', label: '来源', ph: '如 现代外语 / Applied Linguistics' },
    { k: 'date', label: '发现日期', type: 'date' },
    { k: 'url', label: '链接', full: true, ph: 'https://' },
    { k: 'note', label: '一句话要点', type: 'textarea', rows: 3, full: true }
  ];

  /** 雷达条目转入项目文献库 */
  JZ.radarToLit = function (x, after) {
    ui.editModal({
      title: '收入文献库', wide: true,
      fields: [
        { k: 'title', label: '标题', required: true, full: true },
        { k: 'projectId', label: '归入项目', type: 'select', opts: projOpts(true) },
        { k: 'authors', label: '作者' },
        { k: 'year', label: '年份' },
        { k: 'source', label: '期刊 / 出处' },
        { k: 'dir', label: '研究方向', type: 'select', opts: [''].concat(dirs()) },
        { k: 'url', label: '链接', full: true },
        { k: 'summary', label: '摘要 / 要点', type: 'textarea', rows: 4, full: true }
      ],
      value: { title: x.title, source: x.source || '', url: x.url || '', dir: x.dir || '', summary: x.note || '', projectId: x.projectId || '' },
      onOk: d => {
        db.add('lits', Object.assign({ status: '待读' }, d));
        db.upd('radar', x.id, { read: true });
        u.toast('已收入文献库', 'ok'); after && after();
      }
    });
  };

  JZ.views.rsRadar = {
    render: function (host) {
      const S = JZ.S;
      let dir = JZ.viewState.radarDir || '';
      let onlyNew = JZ.viewState.radarNew !== false;

      const body = ui.page(host, {
        title: '文献雷达',
        sub: '按研究方向持续跟踪，每天固定时间扫一遍，有价值的直接收入文献库',
        actions: [
          { text: '＋登记文献', class: 'btn-primary', onClick: () => ui.editRecord('radar', RADAR_F(), null, { name: '文献', wide: true, preset: { date: u.ymd(u.today()), read: false, dir: dir } }, () => JZ.go('rsRadar')) },
          { text: 'Excel批量导入', onClick: imp },
          { text: '下载导入模板', onClick: tpl },
          { text: '导出雷达', onClick: exp }
        ]
      });

      body.appendChild(ui.card({
        title: '文献检索入口', tone: 'p',
        body: ui.linkZone({ cat: 'rs.radar', title: '常用文献源', tip: '数图文献平台与 ResearchGate 已预置，可自行添加知网、Web of Science、Google Scholar 等' })
      }));

      /* 方向筛选 */
      const dl = dirs();
      const filt = u.el('div', { class: 'row', style: 'gap:10px;flex-wrap:wrap;margin-bottom:12px' });
      filt.innerHTML = '<div class="badges"><span class="chip' + (dir ? '' : ' on') + '" data-d="">全部方向 ' + S.radar.length + '</span>' +
        dl.map(d => '<span class="chip' + (dir === d ? ' on' : '') + '" data-d="' + u.esc(d) + '">' + u.esc(d) + ' ' +
          S.radar.filter(x => x.dir === d).length + '</span>').join('') +
        '<span class="chip' + (dir === '__none' ? ' on' : '') + '" data-d="__none">未分类 ' + S.radar.filter(x => !x.dir).length + '</span></div>' +
        '<label class="row" style="gap:5px;font-size:12.5px;margin-left:auto"><input type="checkbox" id="rdNew"' + (onlyNew ? ' checked' : '') + '>只看未读</label>' +
        '<button class="btn btn-sm" id="rdDirs">管理研究方向</button>';
      body.appendChild(filt);
      u.$$('.chip', filt).forEach(c => c.onclick = () => { dir = c.dataset.d; JZ.viewState.radarDir = dir; JZ.go('rsRadar'); });
      u.$('#rdNew', filt).onchange = e => { onlyNew = e.target.checked; JZ.viewState.radarNew = onlyNew; JZ.go('rsRadar'); };
      u.$('#rdDirs', filt).onclick = () => JZ.go('settings');

      /* 按日期分组 */
      let list = S.radar.filter(x => {
        if (dir === '__none') { if (x.dir) return false; }
        else if (dir && x.dir !== dir) return false;
        if (onlyNew && x.read) return false;
        return true;
      }).sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1);

      const groups = {};
      list.forEach(x => { const d = x.date || '未标日期'; (groups[d] = groups[d] || []).push(x); });
      const keys = Object.keys(groups).sort((a, b) => a < b ? 1 : -1);

      const gb = u.el('div');
      if (!keys.length) gb.innerHTML = ui.empty(onlyNew ? '没有未读条目，切换筛选看全部' : '还没有登记文献，先点右上角「登记文献」', '📡');
      keys.forEach(k => {
        const sec = u.el('div', { style: 'margin-bottom:14px' });
        sec.innerHTML = '<div class="fz-head"><span class="fz-title">' + u.esc(k) +
          (k !== '未标日期' && cal.weekOf(k) ? '　第' + cal.weekOf(k) + '周' : '') +
          '<span class="tag t-gray" style="margin-left:6px">' + groups[k].length + '</span></span></div>' +
          groups[k].map(x =>
            '<div class="item ' + (x.read ? 'ok' : 'hl') + '" data-id="' + x.id + '"><div class="item-h"><div style="min-width:0">' +
            '<div class="item-t">' + (x.star ? '⭐ ' : '') + u.esc(x.title) + '</div>' +
            (x.note ? '<div class="item-x">' + u.esc(x.note) + '</div>' : '') +
            '<div class="item-f"><span class="tag t-purple">' + u.esc(x.dir || '未分类') + '</span>' +
            (x.source ? '<span class="tag t-gray">' + u.esc(x.source) + '</span>' : '') +
            (x.url ? '<a class="tag t-green" href="' + u.esc(x.url) + '" target="_blank">原文 ↗</a>' : '') +
            (x.read ? '<span class="tag t-blue">已读</span>' : '') + '</div></div>' +
            '<div class="row"><button class="btn btn-sm" data-a="star">' + (x.star ? '取消星' : '标星') + '</button>' +
            '<button class="btn btn-sm" data-a="read">' + (x.read ? '标未读' : '标已读') + '</button>' +
            '<button class="btn btn-sm btn-purple" data-a="lib">收入文献库</button>' +
            '<button class="btn btn-sm" data-a="ed">改</button>' +
            '<button class="btn btn-sm btn-danger" data-a="rm">删</button></div></div></div>').join('');
        gb.appendChild(sec);
      });
      body.appendChild(ui.card({
        title: '每日更新', count: list.length,
        hint: '共 ' + S.radar.length + ' 条，未读 ' + S.radar.filter(x => !x.read).length + ' 条',
        body: gb
      }));
      u.$$('.item', gb).forEach(it => {
        const x = db.one('radar', it.dataset.id);
        u.$('[data-a="star"]', it).onclick = () => { db.upd('radar', x.id, { star: !x.star }); JZ.go('rsRadar'); };
        u.$('[data-a="read"]', it).onclick = () => { db.upd('radar', x.id, { read: !x.read }); JZ.go('rsRadar'); };
        u.$('[data-a="lib"]', it).onclick = () => JZ.radarToLit(x, () => JZ.go('rsRadar'));
        u.$('[data-a="ed"]', it).onclick = () => ui.editRecord('radar', RADAR_F(), x, { name: '文献', wide: true }, () => JZ.go('rsRadar'));
        u.$('[data-a="rm"]', it).onclick = () => ui.confirmDel(x.title, () => { db.del('radar', x.id); JZ.go('rsRadar'); });
      });

      body.appendChild(ui.card({
        title: '雷达相关文件', tone: 'g',
        body: ui.fileZone({ cat: 'rs.radar.file', refId: '', title: 'PDF 全文、检索式、导出题录', hint: '批量下载的 PDF 与 RIS/BibTeX 题录可存于此' })
      }));

      function exp() {
        if (!S.radar.length) { u.toast('雷达为空', 'warn'); return; }
        JZ.io.exportRows(S.radar.map(x => ({
          发现日期: x.date || '', 研究方向: x.dir || '', 标题: x.title, 来源: x.source || '',
          链接: x.url || '', 要点: x.note || '', 状态: x.read ? '已读' : '未读', 标星: x.star ? '★' : ''
        })), '文献雷达_' + u.ymd(u.today()) + '.xlsx', '文献雷达');
        u.toast('已导出', 'ok');
      }
      function tpl() {
        JZ.io.exportTemplate(['标题', '研究方向', '来源', '发现日期', '链接', '要点'],
          [['Task-based Language Teaching 最新进展', '大学英语教学', 'Applied Linguistics', u.ymd(u.today()), 'https://', '任务型教学在高职场景的适配性']],
          '文献雷达导入模板.xlsx', '模板');
        u.toast('模板已下载', 'ok');
      }
      async function imp() {
        const f = await u.pickFile('.xlsx,.xls,.csv'); if (!f) return;
        try {
          const rows = await JZ.io.readSheet(f);
          let n = 0;
          rows.forEach(r => {
            const title = JZ.io.pick(r, ['标题', '文献标题', 'Title']);
            if (!title) return;
            db.add('radar', {
              title: String(title), dir: String(JZ.io.pick(r, ['研究方向', '方向', '分类']) || ''),
              source: String(JZ.io.pick(r, ['来源', '期刊', 'Source']) || ''),
              date: fmtD(JZ.io.pick(r, ['发现日期', '日期', '时间'])) || u.ymd(u.today()),
              url: String(JZ.io.pick(r, ['链接', 'URL', 'DOI']) || ''),
              note: String(JZ.io.pick(r, ['要点', '摘要', '备注']) || ''), read: false, star: false
            });
            n++;
          });
          u.toast('已导入 ' + n + ' 条', 'ok'); JZ.go('rsRadar');
        } catch (e) { u.toast('导入失败：' + e.message, 'err', 4000); }
      }
    }
  };

  /* ================= 4 科研复盘 ================= */
  const REV_F = () => [
    { k: 'title', label: '复盘主题', required: true, full: true, ph: '如 2026年3月月度复盘' },
    { k: 'date', label: '复盘日期', type: 'date' },
    { k: 'scope', label: '周期', type: 'select', opts: ['周复盘', '月复盘', '学期复盘', '年度复盘', '项目复盘'], def: '月复盘' },
    { k: 'projectId', label: '关联项目', type: 'select', opts: projOpts(true) },
    { k: 'gain', label: '做成了什么（事实与数据）', type: 'textarea', rows: 4, full: true },
    { k: 'problem', label: '卡在哪里（真实障碍）', type: 'textarea', rows: 4, full: true },
    { k: 'improve', label: '下一步怎么改（可执行）', type: 'textarea', rows: 4, full: true },
    { k: 'tags', label: '标签' }
  ];

  JZ.views.rsReview = {
    render: function (host) {
      const S = JZ.S, t = u.ymd(u.today());
      const body = ui.page(host, {
        title: '科研复盘',
        sub: '定期回看事实与数据，避免用勤奋掩盖方向错误',
        actions: [
          { text: '＋写复盘', class: 'btn-primary', onClick: () => ui.editRecord('reviews', REV_F(), null, { name: '复盘', wide: true, preset: { date: t, scope: '月复盘' } }, () => JZ.go('rsReview')) },
          { text: '生成本月数据快照', class: 'btn-purple', onClick: snapshot },
          { text: '导出复盘Word', onClick: expWord }
        ]
      });

      /* 数据快照 */
      const mPre = t.slice(0, 7);
      const mTasks = S.rsTasks.filter(x => (x.date || '').indexOf(mPre) === 0);
      const mDiary = S.rsDiary.filter(x => (x.date || '').indexOf(mPre) === 0);
      const mHours = mDiary.reduce((a, b) => a + (u.num(b.hours) || 0), 0) +
        mTasks.filter(x => x.done).reduce((a, b) => a + (u.num(b.minutes) || 0), 0) / 60;
      const mLits = S.lits.filter(x => (u.ymd(new Date(x.createdAt || Date.now()))).indexOf(mPre) === 0);
      const mOut = S.outputs.filter(x => (x.date || '').indexOf(mPre) === 0);
      body.innerHTML += ui.stats([
        { k: '本月完成任务', v: mTasks.filter(x => x.done).length + ' / ' + mTasks.length, x: mPre },
        { k: '本月投入', v: mHours.toFixed(1) + ' h', x: '日均 ' + (mHours / new Date().getDate()).toFixed(1) + ' h', tone: 'p' },
        { k: '本月新增文献', v: mLits.length, x: '已读 ' + mLits.filter(x => x.status === '已读' || x.status === '精读').length },
        { k: '本月学术产出', v: mOut.length, x: '论文 / 项目 / 获奖', tone: 'k' }
      ]);

      const list = S.reviews.slice().sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1);
      const lb = u.el('div');
      lb.innerHTML = list.length ? list.map(x =>
        '<div class="item hl" data-id="' + x.id + '"><div class="item-h"><div style="min-width:0;flex:1">' +
        '<div class="item-t">🪞 ' + u.esc(x.title) + '</div>' +
        '<div class="item-f"><span class="tag t-blue">' + u.esc(x.scope || '') + '</span>' +
        '<span class="tag t-gray">' + u.esc(x.date || '') + '</span>' +
        (x.projectId ? '<span class="tag t-purple">' + u.esc(projName(x.projectId)) + '</span>' : '') +
        (x.tags ? '<span class="tag t-pink">' + u.esc(x.tags) + '</span>' : '') + '</div>' +
        (x.gain ? '<div class="item-x"><b>做成：</b>' + u.esc(x.gain) + '</div>' : '') +
        (x.problem ? '<div class="item-x"><b>卡点：</b>' + u.esc(x.problem) + '</div>' : '') +
        (x.improve ? '<div class="item-x"><b>改进：</b>' + u.esc(x.improve) + '</div>' : '') +
        '</div><div class="row"><button class="btn btn-sm" data-a="ed">改</button>' +
        '<button class="btn btn-sm btn-danger" data-a="rm">删</button></div></div></div>').join('')
        : ui.empty('还没有复盘记录，建议每月末写一次', '🪞');
      body.appendChild(ui.card({ title: '复盘记录', count: list.length, body: lb }));
      u.$$('.item', lb).forEach(it => {
        const x = db.one('reviews', it.dataset.id);
        u.$('[data-a="ed"]', it).onclick = () => ui.editRecord('reviews', REV_F(), x, { name: '复盘', wide: true }, () => JZ.go('rsReview'));
        u.$('[data-a="rm"]', it).onclick = () => ui.confirmDel(x.title, () => { db.del('reviews', x.id); JZ.go('rsReview'); });
      });

      function snapshot() {
        const txt = '本月完成任务 ' + mTasks.filter(x => x.done).length + '/' + mTasks.length +
          '；投入 ' + mHours.toFixed(1) + ' 小时；新增文献 ' + mLits.length + ' 篇；学术产出 ' + mOut.length + ' 项；' +
          '日记记录 ' + mDiary.filter(x => (x.content || '').trim()).length + ' 天。';
        ui.editRecord('reviews', REV_F(), null, {
          name: '复盘', wide: true,
          preset: { date: t, scope: '月复盘', title: mPre + ' 月度复盘', gain: txt }
        }, () => JZ.go('rsReview'));
      }
      function expWord() {
        if (!list.length) { u.toast('还没有复盘记录', 'warn'); return; }
        JZ.io.exportWord('科研复盘汇编',
          '<h1>科研复盘汇编</h1><div class="sub">' + (S.settings.ownerName || '') + '　制表 ' + t + '　共 ' + list.length + ' 篇</div>' +
          list.map(x => '<h2>' + u.esc(x.title) + '</h2>' +
            '<p class="meta">' + u.esc(x.date || '') + '　' + u.esc(x.scope || '') + (x.projectId ? '　' + u.esc(projName(x.projectId)) : '') + '</p>' +
            '<h3>做成了什么</h3><p>' + u.esc(x.gain || '—').replace(/\n/g, '<br>') + '</p>' +
            '<h3>卡在哪里</h3><p>' + u.esc(x.problem || '—').replace(/\n/g, '<br>') + '</p>' +
            '<h3>下一步怎么改</h3><p>' + u.esc(x.improve || '—').replace(/\n/g, '<br>') + '</p>').join(''),
          '科研复盘汇编_' + t);
        u.toast('Word已生成', 'ok');
      }
    }
  };

  /* 通用：Excel 日期规整 */
  function fmtD(v) {
    if (!v) return '';
    const s = String(v).trim();
    let m = s.match(/^(\d{4})[-\/年.](\d{1,2})[-\/月.](\d{1,2})/);
    if (m) return m[1] + '-' + u.pad(+m[2]) + '-' + u.pad(+m[3]);
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : u.ymd(d);
  }
})(window.JZ);
