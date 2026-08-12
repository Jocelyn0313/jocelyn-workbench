/* =========================================================
   analytics.js  学情记录区：成绩单导入 + 动态数据分析
   ========================================================= */
(function (TW) {
  'use strict';
  const u = TW.u, db = TW.db, cal = TW.cal;
  TW.views = TW.views || {};

  const EXAM_TYPES = ['单元测验', '周测', '月考', '期中考试', '期末考试', 'B级模拟', '四级模拟', '口语测试', '听力测试', '其他'];
  let curCls = '', curExam = '', tab = 'overview';

  function render(host) {
    const S = TW.S;
    if (!S.classes.length) {
      host.innerHTML = '<div class="page-head"><h2 class="page-title">学情分析</h2></div>' +
        '<div class="card"><div class="empty"><span class="em-ic">📊</span>请先创建教学班并导入花名册<br>' +
        '<button class="btn btn-primary" style="margin-top:12px" onclick="TW.go(\'settings\')">去创建班级</button></div></div>';
      return;
    }
    if (!curCls || !db.cls(curCls)) curCls = TW.term.classesOf()[0] ? TW.term.classesOf()[0].id : '';
    const exams = examsOf(curCls);
    if (curExam && !exams.some(e => e.id === curExam)) curExam = '';

    host.innerHTML =
      '<div class="page-head"><div>' +
      '<h2 class="page-title">学情分析</h2>' +
      '<div class="page-sub">导入各次测试成绩，自动生成分数段分布、趋势追踪与个体诊断</div>' +
      '</div><div class="toolbar">' +
      '<button class="btn btn-sm" id="aTpl">成绩模板</button>' +
      '<button class="btn btn-sm" id="aExp">导出分析</button>' +
      '<button class="btn btn-sm btn-primary" id="aImp">＋ 导入成绩单</button>' +
      '</div></div>' +

      '<div class="card"><div class="row" style="gap:9px">' +
      '<label class="hint">教学班</label>' +
      '<select class="select" id="aCls" style="width:190px">' +
      TW.term.classesOf().map(c => '<option value="' + c.id + '"' + (curCls === c.id ? ' selected' : '') + '>' + u.esc(c.name) + '</option>').join('') + '</select>' +
      '<div class="tabs" style="margin:0">' +
      [['overview', '总览'], ['single', '单次分析'], ['trend', '趋势追踪'], ['student', '学生个体'], ['compare', '班级对比']]
        .map(x => '<div class="tab' + (tab === x[0] ? ' on' : '') + '" data-t="' + x[0] + '">' + x[1] + '</div>').join('') +
      '</div><span class="spacer"></span>' +
      '<span class="hint">' + exams.length + ' 次测试记录</span>' +
      '</div></div>' +
      '<div id="aBody" style="margin-top:16px"></div>';

    u.$('#aCls').onchange = e => { curCls = e.target.value; curExam = ''; render(host); };
    u.$$('[data-t]', host).forEach(b => b.onclick = () => { tab = b.dataset.t; render(host); });
    u.$('#aImp').onclick = () => importExam(curCls, () => render(host));
    u.$('#aTpl').onclick = () => TW.io.exportTemplate(['学号', '姓名', '成绩'],
      [['2025010101', '张三', 86], ['2025010102', '李四', 74]], '成绩单导入模板.xlsx', '成绩单');
    u.$('#aExp').onclick = () => exportReport(curCls);

    const box = u.$('#aBody');
    if (!exams.length) {
      box.innerHTML = '<div class="card"><div class="empty"><span class="em-ic">📈</span>该班还没有成绩数据<br>' +
        '<span class="hint">导入 Excel 成绩单（含「姓名」与「成绩」两列即可）后自动生成分析</span><br>' +
        '<button class="btn btn-primary" style="margin-top:12px" id="aImp2">导入成绩单</button></div></div>';
      u.$('#aImp2').onclick = () => importExam(curCls, () => render(host));
      return;
    }
    if (tab === 'overview') overview(box, host);
    else if (tab === 'single') single(box, host);
    else if (tab === 'trend') trend(box);
    else if (tab === 'student') student(box);
    else compare(box);
  }

  /* ---------- 数据 ---------- */
  function examsOf(cid) {
    return (TW.S.exams || []).filter(e => e.classId === cid).sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1);
  }
  function valuesOf(ex) {
    return Object.keys(ex.scores || {}).map(k => u.num(ex.scores[k], null)).filter(v => v !== null && !isNaN(v));
  }
  function statOf(ex) {
    const v = valuesOf(ex), full = u.num(ex.full, 100);
    if (!v.length) return { n: 0, avg: 0, max: 0, min: 0, pass: 0, good: 0, sd: 0, passRate: 0, goodRate: 0, median: 0 };
    const s = v.slice().sort((a, b) => a - b);
    const avg = v.reduce((a, b) => a + b, 0) / v.length;
    const pass = v.filter(x => x >= full * 0.6).length;
    const good = v.filter(x => x >= full * 0.85).length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - avg) * (b - avg), 0) / v.length);
    return {
      n: v.length, avg: u.round(avg, 1), max: s[s.length - 1], min: s[0],
      median: u.round(s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2, 1),
      pass: pass, good: good, sd: u.round(sd, 1),
      passRate: u.round(pass / v.length * 100, 1), goodRate: u.round(good / v.length * 100, 1)
    };
  }
  function bands(ex) {
    const full = u.num(ex.full, 100), v = valuesOf(ex);
    const defs = [['优秀', .85, 1.01, '#4ade80'], ['良好', .75, .85, '#60a5fa'], ['中等', .6, .75, '#a78bfa'], ['及格边缘', .5, .6, '#fbbf24'], ['不及格', -1, .5, '#f87171']];
    return defs.map(d => ({
      k: d[0] + '\n' + Math.round(full * Math.max(0, d[1])) + '+',
      kk: d[0],
      v: v.filter(x => x >= full * d[1] && x < full * d[2]).length, color: d[3]
    }));
  }

  /* ---------- 总览 ---------- */
  function overview(box, host) {
    const exams = examsOf(curCls);
    const last = exams[exams.length - 1], st = statOf(last);
    const labels = exams.map(e => e.name.slice(0, 8));
    const avgs = exams.map(e => statOf(e).avg);
    const passes = exams.map(e => statOf(e).passRate);

    box.innerHTML =
      '<div class="grid g4" style="margin-bottom:16px">' +
      card('最近测试', u.esc(last.name), u.fmtCn(last.date) + ' · 满分' + u.num(last.full, 100), '') +
      card('班级均分', st.avg, '中位数 ' + st.median + ' · 标准差 ' + st.sd, 'p') +
      card('及格率', st.passRate + '%', st.pass + ' / ' + st.n + ' 人及格', st.passRate >= 60 ? 'g' : 'k') +
      card('优秀率', st.goodRate + '%', st.good + ' 人达 85% 以上', 'a') +
      '</div>' +

      '<div class="grid g2">' +
      '<div class="card"><div class="card-head"><h3 class="card-title"><i class="dot"></i>' + u.esc(last.name) + ' 分数段分布</h3></div>' +
      '<div class="chart-box">' + u.barChart(bands(last), { height: 240 }) + '</div></div>' +
      '<div class="card"><div class="card-head"><h3 class="card-title p"><i class="dot"></i>历次均分与及格率走势</h3></div>' +
      '<div class="chart-box">' + u.lineChart([
        { name: '班级均分', data: avgs, color: '#60a5fa' },
        { name: '及格率(%)', data: passes, color: '#f472b6' }
      ], labels, { height: 240 }) + '</div>' +
      u.legend([{ k: '班级均分', color: '#60a5fa' }, { k: '及格率(%)', color: '#f472b6' }]) + '</div>' +
      '</div>' +

      '<div class="card"><div class="card-head"><h3 class="card-title g"><i class="dot"></i>测试记录</h3></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>测试名称</th><th>类型</th><th>日期</th><th class="num">满分</th>' +
      '<th class="num">人数</th><th class="num">均分</th><th class="num">最高</th><th class="num">最低</th><th class="num">及格率</th><th class="num">优秀率</th><th></th></tr></thead><tbody>' +
      exams.slice().reverse().map(e => {
        const s = statOf(e);
        return '<tr><td><b>' + u.esc(e.name) + '</b></td><td><span class="tag t-purple">' + u.esc(e.type || '测试') + '</span></td>' +
          '<td>' + u.esc(e.date) + '</td><td class="num">' + u.num(e.full, 100) + '</td><td class="num">' + s.n + '</td>' +
          '<td class="num total-cell">' + s.avg + '</td><td class="num">' + s.max + '</td><td class="num">' + s.min + '</td>' +
          '<td class="num">' + s.passRate + '%</td><td class="num">' + s.goodRate + '%</td>' +
          '<td class="nowrap"><button class="btn btn-sm" data-v="' + e.id + '">查看</button> ' +
          '<button class="btn btn-sm" data-e="' + e.id + '">编辑</button> ' +
          '<button class="btn btn-sm btn-danger" data-d="' + e.id + '">删</button></td></tr>';
      }).join('') + '</tbody></table></div></div>';

    u.$$('[data-v]', box).forEach(b => b.onclick = () => { curExam = b.dataset.v; tab = 'single'; render(host); });
    u.$$('[data-e]', box).forEach(b => b.onclick = () => examDialog(b.dataset.e, () => render(host)));
    u.$$('[data-d]', box).forEach(b => b.onclick = () => u.confirm('删除这次测试及其全部成绩？', () => {
      TW.S.exams = TW.S.exams.filter(x => x.id !== b.dataset.d); db.save('exams'); render(host);
    }));

    function card(k, v, x, c) {
      return '<div class="stat ' + (c || '') + '"><div class="s-k">' + k + '</div><div class="s-v" style="font-size:' + (String(v).length > 8 ? '16px' : '23px') + '">' + v + '</div><div class="s-x">' + u.esc(x) + '</div></div>';
    }
  }

  /* ---------- 单次分析 ---------- */
  function single(box, host) {
    const exams = examsOf(curCls);
    if (!curExam) curExam = exams[exams.length - 1].id;
    const ex = exams.find(e => e.id === curExam) || exams[exams.length - 1];
    const st = statOf(ex), full = u.num(ex.full, 100);
    const stu = db.students(curCls);
    const rows = stu.map(s => ({ s: s, v: ex.scores[s.id] === undefined || ex.scores[s.id] === '' ? null : u.num(ex.scores[s.id], null) }))
      .sort((a, b) => (b.v === null ? -1 : b.v) - (a.v === null ? -1 : a.v));
    const prev = exams[exams.indexOf(ex) - 1];

    box.innerHTML =
      '<div class="card"><div class="card-head"><div class="row">' +
      '<select class="select" id="sExam" style="width:230px">' +
      exams.map(e => '<option value="' + e.id + '"' + (e.id === ex.id ? ' selected' : '') + '>' + u.esc(e.name) + ' · ' + u.esc(e.date) + '</option>').join('') + '</select>' +
      '<span class="tag t-blue">满分 ' + full + '</span><span class="tag t-green">' + st.n + ' 人参考</span>' +
      '</div><div class="toolbar"><button class="btn btn-sm" id="sEdit">编辑成绩</button>' +
      '<button class="btn btn-sm" id="sX">导出本次</button></div></div>' +
      '<div class="grid g4" style="margin-bottom:4px">' +
      ['均分 ' + st.avg, '最高 ' + st.max, '最低 ' + st.min, '中位数 ' + st.median, '标准差 ' + st.sd, '及格 ' + st.pass + '人', '优秀 ' + st.good + '人', '缺考 ' + (stu.length - st.n) + '人']
        .map(x => '<div class="tag t-gray" style="padding:6px 10px;justify-content:center">' + x + '</div>').join('') + '</div></div>' +

      '<div class="grid g2" style="margin-top:16px">' +
      '<div class="card"><div class="card-head"><h3 class="card-title"><i class="dot"></i>分数段分布</h3></div>' +
      '<div class="chart-box">' + u.barChart(bands(ex), { height: 230 }) + '</div></div>' +
      '<div class="card"><div class="card-head"><h3 class="card-title p"><i class="dot"></i>成绩构成</h3></div>' +
      '<div class="chart-box">' + u.donutChart(bands(ex).map(b => ({ k: b.kk, v: b.v, color: b.color })), { centerLabel: '参考人数' }) + '</div>' +
      u.legend(bands(ex).map(b => ({ k: b.kk, v: b.v, color: b.color }))) + '</div></div>' +

      '<div class="card"><div class="card-head"><h3 class="card-title g"><i class="dot"></i>成绩明细' +
      (prev ? '（对比「' + u.esc(prev.name) + '」）' : '') + '</h3></div>' +
      '<div class="tbl-wrap" style="max-height:60vh"><table class="tbl"><thead><tr><th>排名</th><th>学号</th><th>姓名</th>' +
      '<th class="num">成绩</th><th class="num">得分率</th><th>等级</th>' + (prev ? '<th class="num">上次</th><th class="num">进退</th>' : '') + '</tr></thead><tbody>' +
      rows.map((r, i) => {
        const p = prev ? (prev.scores[r.s.id] === undefined ? null : u.num(prev.scores[r.s.id], null)) : null;
        const dlt = (r.v !== null && p !== null) ? u.round(r.v - p, 1) : null;
        return '<tr><td>' + (r.v === null ? '—' : i + 1) + '</td><td>' + u.esc(r.s.sno || '') + '</td><td><b>' + u.esc(r.s.name) + '</b></td>' +
          '<td class="num" style="font-weight:600">' + (r.v === null ? '<span class="muted">缺考</span>' : r.v) + '</td>' +
          '<td class="num">' + (r.v === null ? '—' : u.round(r.v / full * 100, 1) + '%') + '</td>' +
          '<td>' + gradeTag(r.v, full) + '</td>' +
          (prev ? '<td class="num muted">' + (p === null ? '—' : p) + '</td><td class="num">' + deltaTag(dlt) + '</td>' : '') + '</tr>';
      }).join('') + '</tbody></table></div></div>';

    u.$('#sExam').onchange = e => { curExam = e.target.value; render(host); };
    u.$('#sEdit').onclick = () => scoreEditor(ex, () => render(host));
    u.$('#sX').onclick = () => {
      TW.io.exportRows(rows.map((r, i) => ({
        排名: r.v === null ? '' : i + 1, 学号: r.s.sno || '', 姓名: r.s.name, 成绩: r.v === null ? '缺考' : r.v,
        得分率: r.v === null ? '' : u.round(r.v / full * 100, 1) + '%', 等级: gradeText(r.v, full)
      })), db.clsName(curCls) + '_' + ex.name + '_成绩单.xlsx', '成绩');
      u.toast('已导出', 'ok');
    };
  }
  function gradeText(v, full) {
    if (v === null) return '缺考';
    const r = v / full;
    return r >= .85 ? '优秀' : r >= .75 ? '良好' : r >= .6 ? '中等' : r >= .5 ? '及格边缘' : '不及格';
  }
  function gradeTag(v, full) {
    const g = gradeText(v, full);
    const m = { 优秀: 't-green', 良好: 't-blue', 中等: 't-purple', 及格边缘: 't-amber', 不及格: 't-red', 缺考: 't-gray' };
    return '<span class="tag ' + m[g] + '">' + g + '</span>';
  }
  function deltaTag(d) {
    if (d === null) return '<span class="muted">—</span>';
    if (d > 0) return '<span style="color:var(--red-600);font-weight:600">↑ ' + d + '</span>';
    if (d < 0) return '<span style="color:var(--green-600);font-weight:600">↓ ' + Math.abs(d) + '</span>';
    return '<span class="muted">持平</span>';
  }

  /* ---------- 趋势 ---------- */
  function trend(box) {
    const exams = examsOf(curCls);
    const labels = exams.map(e => e.name.slice(0, 8));
    const stu = db.students(curCls);
    const avgs = exams.map(e => statOf(e).avg);
    const maxs = exams.map(e => statOf(e).max);
    const mins = exams.map(e => statOf(e).min);

    // 进步排行（首末对比，按得分率）
    const prog = stu.map(s => {
      const pts = exams.map(e => {
        const v = e.scores[s.id]; const f = u.num(e.full, 100);
        return (v === undefined || v === '') ? null : u.round(u.num(v, 0) / f * 100, 1);
      }).filter(x => x !== null);
      if (pts.length < 2) return null;
      return { n: s.name, d: u.round(pts[pts.length - 1] - pts[0], 1), first: pts[0], last: pts[pts.length - 1] };
    }).filter(Boolean).sort((a, b) => b.d - a.d);

    box.innerHTML =
      '<div class="card"><div class="card-head"><h3 class="card-title"><i class="dot"></i>班级成绩走势（' + exams.length + ' 次测试）</h3></div>' +
      '<div class="chart-box">' + u.lineChart([
        { name: '最高分', data: maxs, color: '#4ade80' },
        { name: '平均分', data: avgs, color: '#60a5fa' },
        { name: '最低分', data: mins, color: '#f472b6' }
      ], labels, { height: 270 }) + '</div>' +
      u.legend([{ k: '最高分', color: '#4ade80' }, { k: '平均分', color: '#60a5fa' }, { k: '最低分', color: '#f472b6' }]) + '</div>' +

      '<div class="grid g2" style="margin-top:16px">' +
      '<div class="card"><div class="card-head"><h3 class="card-title g"><i class="dot"></i>进步显著（得分率提升）</h3></div>' +
      rankTable(prog.filter(x => x.d > 0).slice(0, 10), '↑') + '</div>' +
      '<div class="card"><div class="card-head"><h3 class="card-title k"><i class="dot"></i>需要关注（得分率下滑）</h3></div>' +
      rankTable(prog.filter(x => x.d < 0).slice(-10).reverse(), '↓') + '</div></div>';

    function rankTable(L, mk) {
      if (!L.length) return '<div class="empty" style="padding:22px">暂无数据（需至少两次测试）</div>';
      return '<div class="tbl-wrap" style="border:none"><table class="tbl"><thead><tr><th>姓名</th><th class="num">首次得分率</th><th class="num">最近得分率</th><th class="num">变化</th></tr></thead><tbody>' +
        L.map(x => '<tr><td><b>' + u.esc(x.n) + '</b></td><td class="num muted">' + x.first + '%</td><td class="num">' + x.last + '%</td>' +
          '<td class="num" style="font-weight:650;color:' + (x.d > 0 ? 'var(--red-600)' : 'var(--green-600)') + '">' + mk + ' ' + Math.abs(x.d) + '%</td></tr>').join('') +
        '</tbody></table></div>';
    }
  }

  /* ---------- 学生个体 ---------- */
  function student(box) {
    const stu = db.students(curCls), exams = examsOf(curCls);
    if (!stu.length) { box.innerHTML = '<div class="card"><div class="empty">该班暂无花名册</div></div>'; return; }
    box.innerHTML = '<div class="card"><div class="row" style="margin-bottom:12px">' +
      '<label class="hint">选择学生</label><select class="select" id="stSel" style="width:200px">' +
      stu.map(s => '<option value="' + s.id + '">' + u.esc(s.name) + (s.sno ? '（' + u.esc(s.sno) + '）' : '') + '</option>').join('') + '</select>' +
      '<span class="spacer"></span><button class="btn btn-sm" id="stExp">导出个人报告</button></div>' +
      '<div id="stBody"></div></div>';
    const draw = () => {
      const sid = u.$('#stSel').value;
      const s = stu.find(x => x.id === sid);
      const pts = exams.map(e => {
        const v = e.scores[sid]; const f = u.num(e.full, 100);
        return (v === undefined || v === '') ? null : u.round(u.num(v, 0) / f * 100, 1);
      });
      const clsAvg = exams.map(e => { const st = statOf(e); return u.round(st.avg / u.num(e.full, 100) * 100, 1); });
      const cr = TW.views.classroom;
      const t = cr.totalOf(curCls, sid), a = cr.attStat(curCls, sid);
      const valid = pts.filter(x => x !== null);
      const myAvg = valid.length ? u.round(valid.reduce((x, y) => x + y, 0) / valid.length, 1) : 0;

      u.$('#stBody').innerHTML =
        '<div class="grid g4" style="margin-bottom:14px">' +
        '<div class="stat"><div class="s-k">平均得分率</div><div class="s-v">' + myAvg + '%</div><div class="s-x">参加 ' + valid.length + ' / ' + exams.length + ' 次</div></div>' +
        '<div class="stat p"><div class="s-k">平时成绩</div><div class="s-v">' + t.total + '</div><div class="s-x">含竞赛加分 ' + t.bonus + '</div></div>' +
        '<div class="stat g"><div class="s-k">出勤情况</div><div class="s-v">' + a.normal + '</div><div class="s-x">请假' + a.leave + ' 迟到' + a.late + ' 旷课' + a.absent + '</div></div>' +
        '<div class="stat a"><div class="s-k">最近一次</div><div class="s-v">' + (pts.filter(x => x !== null).slice(-1)[0] || '—') + '%</div><div class="s-x">' + (exams.length ? u.esc(exams[exams.length - 1].name) : '') + '</div></div>' +
        '</div>' +
        '<div class="chart-box">' + u.lineChart([
          { name: u.esc(s.name), data: pts, color: '#a78bfa' },
          { name: '班级均值', data: clsAvg, color: '#cbd5e1' }
        ], exams.map(e => e.name.slice(0, 8)), { height: 250, max: 100 }) + '</div>' +
        u.legend([{ k: s.name + ' 得分率(%)', color: '#a78bfa' }, { k: '班级均值(%)', color: '#cbd5e1' }]) +
        '<div class="tbl-wrap" style="margin-top:14px"><table class="tbl"><thead><tr><th>测试</th><th>日期</th><th class="num">成绩</th><th class="num">满分</th><th class="num">得分率</th><th class="num">班级均分</th><th>对比</th></tr></thead><tbody>' +
        exams.map(e => {
          const v = e.scores[sid]; const f = u.num(e.full, 100); const st = statOf(e);
          const has = !(v === undefined || v === '');
          const nv = has ? u.num(v, 0) : null;
          return '<tr><td>' + u.esc(e.name) + '</td><td>' + u.esc(e.date) + '</td>' +
            '<td class="num" style="font-weight:600">' + (has ? nv : '<span class="muted">缺考</span>') + '</td><td class="num muted">' + f + '</td>' +
            '<td class="num">' + (has ? u.round(nv / f * 100, 1) + '%' : '—') + '</td><td class="num muted">' + st.avg + '</td>' +
            '<td>' + (has ? (nv >= st.avg ? '<span class="tag t-green">高于均分 ' + u.round(nv - st.avg, 1) + '</span>' : '<span class="tag t-amber">低于均分 ' + u.round(st.avg - nv, 1) + '</span>') : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    };
    u.$('#stSel').onchange = draw;
    u.$('#stExp').onclick = () => {
      const sid = u.$('#stSel').value, s = stu.find(x => x.id === sid);
      const cr = TW.views.classroom, t = cr.totalOf(curCls, sid), a = cr.attStat(curCls, sid);
      let h = '<h1>学生学情报告</h1><div class="sub">' + u.esc(s.name) + '　·　' + u.esc(db.clsName(curCls)) + '　·　' + u.esc(cal.termLabel()) + '</div>' +
        '<h2>一、平时表现</h2><table><tr><th>正常出勤</th><th>请假</th><th>迟到</th><th>早退</th><th>旷课</th><th>课堂得分</th><th>竞赛加分</th><th>平时总分</th></tr>' +
        '<tr><td>' + a.normal + '</td><td>' + a.leave + '</td><td>' + a.late + '</td><td>' + a.early + '</td><td>' + a.absent + '</td><td>' + t.score + '</td><td>' + t.bonus + '</td><td>' + t.total + '</td></tr></table>' +
        '<h2>二、测试成绩</h2><table><tr><th>测试</th><th>日期</th><th>成绩</th><th>满分</th><th>得分率</th><th>班级均分</th></tr>' +
        exams.map(e => {
          const v = e.scores[sid], f = u.num(e.full, 100), st = statOf(e);
          const has = !(v === undefined || v === '');
          return '<tr><td>' + u.esc(e.name) + '</td><td>' + u.esc(e.date) + '</td><td>' + (has ? v : '缺考') + '</td><td>' + f + '</td><td>' +
            (has ? u.round(u.num(v, 0) / f * 100, 1) + '%' : '—') + '</td><td>' + st.avg + '</td></tr>';
        }).join('') + '</table>' +
        '<h2>三、教师评语</h2><p style="min-height:60pt;border:1pt solid #ccc;padding:8pt">　</p>' +
        '<p class="meta" style="margin-top:20pt">任课教师：' + u.esc(TW.S.settings.teacherName || '　　　') + '　　日期：' + u.ymd(u.today()) + '</p>';
      TW.io.exportWord('学生学情报告', h, s.name + '_学情报告_' + u.ymd(u.today()));
      u.toast('个人报告已导出', 'ok');
    };
    draw();
  }

  /* ---------- 班级对比 ---------- */
  function compare(box) {
    const S = TW.S;
    const rows = TW.term.classesOf().map(c => {
      const ex = examsOf(c.id);
      if (!ex.length) return { c: c, n: 0 };
      const last = ex[ex.length - 1], st = statOf(last);
      const allAvg = ex.map(e => u.round(statOf(e).avg / u.num(e.full, 100) * 100, 1));
      return {
        c: c, n: ex.length, last: last, st: st,
        rate: allAvg.length ? u.round(allAvg.reduce((a, b) => a + b, 0) / allAvg.length, 1) : 0
      };
    });
    const withData = rows.filter(r => r.n);
    box.innerHTML =
      '<div class="card"><div class="card-head"><h3 class="card-title"><i class="dot"></i>各班平均得分率对比</h3></div>' +
      (withData.length ? '<div class="chart-box">' + u.barChart(withData.map(r => ({ k: r.c.name.slice(0, 8), v: r.rate, label: r.rate + '%' })), { height: 250, max: 100 }) + '</div>'
        : '<div class="empty">暂无可对比数据</div>') + '</div>' +
      '<div class="card"><div class="card-head"><h3 class="card-title p"><i class="dot"></i>班级学情一览</h3></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>班级</th><th class="num">学生数</th><th class="num">测试次数</th>' +
      '<th>最近测试</th><th class="num">均分</th><th class="num">及格率</th><th class="num">优秀率</th><th class="num">平均得分率</th></tr></thead><tbody>' +
      rows.map(r => '<tr><td><b>' + u.esc(r.c.name) + '</b></td><td class="num">' + db.students(r.c.id).length + '</td>' +
        '<td class="num">' + r.n + '</td>' +
        (r.n ? '<td>' + u.esc(r.last.name) + '</td><td class="num total-cell">' + r.st.avg + '</td><td class="num">' + r.st.passRate + '%</td><td class="num">' + r.st.goodRate + '%</td><td class="num">' + r.rate + '%</td>'
          : '<td colspan="5" class="muted">暂无成绩数据</td>') + '</tr>').join('') +
      '</tbody></table></div></div>';
  }

  /* ---------- 导入成绩单 ---------- */
  async function importExam(cid, done) {
    const f = await u.pickFile('.xlsx,.xls,.csv'); if (!f) return;
    let rows;
    try { rows = await TW.io.readSheet(f); } catch (e) { u.toast('读取失败：' + e.message, 'err'); return; }
    const stu = db.students(cid);
    const parsed = [];
    rows.forEach(r => {
      const name = String(TW.io.pick(r, ['姓名', '学生姓名', '名字'])).trim();
      const sno = String(TW.io.pick(r, ['学号', '学籍号', '编号'])).trim();
      const sc = TW.io.pick(r, ['成绩', '分数', '得分', '总分']);
      if (!name && !sno) return;
      parsed.push({ name: name, sno: sno, score: sc === '' ? null : u.num(sc, null) });
    });
    if (!parsed.length) { u.toast('未识别到成绩数据，请确认包含「姓名」与「成绩」列', 'warn', 4000); return; }

    const matched = [], unmatched = [];
    parsed.forEach(p => {
      let s = null;
      if (p.sno) s = stu.find(x => String(x.sno).trim() === p.sno);
      if (!s && p.name) s = stu.find(x => x.name === p.name);
      if (s) matched.push({ s: s, v: p.score }); else unmatched.push(p);
    });

    const box = u.el('div');
    box.innerHTML = '<div class="form-grid">' +
      '<div class="field"><label>测试名称 *</label><input class="input" id="eN" value="' + u.esc(f.name.replace(/\.[^.]+$/, '')) + '"></div>' +
      '<div class="field"><label>测试类型</label><select class="select" id="eT">' + EXAM_TYPES.map(t => '<option>' + t + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>测试日期</label><input class="input" type="date" id="eD" value="' + u.ymd(u.today()) + '"></div>' +
      '<div class="field"><label>满分</label><input class="input" type="number" id="eF" value="100"></div>' +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="row"><span class="tag t-green">成功匹配 ' + matched.length + ' 人</span>' +
      (unmatched.length ? '<span class="tag t-amber">未匹配 ' + unmatched.length + ' 人</span>' : '') +
      (stu.length ? '' : '<span class="tag t-red">该班花名册为空</span>') + '</div>' +
      (unmatched.length ? '<div class="hint" style="margin-top:8px">未匹配名单：' + unmatched.map(x => u.esc(x.name || x.sno)).join('、') +
        '<br><label style="display:inline-flex;align-items:center;gap:6px;margin-top:6px"><input type="checkbox" id="eAdd" checked> 自动加入花名册</label></div>' : '');

    u.modal({
      title: '导入成绩单 · ' + db.clsName(cid), body: box,
      buttons: [{ text: '取消', class: 'btn', onClick: (b, c) => c() },
      {
        text: '确认导入', class: 'btn btn-primary', onClick: (b, c) => {
          const scores = {};
          matched.forEach(m => { if (m.v !== null) scores[m.s.id] = m.v; });
          const addNew = b.querySelector('#eAdd');
          if (unmatched.length && addNew && addNew.checked) {
            const cur = TW.S.roster[cid] || [];
            unmatched.forEach(p => {
              const ns = { id: u.uid('st'), sno: p.sno, name: p.name || p.sno, gender: '', note: '成绩导入自动添加' };
              cur.push(ns); if (p.score !== null) scores[ns.id] = p.score;
            });
            TW.S.roster[cid] = cur; db.save('roster');
          }
          TW.S.exams.push({
            id: u.uid('ex'), classId: cid, name: b.querySelector('#eN').value.trim() || '测试',
            type: b.querySelector('#eT').value, date: b.querySelector('#eD').value,
            full: u.num(b.querySelector('#eF').value, 100), scores: scores, createdAt: new Date().toISOString()
          });
          db.save('exams'); c(); done && done();
          u.toast('成绩导入完成，共 ' + Object.keys(scores).length + ' 条', 'ok');
        }
      }]
    });
  }

  /* ---------- 手工编辑成绩 ---------- */
  function scoreEditor(ex, done) {
    const stu = db.students(ex.classId);
    const box = u.el('div');
    box.innerHTML = '<div class="hint" style="margin-bottom:10px">留空表示缺考；修改后点击保存。</div>' +
      '<div class="tbl-wrap" style="max-height:56vh"><table class="tbl"><thead><tr><th>学号</th><th>姓名</th><th class="num">成绩（满分 ' + u.num(ex.full, 100) + '）</th></tr></thead><tbody>' +
      stu.map(s => '<tr><td>' + u.esc(s.sno || '') + '</td><td>' + u.esc(s.name) + '</td>' +
        '<td class="num"><input class="sc-inp" style="border:1px solid var(--line);width:76px" type="number" step="0.5" data-s="' + s.id + '" value="' +
        (ex.scores[s.id] === undefined ? '' : ex.scores[s.id]) + '"></td></tr>').join('') + '</tbody></table></div>';
    u.modal({
      title: '编辑成绩 · ' + ex.name, body: box, wide: true,
      buttons: [{ text: '取消', class: 'btn', onClick: (b, c) => c() },
      {
        text: '保存', class: 'btn btn-primary', onClick: (b, c) => {
          const sc = {};
          b.querySelectorAll('[data-s]').forEach(i => { if (i.value !== '') sc[i.dataset.s] = u.num(i.value, 0); });
          ex.scores = sc; db.save('exams'); c(); done && done(); u.toast('已保存', 'ok');
        }
      }]
    });
  }

  function examDialog(id, done) {
    const ex = TW.S.exams.find(x => x.id === id); if (!ex) return;
    const box = u.el('div');
    box.innerHTML = '<div class="form-grid">' +
      '<div class="field"><label>测试名称</label><input class="input" id="xN" value="' + u.esc(ex.name) + '"></div>' +
      '<div class="field"><label>类型</label><select class="select" id="xT">' +
      EXAM_TYPES.map(t => '<option' + (ex.type === t ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>日期</label><input class="input" type="date" id="xD" value="' + u.esc(ex.date) + '"></div>' +
      '<div class="field"><label>满分</label><input class="input" type="number" id="xF" value="' + u.num(ex.full, 100) + '"></div></div>';
    u.modal({
      title: '编辑测试信息', body: box,
      buttons: [
        { text: '取消', class: 'btn', onClick: (b, c) => c() },
        { text: '编辑成绩', class: 'btn btn-purple', onClick: (b, c) => { c(); scoreEditor(ex, done); } },
        {
          text: '保存', class: 'btn btn-primary', onClick: (b, c) => {
            ex.name = b.querySelector('#xN').value.trim() || ex.name;
            ex.type = b.querySelector('#xT').value; ex.date = b.querySelector('#xD').value;
            ex.full = u.num(b.querySelector('#xF').value, 100);
            db.save('exams'); c(); done && done(); u.toast('已保存', 'ok');
          }
        }]
    });
  }

  /* ---------- 导出分析报告 ---------- */
  function exportReport(cid) {
    const exams = examsOf(cid);
    if (!exams.length) { u.toast('该班暂无成绩数据', 'warn'); return; }
    const stu = db.students(cid);
    u.modal({
      title: '导出学情分析',
      body: '<div class="grid g2">' +
        '<button class="btn" id="x1" style="justify-content:center;padding:14px">总成绩册<br><span class="hint">Excel · 历次成绩横向排列</span></button>' +
        '<button class="btn" id="x2" style="justify-content:center;padding:14px">学情分析报告<br><span class="hint">Word · 含统计与分布</span></button>' +
        '<button class="btn" id="x3" style="justify-content:center;padding:14px">PDF 分析报告<br><span class="hint">浏览器打印另存</span></button>' +
        '<button class="btn" id="x4" style="justify-content:center;padding:14px">学期总评表<br><span class="hint">Excel · 平时+考试综合</span></button>' +
        '</div>',
      buttons: [{ text: '关闭', class: 'btn', onClick: (b, c) => c() }]
    });
    setTimeout(() => {
      const q = s => document.querySelector(s);
      if (q('#x1')) q('#x1').onclick = () => {
        TW.io.exportRows(stu.map((s, i) => {
          const o = { 序号: i + 1, 学号: s.sno || '', 姓名: s.name };
          exams.forEach(e => o[e.name] = e.scores[s.id] === undefined ? '' : e.scores[s.id]);
          const vs = exams.map(e => e.scores[s.id]).filter(v => v !== undefined && v !== '').map(v => u.num(v, 0));
          o['平均分'] = vs.length ? u.round(vs.reduce((a, b) => a + b, 0) / vs.length, 1) : '';
          return o;
        }), db.clsName(cid) + '_总成绩册_' + u.ymd(u.today()) + '.xlsx', '总成绩册');
        u.toast('已导出', 'ok');
      };
      if (q('#x2')) q('#x2').onclick = () => reportDoc(cid, 'word');
      if (q('#x3')) q('#x3').onclick = () => reportDoc(cid, 'pdf');
      if (q('#x4')) q('#x4').onclick = () => {
        const cr = TW.views.classroom;
        TW.io.exportRows(stu.map((s, i) => {
          const t = cr.totalOf(cid, s.id), a = cr.attStat(cid, s.id);
          const vs = exams.map(e => e.scores[s.id]).filter(v => v !== undefined && v !== '').map(v => u.num(v, 0));
          const avg = vs.length ? u.round(vs.reduce((x, y) => x + y, 0) / vs.length, 1) : 0;
          return {
            序号: i + 1, 学号: s.sno || '', 姓名: s.name,
            出勤正常: a.normal, 请假: a.leave, 迟到: a.late, 旷课: a.absent,
            课堂得分: t.score, 竞赛加分: t.bonus, 平时成绩: t.total,
            测试平均分: avg, 建议总评: u.round(t.total * 0.4 + avg * 0.6, 1)
          };
        }), db.clsName(cid) + '_学期总评表_' + u.ymd(u.today()) + '.xlsx', '总评');
        u.toast('已导出（总评按 平时40% + 测试60% 试算，可在 Excel 中调整）', 'ok', 4200);
      };
    }, 50);
  }

  function reportDoc(cid, kind) {
    const exams = examsOf(cid), stu = db.students(cid);
    const title = db.clsName(cid) + ' 学情分析报告';
    let h = '<h1>' + u.esc(title) + '</h1><div class="sub">' + u.esc(cal.termLabel()) + '　·　任课教师：' +
      u.esc(TW.S.settings.teacherName || '　　　') + '　·　学生 ' + stu.length + ' 人　·　测试 ' + exams.length + ' 次　·　' + u.ymd(u.today()) + '</div>';
    h += '<h2>一、历次测试统计</h2><table><tr><th>测试</th><th>类型</th><th>日期</th><th>满分</th><th>参考</th><th>均分</th><th>最高</th><th>最低</th><th>及格率</th><th>优秀率</th><th>标准差</th></tr>';
    exams.forEach(e => {
      const s = statOf(e);
      h += '<tr><td>' + u.esc(e.name) + '</td><td>' + u.esc(e.type || '') + '</td><td>' + u.esc(e.date) + '</td><td>' + u.num(e.full, 100) + '</td>' +
        '<td>' + s.n + '</td><td>' + s.avg + '</td><td>' + s.max + '</td><td>' + s.min + '</td><td>' + s.passRate + '%</td><td>' + s.goodRate + '%</td><td>' + s.sd + '</td></tr>';
    });
    h += '</table>';
    const last = exams[exams.length - 1];
    h += '<h2>二、最近一次（' + u.esc(last.name) + '）分数段分布</h2><table><tr><th>等级</th>' +
      bands(last).map(b => '<th>' + u.esc(b.kk) + '</th>').join('') + '</tr><tr><td>人数</td>' +
      bands(last).map(b => '<td>' + b.v + '</td>').join('') + '</tr></table>';
    h += '<h2>三、学生成绩明细</h2><table><tr><th>序号</th><th>学号</th><th>姓名</th>' +
      exams.map(e => '<th>' + u.esc(e.name) + '</th>').join('') + '<th>平均</th></tr>';
    stu.forEach((s, i) => {
      const vs = exams.map(e => e.scores[s.id]).filter(v => v !== undefined && v !== '').map(v => u.num(v, 0));
      h += '<tr><td>' + (i + 1) + '</td><td>' + u.esc(s.sno || '') + '</td><td>' + u.esc(s.name) + '</td>' +
        exams.map(e => '<td>' + (e.scores[s.id] === undefined ? '' : e.scores[s.id]) + '</td>').join('') +
        '<td>' + (vs.length ? u.round(vs.reduce((a, b) => a + b, 0) / vs.length, 1) : '') + '</td></tr>';
    });
    h += '</table><h2>四、教学改进建议</h2><p style="min-height:70pt;border:1pt solid #ccc;padding:8pt">　</p>';
    if (kind === 'word') { TW.io.exportWord(title, h, title + '_' + u.ymd(u.today())); u.toast('Word 报告已导出', 'ok'); }
    else TW.io.exportPDF(title, h);
  }

  TW.views.analytics = { title: '学情分析', render: render };
})(window.TW);
