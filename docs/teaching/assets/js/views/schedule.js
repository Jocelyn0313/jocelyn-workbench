/* =========================================================
   schedule.js  教学课表：周视图 / 进度台账 / 调课录入
   课后进度自动结转为下次课的课前进度
   ========================================================= */
(function (TW) {
  'use strict';
  const u = TW.u, db = TW.db, cal = TW.cal;
  TW.views = TW.views || {};

  let viewWeek = 0;   // 0 = 未初始化
  let mode = 'week';  // week | ledger | plan

  function render(host) {
    const S = TW.S;
    if (!viewWeek) viewWeek = cal.weekOf(u.today()) || 1;

    host.innerHTML =
      '<div class="page-head"><div>' +
      '<h2 class="page-title">教学课表</h2>' +
      '<div class="page-sub">' + cal.termLabel() + ' · 共' + (S.settings.totalWeeks || 20) + '教学周 · 上节课的课后进度自动结转为下节课的课前进度</div>' +
      '</div><div class="toolbar">' +
      '<button class="btn btn-sm' + (mode === 'week' ? ' btn-primary' : '') + '" data-mode="week">周视图</button>' +
      '<button class="btn btn-sm' + (mode === 'ledger' ? ' btn-primary' : '') + '" data-mode="ledger">授课进度台账</button>' +
      '<button class="btn btn-sm' + (mode === 'plan' ? ' btn-primary' : '') + '" data-mode="plan">课表设置</button>' +
      '</div></div><div id="schBody"></div>';

    u.$$('[data-mode]', host).forEach(b => b.onclick = () => { mode = b.dataset.mode; render(host); });

    const body = u.$('#schBody');
    if (mode === 'week') renderWeek(body, host);
    else if (mode === 'ledger') renderLedger(body, host);
    else renderPlan(body, host);
  }

  /* =============== 周视图 =============== */
  function renderWeek(box, host) {
    const S = TW.S, tw = S.settings.totalWeeks || 20;
    const curW = cal.weekOf(u.today());
    const todayStr = u.ymd(u.today());

    let wopts = '';
    for (let i = 1; i <= tw; i++) wopts += '<option value="' + i + '"' + (i === viewWeek ? ' selected' : '') + '>第' + i + '周（' + u.fmtCn(cal.dateOf(i, 1)) + '起）</option>';

    box.innerHTML =
      '<div class="card"><div class="card-head">' +
      '<div class="row"><button class="btn btn-sm" id="wPrev">‹ 上周</button>' +
      '<select class="select" id="wSel" style="width:210px">' + wopts + '</select>' +
      '<button class="btn btn-sm" id="wNext">下周 ›</button>' +
      '<button class="btn btn-sm btn-green" id="wNow">回到本周</button>' +
      (curW === viewWeek ? '<span class="tag t-green">本周</span>' : '') + '</div>' +
      '<div class="toolbar">' +
      '<button class="btn btn-sm btn-pink" id="btnAdjust">调课录入</button>' +
      '<button class="btn btn-sm" id="btnExpWeek">导出周课表</button>' +
      '</div></div>' +
      '<div style="overflow-x:auto"><div class="week-grid" id="wg"></div></div>' +
      '<div class="hint" style="margin-top:10px">点击课格填写授课内容与进度；空白格点击可快速新增课表条目。</div></div>' +
      '<div class="card"><div class="card-head"><h3 class="card-title k"><i class="dot"></i>调课 / 停课 / 补课记录</h3>' +
      '<button class="btn btn-sm btn-pink" id="btnAdjust2">＋ 调课录入</button></div><div id="adjBox"></div></div>';

    u.$('#wSel').onchange = e => { viewWeek = +e.target.value; render(host); };
    u.$('#wPrev').onclick = () => { viewWeek = Math.max(1, viewWeek - 1); render(host); };
    u.$('#wNext').onclick = () => { viewWeek = Math.min(tw, viewWeek + 1); render(host); };
    u.$('#wNow').onclick = () => { viewWeek = curW || 1; render(host); };
    u.$('#btnAdjust').onclick = u.$('#btnAdjust2').onclick = () => adjustDialog(() => render(host));
    u.$('#btnExpWeek').onclick = () => exportWeek(viewWeek);

    /* 网格 */
    const g = u.$('#wg');
    let h = '<div class="wg-h"><small>节次</small></div>';
    for (let d = 1; d <= 7; d++) {
      const ds = cal.dateOf(viewWeek, d);
      h += '<div class="wg-h' + (ds === todayStr ? ' today' : '') + '">周' + u.DAY_CN[d % 7] + '<small>' + u.fmtCn(ds) + '</small></div>';
    }
    S.periods.forEach(p => {
      h += '<div class="wg-p"><b>' + u.esc(p.name) + '</b><br>' + p.start + '<br>' + p.end + '</div>';
      for (let d = 1; d <= 7; d++) {
        const ds = cal.dateOf(viewWeek, d);
        const items = cal.lessonsOn(ds).filter(o => o.periodId === p.id);
        h += '<div class="wg-c' + (items.length ? ' has' : '') + '" data-date="' + ds + '" data-pid="' + p.id + '">' +
          items.map(o => {
            const pr = cal.progressOf(o);
            const cc = 'c' + db.colorOf(o.classId || o.course);
            return '<div class="wg-item ' + cc + '" data-key="' + o.date + '|' + o.scheduleId + '">' +
              '<b>' + u.esc(o.course || '课程') + '</b>' +
              '<small>' + u.esc(db.clsName(o.classId)) + (o.room ? ' · ' + u.esc(o.room) : '') + '</small>' +
              (o.flag === 'move' ? '<small style="color:var(--pink-600)">调课</small>' : '') +
              (o.flag === 'extra' ? '<small style="color:var(--amber-600)">补课</small>' : '') +
              (pr.content ? '<small style="color:var(--green-600)">✓ 已备</small>' : '') +
              '</div>';
          }).join('') + '</div>';
      }
    });
    g.innerHTML = h;

    u.$$('.wg-item', g).forEach(n => n.onclick = e => {
      e.stopPropagation();
      const [d, sid] = n.dataset.key.split('|');
      const occ = cal.lessonsOn(d).find(o => o.scheduleId === sid);
      if (occ) lessonDialog(occ, () => render(host));
    });
    u.$$('.wg-c', g).forEach(n => n.onclick = () => {
      const dow = u.isoDow(n.dataset.date);
      planDialog(null, { dow: dow, periodId: n.dataset.pid }, () => render(host));
    });

    renderAdjust(u.$('#adjBox'), host);
  }

  function renderAdjust(box, host) {
    const S = TW.S;
    const list = TW.term.adjustItems().slice().sort((a, b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1);
    if (!list.length) { box.innerHTML = '<div class="empty" style="padding:22px">暂无调课记录</div>'; return; }
    const TY = { move: ['调课', 't-pink'], cancel: ['停课', 't-red'], extra: ['补课', 't-amber'] };
    box.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>类型</th><th>原时间</th><th>调整为</th><th>班级 / 课程</th><th>事由</th><th></th></tr></thead><tbody>' +
      list.map(a => {
        const it = TW.term.scheduleItems().find(x => x.id === a.scheduleId);
        const t = TY[a.type] || ['调整', 't-gray'];
        return '<tr><td><span class="tag ' + t[1] + '">' + t[0] + '</span></td>' +
          '<td>' + (a.fromDate ? u.fmtCn(a.fromDate) + ' ' + (it ? cal.periodInfo(it.periodId).name : '') : '—') + '</td>' +
          '<td>' + (a.toDate ? u.fmtCn(a.toDate) + ' ' + cal.periodInfo(a.toPeriodId).name : '<span class="muted">不补</span>') + '</td>' +
          '<td>' + u.esc(db.clsName(a.classId || (it && it.classId))) + ' · ' + u.esc(a.course || (it && it.course) || '') + '</td>' +
          '<td class="ellipsis" style="max-width:200px">' + u.esc(a.reason || '') + '</td>' +
          '<td><button class="btn btn-sm btn-danger" data-del="' + a.id + '">撤销</button></td></tr>';
      }).join('') + '</tbody></table></div>';
    u.$$('[data-del]', box).forEach(b => b.onclick = () => u.confirm('撤销此调整，课表将恢复原状？', () => {
      S.adjustments = S.adjustments.filter(x => x.id !== b.dataset.del);
      db.save('adjustments'); u.toast('已撤销', 'ok'); render(host);
    }));
  }

  /* =============== 授课进度台账 =============== */
  function renderLedger(box, host) {
    const S = TW.S;
    const key = 'sch_ledger_cls';
    const selCls = sessionStorage.getItem(key) || '';
    box.innerHTML =
      '<div class="card"><div class="card-head">' +
      '<div class="row"><label class="hint">教学班</label>' +
      '<select class="select" id="lgCls" style="width:190px"><option value="">全部班级</option>' +
      TW.term.classesOf().map(c => '<option value="' + c.id + '"' + (selCls === c.id ? ' selected' : '') + '>' + u.esc(c.name) + '</option>').join('') +
      '</select>' +
      '<select class="select" id="lgRange" style="width:150px">' +
      '<option value="all">全学期</option><option value="past">已上课次</option><option value="future">未上课次</option></select>' +
      '</div>' +
      '<div class="toolbar"><button class="btn btn-sm" id="lgXlsx">导出 Excel</button>' +
      '<button class="btn btn-sm btn-purple" id="lgWord">导出 Word 台账</button>' +
      '<button class="btn btn-sm" id="lgPdf">导出 PDF</button></div></div>' +
      '<div id="lgTbl"></div></div>';

    const draw = () => {
      const cid = u.$('#lgCls').value, rg = u.$('#lgRange').value;
      sessionStorage.setItem(key, cid);
      const t = u.ymd(u.today());
      let list = cal.allOccurrences(cid ? { classId: cid } : null);
      if (rg === 'past') list = list.filter(o => o.date <= t);
      if (rg === 'future') list = list.filter(o => o.date > t);
      const el = u.$('#lgTbl');
      if (!list.length) { el.innerHTML = '<div class="empty"><span class="em-ic">📘</span>暂无课次，请先在「课表设置」中添加课程</div>'; return; }
      el.innerHTML = '<div class="tbl-wrap" style="max-height:66vh"><table class="tbl"><thead><tr>' +
        '<th class="sticky-l">序</th><th>日期</th><th>周次</th><th>节次</th><th>班级</th><th>课程</th>' +
        '<th style="min-width:150px">课前进度</th><th style="min-width:210px">授课内容</th><th style="min-width:150px">课后进度</th><th>状态</th><th></th>' +
        '</tr></thead><tbody>' +
        list.map((o, i) => {
          const p = cal.progressOf(o);
          const done = o.date < t || (o.date === t && u.hm2min(o.end) < u.hm2min(u.nowHm()));
          const st = p.content ? '<span class="tag t-green">已备课</span>' : (done ? '<span class="tag t-amber">待补记</span>' : '<span class="tag t-gray">未开始</span>');
          return '<tr><td class="sticky-l">' + (i + 1) + '</td><td>' + u.fmtCn(o.date) + '<br><span class="muted" style="font-size:10.5px">周' + u.DAY_CN[u.isoDow(o.date) % 7] + '</span></td>' +
            '<td>第' + o.week + '周</td><td>' + u.esc(o.pname) + '</td><td>' + u.esc(db.clsName(o.classId)) + '</td><td>' + u.esc(o.course) + '</td>' +
            '<td style="white-space:normal">' + (p.pre ? u.esc(p.pre) : '<span class="muted">—</span>') + '</td>' +
            '<td style="white-space:normal">' + (p.content ? u.esc(p.content) : '<span class="muted">—</span>') + '</td>' +
            '<td style="white-space:normal">' + (p.post ? u.esc(p.post) : '<span class="muted">—</span>') + '</td>' +
            '<td>' + st + (o.flag === 'move' ? ' <span class="tag t-pink">调</span>' : '') + (o.flag === 'extra' ? ' <span class="tag t-amber">补</span>' : '') + '</td>' +
            '<td><button class="btn btn-sm" data-k="' + o.date + '|' + o.scheduleId + '">填写</button></td></tr>';
        }).join('') + '</tbody></table></div>';
      u.$$('[data-k]', el).forEach(b => b.onclick = () => {
        const [d, sid] = b.dataset.k.split('|');
        const occ = cal.lessonsOn(d).find(x => x.scheduleId === sid);
        if (occ) lessonDialog(occ, draw);
      });
    };
    u.$('#lgCls').onchange = draw; u.$('#lgRange').onchange = draw;
    u.$('#lgXlsx').onclick = () => exportLedger('xlsx', u.$('#lgCls').value, u.$('#lgRange').value);
    u.$('#lgWord').onclick = () => exportLedger('word', u.$('#lgCls').value, u.$('#lgRange').value);
    u.$('#lgPdf').onclick = () => exportLedger('pdf', u.$('#lgCls').value, u.$('#lgRange').value);
    draw();
  }

  /* =============== 课表设置 =============== */
  function renderPlan(box, host) {
    const S = TW.S;
    box.innerHTML =
      '<div class="card"><div class="card-head"><h3 class="card-title"><i class="dot"></i>课表条目（周固定课）</h3>' +
      '<div class="toolbar">' +
      '<button class="btn btn-sm" id="pImp">Excel 导入</button>' +
      '<button class="btn btn-sm" id="pTpl">下载模板</button>' +
      '<button class="btn btn-sm btn-primary" id="pAdd">＋ 新增课表条目</button></div></div>' +
      '<div id="pList"></div>' +
      '<div class="hint" style="margin-top:10px">周次留空表示全学期每周上课；可填写如 1-8,10,12-16 的区间格式。</div></div>';

    u.$('#pAdd').onclick = () => planDialog(null, null, () => render(host));
    u.$('#pTpl').onclick = () => TW.io.exportTemplate(
      ['班级名称', '课程名称', '星期', '节次', '教室', '周次'],
      [['2025级英语1班', '大学英语', '周一', '第1-2节', 'A302', '1-16'],
      ['2025级英语1班', '大学英语', '周三', '第3-4节', 'A302', '1-16']],
      '课表导入模板.xlsx', '课表');
    u.$('#pImp').onclick = () => importPlan(() => render(host));

    const list = u.$('#pList');
    const sch = TW.term.scheduleItems();
    if (!sch.length) {
      list.innerHTML = '<div class="empty"><span class="em-ic">🗓️</span>还没有课表条目<br><span class="hint">新增后周视图与课堂记录的上课日期将自动生成</span></div>';
      return;
    }
    const sorted = sch.slice().sort((a, b) => a.dow - b.dow || u.hm2min(cal.periodInfo(a.periodId).start) - u.hm2min(cal.periodInfo(b.periodId).start));
    list.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
      '<th>星期</th><th>节次</th><th>班级</th><th>课程</th><th>教室</th><th>上课周次</th><th class="num">总课次</th><th></th></tr></thead><tbody>' +
      sorted.map(it => {
        const p = cal.periodInfo(it.periodId);
        const cnt = cal.allOccurrences({ scheduleId: it.id }).length;
        return '<tr><td>周' + u.DAY_CN[it.dow % 7] + '</td><td>' + u.esc(p.name) + '<br><span class="muted" style="font-size:10.5px">' + p.start + '-' + p.end + '</span></td>' +
          '<td>' + u.esc(db.clsName(it.classId)) + '</td><td><b>' + u.esc(it.course) + '</b></td><td>' + u.esc(it.room || '—') + '</td>' +
          '<td>' + weeksLabel(it) + '</td><td class="num">' + cnt + '</td>' +
          '<td class="nowrap"><button class="btn btn-sm" data-ed="' + it.id + '">编辑</button> <button class="btn btn-sm btn-danger" data-del="' + it.id + '">删除</button></td></tr>';
      }).join('') + '</tbody></table></div>';
    u.$$('[data-ed]', list).forEach(b => b.onclick = () => planDialog(b.dataset.ed, null, () => render(host)));
    u.$$('[data-del]', list).forEach(b => b.onclick = () => u.confirm('删除此课表条目？该课程的授课进度记录将保留但不再显示。', () => {
      TW.S.schedule = TW.S.schedule.filter(x => x.id !== b.dataset.del); db.save('schedule'); render(host);
    }));
  }

  function weeksLabel(it) {
    const tw = TW.S.settings.totalWeeks || 20;
    let base = '';
    if (!it.weeks || !it.weeks.length || it.weeks.length === tw) base = '全学期';
    else base = compress(it.weeks);
    if (it.weekType === 'odd') base += ' · 单周';
    if (it.weekType === 'even') base += ' · 双周';
    return base;
  }
  function compress(arr) {
    const a = arr.slice().sort((x, y) => x - y); const out = [];
    let s = a[0], p = a[0];
    for (let i = 1; i <= a.length; i++) {
      if (a[i] === p + 1) { p = a[i]; continue; }
      out.push(s === p ? '' + s : s + '-' + p); s = a[i]; p = a[i];
    }
    return out.join(',');
  }
  function expand(str, tw) {
    if (!str || !String(str).trim()) return [];
    const out = [];
    String(str).replace(/[，、]/g, ',').split(',').forEach(seg => {
      seg = seg.trim().replace(/周/g, '');
      if (!seg) return;
      const m = seg.match(/^(\d+)\s*[-~至]\s*(\d+)$/);
      if (m) { for (let i = +m[1]; i <= +m[2]; i++) if (i >= 1 && i <= tw) out.push(i); }
      else { const n = parseInt(seg, 10); if (n >= 1 && n <= tw) out.push(n); }
    });
    return Array.from(new Set(out)).sort((a, b) => a - b);
  }

  /* ---------- 弹窗：课表条目 ---------- */
  function planDialog(id, preset, done) {
    const S = TW.S, tw = S.settings.totalWeeks || 20;
    if (!S.classes.length) {
      u.confirm('还没有教学班，是否先去新增班级？', () => TW.go('settings'), '缺少班级');
      return;
    }
    const it = id ? S.schedule.find(x => x.id === id)
      : Object.assign({ id: u.uid('s'), dow: 1, periodId: (S.periods[0] || {}).id, classId: (TW.term.classesOf()[0] || {}).id, course: '大学英语', room: '', weeks: [], weekType: 'all' }, preset || {});
    const box = u.el('div');
    box.innerHTML = '<div class="form-grid">' +
      '<div class="field"><label>教学班 *</label><select class="select" id="fc">' +
      TW.term.classesOf().map(c => '<option value="' + c.id + '"' + (c.id === it.classId ? ' selected' : '') + '>' + u.esc(c.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>课程名称 *</label><input class="input" id="fcourse" value="' + u.esc(it.course || '') + '" list="courseList" placeholder="大学英语">' +
      '<datalist id="courseList">' + ['大学英语', '新概念英语', '英语B级考试辅导', '英语四级考试辅导', '英语语法', '英语音标', '英语听说'].map(x => '<option value="' + x + '">').join('') + '</datalist></div>' +
      '<div class="field"><label>星期</label><select class="select" id="fdow">' +
      [1, 2, 3, 4, 5, 6, 7].map(d => '<option value="' + d + '"' + (d === it.dow ? ' selected' : '') + '>周' + u.DAY_CN[d % 7] + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>节次</label><select class="select" id="fp">' +
      S.periods.map(p => '<option value="' + p.id + '"' + (p.id === it.periodId ? ' selected' : '') + '>' + u.esc(p.name) + ' ' + p.start + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>教室</label><input class="input" id="froom" value="' + u.esc(it.room || '') + '" placeholder="A302"></div>' +
      '<div class="field"><label>单双周</label><select class="select" id="fwt">' +
      [['all', '每周'], ['odd', '单周'], ['even', '双周']].map(x => '<option value="' + x[0] + '"' + (it.weekType === x[0] ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select></div>' +
      '<div class="field full"><label>上课周次（留空＝全学期 1-' + tw + '周）</label><input class="input" id="fw" value="' + (it.weeks && it.weeks.length ? compress(it.weeks) : '') + '" placeholder="如 1-8,10,12-16"></div>' +
      '</div>';
    u.modal({
      title: id ? '编辑课表条目' : '新增课表条目', body: box,
      buttons: [{ text: '取消', class: 'btn', onClick: (b, c) => c() },
      {
        text: '保存', class: 'btn btn-primary', onClick: (b, c) => {
          it.classId = b.querySelector('#fc').value;
          it.course = b.querySelector('#fcourse').value.trim() || '课程';
          it.dow = +b.querySelector('#fdow').value;
          it.periodId = b.querySelector('#fp').value;
          it.room = b.querySelector('#froom').value.trim();
          it.weekType = b.querySelector('#fwt').value;
          it.weeks = expand(b.querySelector('#fw').value, tw);
          if (!id) { it.termId = TW.term.currentId(); TW.S.schedule.push(it); }
          db.save('schedule'); db.emit('schedule:change'); c(); done && done(); u.toast('课表已更新', 'ok');
        }
      }]
    });
  }

  /* ---------- 弹窗：课次进度 ---------- */
  function lessonDialog(occ, done) {
    const p = cal.progressOf(occ);
    const inherited = cal.inheritedPre(occ);
    const box = u.el('div');
    box.innerHTML =
      '<div class="row" style="margin-bottom:12px;gap:8px">' +
      '<span class="tag t-blue">' + u.fmtCn(occ.date) + ' 周' + u.DAY_CN[u.isoDow(occ.date) % 7] + '</span>' +
      '<span class="tag t-purple">第' + occ.week + '周</span>' +
      '<span class="tag t-green">' + u.esc(occ.pname) + ' ' + occ.start + '-' + occ.end + '</span>' +
      '<span class="tag t-pink">' + u.esc(db.clsName(occ.classId)) + '</span>' +
      '<span class="tag t-gray">' + u.esc(occ.course) + '</span></div>' +

      '<div class="field" style="margin-bottom:12px"><label>课前进度' +
      (inherited ? '（已自动继承上次课后进度，如需修改可直接编辑）' : '（本课程首次课，可手动填写起点）') + '</label>' +
      '<textarea class="textarea" id="lPre" style="min-height:58px" placeholder="' + (inherited ? u.esc(inherited) : '如：Unit 1 Text A 已讲至 Para.5') + '">' + u.esc(p.pre) + '</textarea>' +
      (inherited ? '<div class="hint">自动继承：' + u.esc(inherited) + ' <a href="javascript:;" id="lReset" style="color:var(--blue-600)">恢复自动继承</a></div>' : '') +
      '</div>' +

      '<div class="field" style="margin-bottom:12px"><label>授课内容 *</label>' +
      '<textarea class="textarea" id="lContent" placeholder="本次课教学内容、重点难点、教学活动安排">' + u.esc(p.content) + '</textarea></div>' +

      '<div class="field" style="margin-bottom:12px"><label>课后进度（将自动成为下次课的课前进度）</label>' +
      '<textarea class="textarea" id="lPost" style="min-height:58px" placeholder="如：Unit 1 Text A 讲完，Exercise 1-3 已核对">' + u.esc(p.post) + '</textarea></div>' +

      '<div class="form-grid">' +
      '<div class="field"><label>课后作业</label><input class="input" id="lHw" value="' + u.esc(p.homework) + '" placeholder="Workbook P12-14"></div>' +
      '<div class="field"><label>完成状态</label><select class="select" id="lSt">' +
      [['', '未标记'], ['done', '已完成'], ['partial', '部分完成'], ['adjust', '内容有调整']].map(x =>
        '<option value="' + x[0] + '"' + (p.status === x[0] ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select></div>' +
      '<div class="field full"><label>课堂备注</label><textarea class="textarea" id="lNote" style="min-height:52px" placeholder="课堂反应、突发情况、需跟进事项">' + u.esc(p.note) + '</textarea></div>' +
      '</div>';

    const reset = box.querySelector('#lReset');
    if (reset) reset.onclick = () => { box.querySelector('#lPre').value = ''; u.toast('课前进度将自动继承', 'ok'); };

    u.modal({
      title: '备课与授课进度', body: box, wide: true,
      buttons: [
        {
          text: '写入反思', class: 'btn btn-purple', onClick: (b, c) => {
            const content = b.querySelector('#lContent').value.trim();
            c();
            TW.views.reflection.quickAdd({ date: occ.date, classId: occ.classId, title: occ.course + '｜' + u.fmtCn(occ.date), content: content ? '本次授课内容：' + content + '\n\n课堂问题：' : '' });
          }
        },
        { text: '取消', class: 'btn', onClick: (b, c) => c() },
        {
          text: '保存', class: 'btn btn-primary', onClick: (b, c) => {
            const pre = b.querySelector('#lPre').value.trim();
            db.setLesson(occ.date, occ.scheduleId, {
              pre: pre, preManual: !!pre && pre !== inherited,
              content: b.querySelector('#lContent').value.trim(),
              post: b.querySelector('#lPost').value.trim(),
              homework: b.querySelector('#lHw').value.trim(),
              status: b.querySelector('#lSt').value,
              note: b.querySelector('#lNote').value.trim(),
              classId: occ.classId, course: occ.course
            });
            db.emit('lesson:change'); c(); done && done(); u.toast('已保存，课后进度将结转至下次课', 'ok', 3000);
          }
        }]
    });
  }

  /* ---------- 弹窗：调课录入 ---------- */
  function adjustDialog(done) {
    const S = TW.S;
    const box = u.el('div');
    const defDate = u.ymd(u.today());
    box.innerHTML =
      '<div class="field" style="margin-bottom:12px"><label>调整类型</label>' +
      '<select class="select" id="aType"><option value="move">调课（原时间不上，改到新时间）</option>' +
      '<option value="cancel">停课（本次不上，不补）</option>' +
      '<option value="extra">补课（新增一次课）</option></select></div>' +
      '<div id="aOrigin">' +
      '<div class="form-grid">' +
      '<div class="field"><label>原上课日期</label><input class="input" type="date" id="aFrom" value="' + defDate + '"></div>' +
      '<div class="field"><label>原课次</label><select class="select" id="aSched"></select></div>' +
      '</div></div>' +
      '<div id="aTarget" style="margin-top:4px"><div class="form-grid">' +
      '<div class="field"><label>新日期</label><input class="input" type="date" id="aTo" value="' + defDate + '"></div>' +
      '<div class="field"><label>新节次</label><select class="select" id="aPeriod">' +
      S.periods.map(p => '<option value="' + p.id + '">' + u.esc(p.name) + ' ' + p.start + '</option>').join('') + '</select></div>' +
      '</div></div>' +
      '<div id="aExtra" style="display:none"><div class="form-grid">' +
      '<div class="field"><label>教学班</label><select class="select" id="aCls">' +
      TW.term.classesOf().map(c => '<option value="' + c.id + '">' + u.esc(c.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>课程名称</label><input class="input" id="aCourse" value="大学英语"></div>' +
      '<div class="field"><label>教室</label><input class="input" id="aRoom" placeholder="A302"></div>' +
      '</div></div>' +
      '<div class="field" style="margin-top:12px"><label>调整事由</label><input class="input" id="aReason" placeholder="如：校运会、教师公出、法定节假日顺延"></div>' +
      '<div class="hint" style="margin-top:8px">提交后课表、课堂记录的上课日期、授课进度链会同步更新。</div>';

    const fillSched = () => {
      const d = box.querySelector('#aFrom').value;
      const list = d ? cal.lessonsOn(d).filter(o => o.flag !== 'extra') : [];
      box.querySelector('#aSched').innerHTML = list.length
        ? list.map(o => '<option value="' + o.scheduleId + '">' + u.esc(o.pname) + ' · ' + u.esc(db.clsName(o.classId)) + ' · ' + u.esc(o.course) + '</option>').join('')
        : '<option value="">该日无课</option>';
    };
    const sync = () => {
      const t = box.querySelector('#aType').value;
      box.querySelector('#aOrigin').style.display = t === 'extra' ? 'none' : '';
      box.querySelector('#aTarget').style.display = t === 'cancel' ? 'none' : '';
      box.querySelector('#aExtra').style.display = t === 'extra' ? '' : 'none';
    };
    box.querySelector('#aType').onchange = sync;
    box.querySelector('#aFrom').onchange = fillSched;
    fillSched(); sync();

    u.modal({
      title: '调课录入', body: box,
      buttons: [{ text: '取消', class: 'btn', onClick: (b, c) => c() },
      {
        text: '提交并更新课表', class: 'btn btn-primary', onClick: (b, c) => {
          const t = b.querySelector('#aType').value;
          const a = { id: u.uid('adj'), type: t, reason: b.querySelector('#aReason').value.trim(), createdAt: new Date().toISOString() };
          if (t !== 'extra') {
            a.fromDate = b.querySelector('#aFrom').value;
            a.scheduleId = b.querySelector('#aSched').value;
            if (!a.scheduleId) { u.toast('请选择原课次', 'warn'); return; }
          }
          if (t !== 'cancel') {
            a.toDate = b.querySelector('#aTo').value;
            a.toPeriodId = b.querySelector('#aPeriod').value;
            if (!a.toDate) { u.toast('请选择新日期', 'warn'); return; }
          }
          if (t === 'extra') {
            a.classId = b.querySelector('#aCls').value;
            a.course = b.querySelector('#aCourse').value.trim() || '补课';
            a.room = b.querySelector('#aRoom').value.trim();
          }
          a.termId = TW.term.currentId(); TW.S.adjustments.push(a); db.save('adjustments'); db.emit('schedule:change');
          c(); done && done(); u.toast('课表已同步更新', 'ok');
        }
      }]
    });
  }

  /* ---------- 导入课表 ---------- */
  async function importPlan(done) {
    const f = await u.pickFile('.xlsx,.xls,.csv'); if (!f) return;
    const tw = TW.S.settings.totalWeeks || 20;
    try {
      const rows = await TW.io.readSheet(f);
      let n = 0, miss = [];
      rows.forEach(r => {
        const cn = String(TW.io.pick(r, ['班级名称', '班级', '教学班'])).trim();
        const course = String(TW.io.pick(r, ['课程名称', '课程'])).trim();
        if (!cn || !course) return;
        let c = TW.S.classes.find(x => x.name === cn);
        if (!c) { c = { id: u.uid('c'), name: cn, dept: '', grade: '', note: '', termId: TW.term.currentId() }; TW.S.classes.push(c); }
        const dowRaw = String(TW.io.pick(r, ['星期', '周几', '上课星期'])).trim();
        const dow = parseDow(dowRaw);
        const pRaw = String(TW.io.pick(r, ['节次', '时间', '上课节次'])).trim();
        let p = TW.S.periods.find(x => x.name === pRaw) || TW.S.periods.find(x => pRaw && x.name.indexOf(pRaw) >= 0);
        if (!p) { miss.push(pRaw); p = TW.S.periods[0]; }
        TW.S.schedule.push({
          id: u.uid('s'), classId: c.id, course: course, dow: dow, periodId: p ? p.id : '',
          room: String(TW.io.pick(r, ['教室', '地点'])).trim(),
          weeks: expand(TW.io.pick(r, ['周次', '上课周次']), tw), weekType: 'all'
        });
        n++;
      });
      db.save(); db.emit('schedule:change');
      u.toast('导入 ' + n + ' 条课表' + (miss.length ? '，' + miss.length + ' 条节次未匹配已归入首节次' : ''), 'ok', 3600);
      done && done();
    } catch (e) { u.toast('导入失败：' + e.message, 'err', 4000); }
  }
  function parseDow(s) {
    const map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7, '天': 7 };
    const m = String(s).match(/[一二三四五六日天]/);
    if (m) return map[m[0]];
    const n = parseInt(String(s).replace(/\D/g, ''), 10);
    return n >= 1 && n <= 7 ? n : 1;
  }

  /* ---------- 导出 ---------- */
  function exportWeek(w) {
    const S = TW.S;
    const aoa = [['节次'].concat([1, 2, 3, 4, 5, 6, 7].map(d => '周' + u.DAY_CN[d % 7] + ' ' + u.fmtCn(cal.dateOf(w, d))))];
    S.periods.forEach(p => {
      const row = [p.name + '\n' + p.start + '-' + p.end];
      for (let d = 1; d <= 7; d++) {
        const items = cal.lessonsOn(cal.dateOf(w, d)).filter(o => o.periodId === p.id);
        row.push(items.map(o => {
          const pr = cal.progressOf(o);
          return o.course + '\n' + db.clsName(o.classId) + (o.room ? '\n' + o.room : '') + (pr.content ? '\n内容：' + pr.content : '');
        }).join('\n---\n'));
      }
      aoa.push(row);
    });
    TW.io.exportBook([{ name: '第' + w + '周课表', aoa: aoa, cols: [{ wch: 14 }].concat(Array(7).fill({ wch: 24 })) }],
      cal.termLabel() + '_第' + w + '周课表.xlsx');
    u.toast('周课表已导出', 'ok');
  }

  function exportLedger(type, cid, rg) {
    const t = u.ymd(u.today());
    let list = cal.allOccurrences(cid ? { classId: cid } : null);
    if (rg === 'past') list = list.filter(o => o.date <= t);
    if (rg === 'future') list = list.filter(o => o.date > t);
    if (!list.length) { u.toast('没有可导出的课次', 'warn'); return; }
    const title = cal.termLabel() + ' 授课进度台账' + (cid ? '（' + db.clsName(cid) + '）' : '');

    if (type === 'xlsx') {
      TW.io.exportRows(list.map((o, i) => {
        const p = cal.progressOf(o);
        return {
          序号: i + 1, 日期: o.date, 星期: '周' + u.DAY_CN[u.isoDow(o.date) % 7], 教学周: '第' + o.week + '周',
          节次: o.pname, 班级: db.clsName(o.classId), 课程: o.course, 教室: o.room,
          课前进度: p.pre, 授课内容: p.content, 课后进度: p.post, 作业: p.homework, 备注: p.note,
          类型: o.flag === 'move' ? '调课' : (o.flag === 'extra' ? '补课' : '正常')
        };
      }), title + '.xlsx', '授课台账');
      u.toast('Excel 已导出', 'ok'); return;
    }

    const rows = list.map((o, i) => {
      const p = cal.progressOf(o);
      return '<tr><td>' + (i + 1) + '</td><td>' + o.date + '<br>周' + u.DAY_CN[u.isoDow(o.date) % 7] + '</td><td>第' + o.week + '周</td>' +
        '<td>' + u.esc(o.pname) + '</td><td>' + u.esc(db.clsName(o.classId)) + '</td><td>' + u.esc(o.course) + '</td>' +
        '<td>' + u.esc(p.pre) + '</td><td>' + u.esc(p.content) + '</td><td>' + u.esc(p.post) + '</td><td>' + u.esc(p.homework) + '</td></tr>';
    }).join('');
    const html = '<h1>' + u.esc(title) + '</h1><div class="sub">授课教师：' + u.esc(TW.S.settings.teacherName || '　　　') +
      '　　制表日期：' + u.ymd(u.today()) + '　　共 ' + list.length + ' 课次</div>' +
      '<table><thead><tr><th>序号</th><th>日期</th><th>周次</th><th>节次</th><th>班级</th><th>课程</th><th>课前进度</th><th>授课内容</th><th>课后进度</th><th>作业</th></tr></thead><tbody>' +
      rows + '</tbody></table>';
    if (type === 'word') { TW.io.exportWord(title, html, title); u.toast('Word 台账已导出', 'ok'); }
    else TW.io.exportPDF(title, html);
  }

  TW.views.schedule = {
    title: '教学课表', render: render,
    openLesson: lessonDialog,
    gotoWeek: w => { viewWeek = w; mode = 'week'; }
  };
})(window.TW);
