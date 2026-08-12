/* =========================================================
   classroom.js  课堂记录区：花名册 / 出勤 / 课堂得分 / 平时成绩
   横向为上课日期（按课表自动识别），纵向为学生
   ========================================================= */
(function (TW) {
  'use strict';
  const u = TW.u, db = TW.db, cal = TW.cal;
  TW.views = TW.views || {};

  const ATT = [
    { v: '', k: '—', cls: 'a-none' },
    { v: 'normal', k: '正常出勤', s: '正常', cls: 'a-normal' },
    { v: 'leave', k: '请假', s: '请假', cls: 'a-leave' },
    { v: 'late', k: '迟到', s: '迟到', cls: 'a-late' },
    { v: 'early', k: '早退', s: '早退', cls: 'a-early' },
    { v: 'absent', k: '旷课', s: '旷课', cls: 'a-absent' }
  ];
  const attInfo = v => ATT.find(a => a.v === (v || '')) || ATT[0];

  let curCls = '', range = 'past';

  function render(host) {
    const S = TW.S;
    if (!S.classes.length) {
      host.innerHTML = '<div class="page-head"><h2 class="page-title">课堂记录</h2></div>' +
        '<div class="card"><div class="empty"><span class="em-ic">🏫</span>请先在「基础设置」中创建教学班<br>' +
        '<button class="btn btn-primary" style="margin-top:12px" onclick="TW.go(\'settings\')">去创建班级</button></div></div>';
      return;
    }
    if (!curCls || !db.cls(curCls)) curCls = TW.term.classesOf()[0] ? TW.term.classesOf()[0].id : '';

    host.innerHTML =
      '<div class="page-head"><div>' +
      '<h2 class="page-title">课堂记录</h2>' +
      '<div class="page-sub">上课日期依据课表与调课记录自动生成 · 出勤与课堂得分实时保存 · 平时成绩自动汇总</div>' +
      '</div><div class="toolbar">' +
      '<button class="btn btn-sm" id="cRoll">课堂点名</button>' +
      '<button class="btn btn-sm" id="cImp">导入花名册</button>' +
      '<button class="btn btn-sm" id="cTpl">花名册模板</button>' +
      '<button class="btn btn-sm btn-purple" id="cExp">导出</button>' +
      '</div></div>' +

      '<div class="card"><div class="row" style="gap:9px">' +
      '<label class="hint">教学班</label>' +
      '<select class="select" id="cSel" style="width:190px">' +
      TW.term.classesOf().map(c => '<option value="' + c.id + '"' + (curCls === c.id ? ' selected' : '') + '>' + u.esc(c.name) + '（' + db.students(c.id).length + '人）</option>').join('') +
      '</select>' +
      '<select class="select" id="cRange" style="width:150px">' +
      [['past', '已上课次'], ['all', '全学期课次'], ['month', '近30天']].map(x => '<option value="' + x[0] + '"' + (range === x[0] ? ' selected' : '') + '>' + x[1] + '</option>').join('') +
      '</select>' +
      '<button class="btn btn-sm btn-green" id="cAddStu">＋ 学生</button>' +
      '<span class="spacer"></span>' +
      '<span class="hint" id="cStat"></span>' +
      '</div></div>' +
      '<div style="margin-top:16px" id="cTable"></div>' +
      '<div style="margin-top:16px" id="cSummary"></div>';

    u.$('#cSel').onchange = e => { curCls = e.target.value; render(host); };
    u.$('#cRange').onchange = e => { range = e.target.value; render(host); };
    u.$('#cImp').onclick = () => importRoster(curCls, () => render(host));
    u.$('#cTpl').onclick = () => TW.io.exportTemplate(['学号', '姓名', '性别', '备注'],
      [['2025010101', '张三', '男', ''], ['2025010102', '李四', '女', '']], '花名册导入模板.xlsx', '花名册');
    u.$('#cAddStu').onclick = () => addStudent(curCls, () => render(host));
    u.$('#cRoll').onclick = () => rollCall(curCls, () => render(host));
    u.$('#cExp').onclick = () => exportMenu(curCls);

    drawTable(host);
  }

  function dates(cid) {
    const all = cal.classDates(cid);
    const t = u.ymd(u.today());
    if (range === 'past') return all.filter(d => d <= t);
    if (range === 'month') { const s = u.ymd(u.addDays(u.today(), -30)); return all.filter(d => d >= s && d <= t); }
    return all;
  }

  function rec(cid, date, sid) {
    const c = TW.S.records[cid]; if (!c) return null;
    const d = c[date]; if (!d) return null;
    return d[sid] || null;
  }
  function setRec(cid, date, sid, patch) {
    const S = TW.S;
    S.records[cid] = S.records[cid] || {};
    S.records[cid][date] = S.records[cid][date] || {};
    S.records[cid][date][sid] = Object.assign({ a: '', s: null }, S.records[cid][date][sid] || {}, patch);
    db.save('records');
  }
  function totalOf(cid, sid) {
    const S = TW.S, base = u.num(S.settings.scoreBase, 0);
    let sum = 0;
    const c = S.records[cid] || {};
    Object.keys(c).forEach(d => {
      const r = c[d][sid];
      if (r && r.s !== null && r.s !== undefined && r.s !== '') sum += u.num(r.s, 0);
    });
    const bonus = u.num((S.bonus[cid] || {})[sid], 0);
    return { score: u.round(sum, 1), bonus: bonus, total: u.round(base + sum + bonus, 1) };
  }
  function attStat(cid, sid) {
    const c = TW.S.records[cid] || {}, o = { normal: 0, leave: 0, late: 0, early: 0, absent: 0, none: 0 };
    Object.keys(c).forEach(d => {
      const r = c[d][sid];
      if (r && r.a) o[r.a] = (o[r.a] || 0) + 1; else o.none++;
    });
    return o;
  }

  function drawTable(host) {
    const S = TW.S, cid = curCls;
    const stu = db.students(cid);
    const ds = dates(cid);
    const box = u.$('#cTable');

    if (!stu.length) {
      box.innerHTML = '<div class="card"><div class="empty"><span class="em-ic">📋</span>该班尚未导入花名册<br>' +
        '<span class="hint">Excel 需包含「学号」「姓名」两列，可下载模板</span><br>' +
        '<button class="btn btn-primary" style="margin-top:12px" id="cImp2">导入花名册</button></div></div>';
      u.$('#cImp2').onclick = () => importRoster(cid, () => render(host));
      u.$('#cSummary').innerHTML = '';
      return;
    }
    if (!ds.length) {
      box.innerHTML = '<div class="card"><div class="empty"><span class="em-ic">🗓️</span>该班在所选范围内没有上课日期<br>' +
        '<span class="hint">请先在「教学课表 → 课表设置」中为该班添加课表条目</span><br>' +
        '<button class="btn btn-primary" style="margin-top:12px" onclick="TW.go(\'schedule\')">去设置课表</button></div></div>';
      u.$('#cSummary').innerHTML = '';
      return;
    }

    const opts = ATT.map(a => '<option value="' + a.v + '">' + a.k + '</option>').join('');
    let h = '<div class="card" style="padding:0;overflow:hidden">' +
      '<div class="tbl-wrap" style="max-height:70vh;border:none;border-radius:0"><table class="tbl"><thead><tr>' +
      '<th class="sticky-l" style="min-width:44px">序</th>' +
      '<th class="sticky-l2" style="left:44px;min-width:104px">学号</th>' +
      '<th class="sticky-l2" style="left:148px;min-width:82px">姓名</th>';
    ds.forEach(d => {
      const w = cal.weekOf(d);
      h += '<th style="min-width:86px;text-align:center">' + u.fmtCn(d) +
        '<br><span class="muted" style="font-weight:400;font-size:10px">周' + u.DAY_CN[u.isoDow(d) % 7] + ' · 第' + w + '周</span></th>';
    });
    h += '<th class="num" style="min-width:70px;background:var(--purple-50)">课堂得分</th>' +
      '<th class="num bonus-cell" style="min-width:80px">竞赛加分</th>' +
      '<th class="num" style="min-width:86px;background:var(--green-50)">平时总分</th></tr></thead><tbody>';

    stu.forEach((s, i) => {
      const t = totalOf(cid, s.id);
      h += '<tr data-sid="' + s.id + '">' +
        '<td class="sticky-l">' + (i + 1) + '</td>' +
        '<td class="sticky-l2" style="left:44px">' + u.esc(s.sno || '') + '</td>' +
        '<td class="sticky-l2" style="left:148px"><b>' + u.esc(s.name) + '</b></td>';
      ds.forEach(d => {
        const r = rec(cid, d, s.id) || {};
        const ai = attInfo(r.a);
        h += '<td style="padding:4px 5px"><div class="cell-2">' +
          '<select class="att-sel ' + ai.cls + '" data-a="' + d + '" data-s="' + s.id + '">' + opts + '</select>' +
          '<input class="sc-inp" type="number" step="0.5" data-sc="' + d + '" data-s="' + s.id + '" placeholder="分" value="' + (r.s === null || r.s === undefined ? '' : r.s) + '">' +
          '</div></td>';
      });
      h += '<td class="num" style="background:var(--purple-50);font-weight:600">' + t.score + '</td>' +
        '<td class="num bonus-cell"><input class="sc-inp" type="number" step="0.5" data-bn="' + s.id + '" value="' + (t.bonus || '') + '" placeholder="0"></td>' +
        '<td class="num total-cell" style="background:var(--green-50)" data-tt="' + s.id + '">' + t.total + '</td></tr>';
    });
    h += '</tbody></table></div></div>';
    box.innerHTML = h;

    // 回填 select 选中值
    u.$$('select[data-a]', box).forEach(sel => {
      const r = rec(cid, sel.dataset.a, sel.dataset.s);
      sel.value = (r && r.a) || '';
    });

    /* 事件委托 */
    box.addEventListener('change', e => {
      const t = e.target;
      if (t.matches('select[data-a]')) {
        setRec(cid, t.dataset.a, t.dataset.s, { a: t.value });
        t.className = 'att-sel ' + attInfo(t.value).cls;
        refreshStat();
      } else if (t.matches('input[data-sc]')) {
        const v = t.value === '' ? null : u.num(t.value, 0);
        setRec(cid, t.dataset.sc, t.dataset.s, { s: v });
        refreshRow(t.dataset.s);
      } else if (t.matches('input[data-bn]')) {
        TW.S.bonus[cid] = TW.S.bonus[cid] || {};
        TW.S.bonus[cid][t.dataset.bn] = t.value === '' ? 0 : u.num(t.value, 0);
        db.save('bonus'); refreshRow(t.dataset.bn);
      }
    });
    box.addEventListener('dblclick', e => {
      const th = e.target.closest('th');
      if (!th) return;
      const idx = Array.from(th.parentNode.children).indexOf(th) - 3;
      if (idx >= 0 && idx < ds.length) markAllNormal(ds[idx]);
    });

    function refreshRow(sid) {
      const t = totalOf(cid, sid);
      const tr = box.querySelector('tr[data-sid="' + sid + '"]');
      if (!tr) return;
      tr.children[tr.children.length - 3].textContent = t.score;
      tr.children[tr.children.length - 1].textContent = t.total;
      refreshStat();
    }
    function markAllNormal(d) {
      u.confirm('将 ' + u.fmtCn(d) + ' 全班标记为「正常出勤」？已有记录会被覆盖。', () => {
        stu.forEach(s => setRec(cid, d, s.id, { a: 'normal' }));
        drawTable(host); u.toast('已批量标记', 'ok');
      });
    }

    drawSummary(cid, ds, stu);
    refreshStat();

    function refreshStat() {
      const el = u.$('#cStat'); if (!el) return;
      let n = 0, ab = 0, marked = 0;
      stu.forEach(s => ds.forEach(d => {
        const r = rec(cid, d, s.id);
        n++; if (r && r.a) marked++;
        if (r && (r.a === 'absent')) ab++;
      }));
      el.innerHTML = '应记录 ' + n + ' 人次 · 已记 ' + marked + ' · 旷课 ' + ab +
        ' · 记录率 ' + (n ? Math.round(marked / n * 100) : 0) + '% <span class="muted">（双击日期表头可批量标记全勤）</span>';
    }
  }

  /* ---------- 汇总统计 ---------- */
  function drawSummary(cid, ds, stu) {
    const box = u.$('#cSummary'); if (!box) return;
    const agg = { normal: 0, leave: 0, late: 0, early: 0, absent: 0 };
    stu.forEach(s => { const o = attStat(cid, s.id); Object.keys(agg).forEach(k => agg[k] += o[k] || 0); });
    const data = [
      { k: '正常出勤', v: agg.normal, color: '#4ade80' },
      { k: '请假', v: agg.leave, color: '#60a5fa' },
      { k: '迟到', v: agg.late, color: '#fbbf24' },
      { k: '早退', v: agg.early, color: '#a78bfa' },
      { k: '旷课', v: agg.absent, color: '#f87171' }
    ];
    const totals = stu.map(s => totalOf(cid, s.id).total);
    const avg = totals.length ? u.round(totals.reduce((a, b) => a + b, 0) / totals.length, 1) : 0;
    const rank = stu.map(s => ({ n: s.name, t: totalOf(cid, s.id).total })).sort((a, b) => b.t - a.t).slice(0, 8);

    box.innerHTML = '<div class="grid g3">' +
      '<div class="card"><div class="card-head"><h3 class="card-title g"><i class="dot"></i>出勤构成</h3></div>' +
      '<div class="chart-box">' + u.donutChart(data, { centerLabel: '人次' }) + '</div>' + u.legend(data) + '</div>' +

      '<div class="card"><div class="card-head"><h3 class="card-title p"><i class="dot"></i>平时成绩分布</h3>' +
      '<span class="hint">班级均分 ' + avg + '</span></div>' +
      '<div class="chart-box">' + u.barChart(distribute(totals), { height: 220 }) + '</div></div>' +

      '<div class="card"><div class="card-head"><h3 class="card-title k"><i class="dot"></i>平时成绩前 8 名</h3></div>' +
      (rank.length ? '<div class="tbl-wrap" style="border:none"><table class="tbl"><tbody>' +
        rank.map((r, i) => '<tr><td style="width:34px">' + medal(i) + '</td><td>' + u.esc(r.n) + '</td><td class="num total-cell">' + r.t + '</td></tr>').join('') +
        '</tbody></table></div>' : '<div class="empty">暂无数据</div>') + '</div>' +
      '</div>';
  }
  function medal(i) { return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1); }
  function distribute(arr) {
    if (!arr.length) return [{ k: '暂无', v: 0 }];
    const max = Math.max.apply(null, arr) || 1;
    const step = Math.max(1, Math.ceil(max / 5));
    const buckets = [];
    for (let i = 0; i < 5; i++) {
      const lo = i * step, hi = (i + 1) * step;
      buckets.push({ k: lo + '-' + hi, v: arr.filter(x => x >= lo && (i === 4 ? x <= hi : x < hi)).length });
    }
    return buckets;
  }

  /* ---------- 花名册 ---------- */
  async function importRoster(cid, done) {
    const f = await u.pickFile('.xlsx,.xls,.csv'); if (!f) return;
    try {
      const rows = await TW.io.readSheet(f);
      const list = [];
      rows.forEach(r => {
        const name = String(TW.io.pick(r, ['姓名', '学生姓名', '名字'])).trim();
        if (!name) return;
        list.push({
          id: u.uid('st'), sno: String(TW.io.pick(r, ['学号', '学籍号', '编号'])).trim(),
          name: name, gender: String(TW.io.pick(r, ['性别'])).trim(),
          note: String(TW.io.pick(r, ['备注'])).trim()
        });
      });
      if (!list.length) { u.toast('未识别到学生数据，请检查是否包含「姓名」列', 'warn', 4000); return; }
      const exist = db.students(cid).length;
      const apply = mode => {
        if (mode === 'replace') TW.S.roster[cid] = list;
        else {
          const cur = TW.S.roster[cid] || [];
          const names = new Set(cur.map(x => (x.sno || '') + '|' + x.name));
          list.forEach(x => { if (!names.has((x.sno || '') + '|' + x.name)) cur.push(x); });
          TW.S.roster[cid] = cur;
        }
        db.save('roster'); db.emit('roster:change');
        u.toast('花名册导入完成，共 ' + db.students(cid).length + ' 人', 'ok'); done && done();
      };
      if (exist) {
        u.modal({
          title: '导入花名册', body: '<div style="line-height:1.9">该班已有 <b>' + exist + '</b> 名学生，本次识别到 <b>' + list.length + '</b> 名。<br>请选择导入方式：</div>',
          buttons: [
            { text: '取消', class: 'btn', onClick: (b, c) => c() },
            { text: '追加新增', class: 'btn btn-green', onClick: (b, c) => { c(); apply('merge'); } },
            { text: '覆盖替换', class: 'btn btn-danger', onClick: (b, c) => { c(); apply('replace'); } }
          ]
        });
      } else apply('replace');
    } catch (e) { u.toast('导入失败：' + e.message, 'err', 4000); }
  }

  function addStudent(cid, done) {
    const box = u.el('div');
    box.innerHTML = '<div class="form-grid">' +
      '<div class="field"><label>学号</label><input class="input" id="sN"></div>' +
      '<div class="field"><label>姓名 *</label><input class="input" id="sM"></div>' +
      '<div class="field"><label>性别</label><select class="select" id="sG"><option value=""></option><option>男</option><option>女</option></select></div>' +
      '<div class="field"><label>备注</label><input class="input" id="sR"></div></div>' +
      '<div class="divider"></div><div class="hint">已有学生：' + db.students(cid).length + ' 人，可在下方管理</div>' +
      '<div id="stuList" style="max-height:240px;overflow:auto;margin-top:8px"></div>';
    const drawStu = () => {
      const L = db.students(cid);
      box.querySelector('#stuList').innerHTML = L.length ? L.map((s, i) =>
        '<div class="row" style="padding:5px 0;border-bottom:1px dashed var(--line);font-size:12.5px">' +
        '<span style="width:26px;color:var(--ink-400)">' + (i + 1) + '</span>' +
        '<span style="width:100px">' + u.esc(s.sno || '') + '</span><b style="flex:1">' + u.esc(s.name) + '</b>' +
        '<button class="btn btn-sm btn-danger" data-rm="' + s.id + '">移除</button></div>').join('')
        : '<div class="empty" style="padding:16px">暂无学生</div>';
      box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => {
        TW.S.roster[cid] = db.students(cid).filter(x => x.id !== b.dataset.rm);
        db.save('roster'); drawStu();
      });
    };
    drawStu();
    u.modal({
      title: '学生管理 · ' + db.clsName(cid), body: box,
      buttons: [
        { text: '关闭', class: 'btn', onClick: (b, c) => { c(); done && done(); } },
        {
          text: '添加学生', class: 'btn btn-primary', onClick: (b) => {
            const n = b.querySelector('#sM').value.trim();
            if (!n) { u.toast('请填写姓名', 'warn'); return; }
            TW.S.roster[cid] = db.students(cid).concat([{
              id: u.uid('st'), sno: b.querySelector('#sN').value.trim(), name: n,
              gender: b.querySelector('#sG').value, note: b.querySelector('#sR').value.trim()
            }]);
            db.save('roster');
            b.querySelector('#sM').value = ''; b.querySelector('#sN').value = '';
            drawStu(); u.toast('已添加', 'ok', 1400);
          }
        }]
    });
  }

  /* ---------- 课堂点名（移动端友好） ---------- */
  function rollCall(cid, done) {
    const ds = cal.classDates(cid);
    const t = u.ymd(u.today());
    const def = ds.indexOf(t) >= 0 ? t : (ds.filter(d => d <= t).pop() || ds[0] || t);
    const stu = db.students(cid);
    if (!stu.length) { u.toast('请先导入花名册', 'warn'); return; }
    const box = u.el('div');
    box.innerHTML =
      '<div class="row" style="margin-bottom:12px">' +
      '<label class="hint">上课日期</label><select class="select" id="rcD" style="flex:1">' +
      (ds.length ? ds.map(d => '<option value="' + d + '"' + (d === def ? ' selected' : '') + '>' + u.fmtCn(d) + ' 周' + u.DAY_CN[u.isoDow(d) % 7] + ' · 第' + cal.weekOf(d) + '周</option>').join('')
        : '<option value="' + t + '">' + u.fmtCn(t) + '</option>') + '</select>' +
      '<button class="btn btn-sm btn-green" id="rcAll">全员到齐</button></div>' +
      '<div id="rcList" style="max-height:56vh;overflow:auto"></div>';

    const draw = () => {
      const d = box.querySelector('#rcD').value;
      box.querySelector('#rcList').innerHTML = stu.map((s, i) => {
        const r = rec(cid, d, s.id) || {};
        return '<div class="row" style="padding:7px 2px;border-bottom:1px dashed var(--line);gap:8px">' +
          '<span style="width:26px;color:var(--ink-400);font-size:12px">' + (i + 1) + '</span>' +
          '<b style="width:78px;font-size:13px">' + u.esc(s.name) + '</b>' +
          '<span class="muted" style="width:96px;font-size:11.5px">' + u.esc(s.sno || '') + '</span>' +
          '<select class="att-sel ' + attInfo(r.a).cls + '" data-rc="' + s.id + '" style="width:96px;border:1px solid var(--line)">' +
          ATT.map(a => '<option value="' + a.v + '"' + ((r.a || '') === a.v ? ' selected' : '') + '>' + a.k + '</option>').join('') + '</select>' +
          '<input class="sc-inp" type="number" step="0.5" data-rs="' + s.id + '" placeholder="得分" value="' + (r.s === null || r.s === undefined ? '' : r.s) + '" style="border:1px solid var(--line);width:62px">' +
          '</div>';
      }).join('');
    };
    box.querySelector('#rcD').onchange = draw;
    box.querySelector('#rcAll').onclick = () => {
      const d = box.querySelector('#rcD').value;
      stu.forEach(s => setRec(cid, d, s.id, { a: 'normal' }));
      draw(); u.toast('已全员标记正常出勤', 'ok');
    };
    box.addEventListener('change', e => {
      const d = box.querySelector('#rcD').value, t2 = e.target;
      if (t2.matches('[data-rc]')) { setRec(cid, d, t2.dataset.rc, { a: t2.value }); t2.className = 'att-sel ' + attInfo(t2.value).cls; t2.style.border = '1px solid var(--line)'; }
      if (t2.matches('[data-rs]')) setRec(cid, d, t2.dataset.rs, { s: t2.value === '' ? null : u.num(t2.value, 0) });
    });
    draw();
    u.modal({
      title: '课堂点名 · ' + db.clsName(cid), body: box, wide: true,
      buttons: [{ text: '完成', class: 'btn btn-primary', onClick: (b, c) => { c(); done && done(); u.toast('点名记录已保存', 'ok'); } }]
    });
  }

  /* ---------- 导出 ---------- */
  function exportMenu(cid) {
    u.modal({
      title: '导出课堂记录',
      body: '<div class="grid g2">' +
        '<button class="btn" id="e1" style="justify-content:center;padding:14px">考勤与得分总表<br><span class="hint">Excel · 完整矩阵</span></button>' +
        '<button class="btn" id="e2" style="justify-content:center;padding:14px">平时成绩单<br><span class="hint">Excel · 含加分与总分</span></button>' +
        '<button class="btn" id="e3" style="justify-content:center;padding:14px">全部班级汇总<br><span class="hint">Excel · 每班一表</span></button>' +
        '<button class="btn" id="e4" style="justify-content:center;padding:14px">课堂考勤台账<br><span class="hint">Word 文档</span></button>' +
        '</div>',
      buttons: [{ text: '关闭', class: 'btn', onClick: (b, c) => c() }],
      onOk: null
    });
    setTimeout(() => {
      const q = s => document.querySelector(s);
      if (q('#e1')) q('#e1').onclick = () => expMatrix(cid);
      if (q('#e2')) q('#e2').onclick = () => expScore(cid);
      if (q('#e3')) q('#e3').onclick = () => expAll();
      if (q('#e4')) q('#e4').onclick = () => expWord(cid);
    }, 50);
  }

  function matrixAoa(cid) {
    const stu = db.students(cid), ds = cal.classDates(cid);
    const head = ['序号', '班级', '学号', '姓名'];
    ds.forEach(d => { head.push(u.fmtCn(d) + '(出勤)'); head.push(u.fmtCn(d) + '(得分)'); });
    head.push('课堂得分合计', '竞赛加分', '平时成绩总分');
    const aoa = [head];
    stu.forEach((s, i) => {
      const t = totalOf(cid, s.id);
      const row = [i + 1, db.clsName(cid), s.sno || '', s.name];
      ds.forEach(d => {
        const r = rec(cid, d, s.id) || {};
        row.push(attInfo(r.a).s || ''); row.push(r.s === null || r.s === undefined ? '' : r.s);
      });
      row.push(t.score, t.bonus, t.total);
      aoa.push(row);
    });
    return aoa;
  }
  function expMatrix(cid) {
    const stu = db.students(cid);
    if (!stu.length) { u.toast('该班暂无学生', 'warn'); return; }
    TW.io.exportBook([{ name: db.clsName(cid).slice(0, 28), aoa: matrixAoa(cid) }],
      db.clsName(cid) + '_课堂记录总表_' + u.ymd(u.today()) + '.xlsx');
    u.toast('已导出', 'ok');
  }
  function expScore(cid) {
    const stu = db.students(cid);
    if (!stu.length) { u.toast('该班暂无学生', 'warn'); return; }
    TW.io.exportRows(stu.map((s, i) => {
      const t = totalOf(cid, s.id), a = attStat(cid, s.id);
      return {
        序号: i + 1, 班级: db.clsName(cid), 学号: s.sno || '', 姓名: s.name,
        正常出勤: a.normal, 请假: a.leave, 迟到: a.late, 早退: a.early, 旷课: a.absent,
        课堂得分: t.score, 竞赛加分: t.bonus, 平时成绩总分: t.total
      };
    }), db.clsName(cid) + '_平时成绩单_' + u.ymd(u.today()) + '.xlsx', '平时成绩');
    u.toast('已导出', 'ok');
  }
  function expAll() {
    const sheets = TW.term.classesOf().filter(c => db.students(c.id).length).map(c => ({ name: c.name.slice(0, 28), aoa: matrixAoa(c.id) }));
    if (!sheets.length) { u.toast('暂无可导出的班级', 'warn'); return; }
    TW.io.exportBook(sheets, '全部班级课堂记录_' + u.ymd(u.today()) + '.xlsx');
    u.toast('已导出 ' + sheets.length + ' 个班级', 'ok');
  }
  function expWord(cid) {
    const stu = db.students(cid), ds = cal.classDates(cid).filter(d => d <= u.ymd(u.today()));
    if (!stu.length) { u.toast('该班暂无学生', 'warn'); return; }
    let h = '<h1>课堂考勤与平时成绩台账</h1><div class="sub">' + u.esc(db.clsName(cid)) + '　·　' + u.esc(cal.termLabel()) +
      '　·　任课教师：' + u.esc(TW.S.settings.teacherName || '　　　') + '　·　制表 ' + u.ymd(u.today()) + '</div>';
    h += '<table><thead><tr><th>序号</th><th>学号</th><th>姓名</th><th>正常</th><th>请假</th><th>迟到</th><th>早退</th><th>旷课</th><th>课堂得分</th><th>竞赛加分</th><th>平时总分</th></tr></thead><tbody>';
    stu.forEach((s, i) => {
      const t = totalOf(cid, s.id), a = attStat(cid, s.id);
      h += '<tr><td>' + (i + 1) + '</td><td>' + u.esc(s.sno || '') + '</td><td>' + u.esc(s.name) + '</td>' +
        '<td>' + a.normal + '</td><td>' + a.leave + '</td><td>' + a.late + '</td><td>' + a.early + '</td><td>' + a.absent + '</td>' +
        '<td>' + t.score + '</td><td>' + t.bonus + '</td><td>' + t.total + '</td></tr>';
    });
    h += '</tbody></table><p class="meta">统计区间：' + (ds[0] || '—') + ' 至 ' + (ds[ds.length - 1] || '—') + '，共 ' + ds.length + ' 次课。</p>';
    TW.io.exportWord('课堂考勤台账', h, db.clsName(cid) + '_课堂考勤台账_' + u.ymd(u.today()));
    u.toast('Word 台账已导出', 'ok');
  }

  TW.views.classroom = { title: '课堂记录', render: render, totalOf: totalOf, attStat: attStat };
})(window.TW);
