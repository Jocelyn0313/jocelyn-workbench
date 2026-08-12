/* =========================================================
   settings.js  基础设置：学期管理 / 当前学期校历 / 节次 / 教学班
   不同学期的班级与课表相互独立；切换学期后全站数据随之变化
   ========================================================= */
(function (TW) {
  'use strict';
  const u = TW.u, db = TW.db, cal = TW.cal, term = TW.term;
  TW.views = TW.views || {};

  function render(host) {
    const S = TW.S, s = S.settings, T = term;
    const terms = T.list();
    const cur = T.current();

    host.innerHTML =
      '<div class="page-head"><div>' +
      '<h2 class="page-title">基础设置</h2>' +
      '<div class="page-sub">先管理学期，再为<b>当前学期</b>设置校历、班级与课表；校历是全站第几周的唯一基准</div>' +
      '</div></div>' +

      /* 学期管理 */
      '<div class="card"><div class="card-head"><h3 class="card-title"><i class="dot"></i>学期管理</h3>' +
      '<div class="toolbar"><button class="btn btn-sm btn-primary" id="btnAddTerm">＋ 新增学期</button></div></div>' +
      '<div id="termList"></div>' +
      '<div class="hint" style="margin-top:8px">不同学期的班级、课表、考试、调课相互独立；在顶部「学期」下拉切换后，课表、课堂记录、学情分析、待办等全部按该学期展示。</div></div>' +

      '<div class="grid g-2-1">' +
      /* 当前学期校历 */
      '<div class="card"><div class="card-head"><h3 class="card-title"><i class="dot"></i>当前学期校历</h3>' +
      '<button class="btn btn-sm" id="btnPreviewCal">查看校历周次表</button></div>' +
      '<div class="form-grid">' +
      fld('学年', '<input class="input" id="fYear" value="' + u.esc(cur ? cur.schoolYear : '') + '" placeholder="2026-2027">') +
      fld('学期', '<select class="select" id="fTerm">' +
        ['第一学期', '第二学期'].map(t => '<option' + (cur && cur.termName === t ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>') +
      fld('第1教学周 · 周一日期', '<input class="input" type="date" id="fStart" value="' + u.esc(cur ? cur.termStart : '') + '">') +
      fld('总教学周数', '<input class="input" type="number" min="1" max="30" id="fWeeks" value="' + (cur ? (cur.totalWeeks || 20) : 20) + '">') +
      fld('教师姓名', '<input class="input" id="fName" value="' + u.esc(s.teacherName || '') + '" placeholder="用于导出台账署名">') +
      fld('平时成绩基础分', '<input class="input" type="number" id="fBase" value="' + (cur ? (cur.scoreBase || 0) : 0) + '" placeholder="0">') +
      '</div>' +
      '<div class="hint" style="margin-top:10px">此处编辑的是<b>当前学期</b>的校历。若开学第一周并非从周一开始，仍填写该周周一日期，系统按自然周划分教学周。</div>' +
      '<div class="row" style="margin-top:12px"><button class="btn btn-primary" id="btnSaveSet">保存当前学期设置</button>' +
      '<span class="hint" id="calNow"></span></div>' +
      '</div>' +

      /* 节次 */
      '<div class="card"><div class="card-head"><h3 class="card-title p"><i class="dot"></i>作息节次</h3>' +
      '<button class="btn btn-sm btn-purple" id="btnAddPeriod">＋ 节次</button></div>' +
      '<div id="periodList"></div>' +
      '<div class="hint" style="margin-top:8px">节次决定课表纵轴与"当前进行中的课"判定，全学期共用。</div></div>' +
      '</div>' +

      /* 班级 */
      '<div class="card"><div class="card-head"><h3 class="card-title g"><i class="dot"></i>教学班管理（当前学期：' + (cur ? u.esc(cur.schoolYear + ' ' + cur.termName) : '—') + '）</h3>' +
      '<div class="toolbar">' +
      '<button class="btn btn-sm" id="btnImpCls">Excel 导入班级</button>' +
      '<button class="btn btn-sm" id="btnTplCls">下载模板</button>' +
      '<button class="btn btn-sm" id="btnCopyCls">从其它学期复制班级</button>' +
      '<button class="btn btn-sm btn-green" id="btnAddCls">＋ 新增班级</button>' +
      '</div></div><div id="clsList"></div></div>';

    function fld(l, inner) { return '<div class="field"><label>' + l + '</label>' + inner + '</div>'; }

    u.$('#calNow').textContent = '当前：' + (cur ? (cur.schoolYear + ' ' + cur.termName) : '—') + ' 第' + (cal.weekOf(u.today()) || '—') + '周';

    u.$('#btnSaveSet').onclick = () => {
      if (!cur) { u.toast('请先新增一个学期', 'warn'); return; }
      const patch = {
        schoolYear: u.$('#fYear').value.trim(),
        termName: u.$('#fTerm').value,
        termStart: u.$('#fStart').value,
        totalWeeks: u.num(u.$('#fWeeks').value, 20),
        scoreBase: u.num(u.$('#fBase').value, 0)
      };
      s.teacherName = u.$('#fName').value.trim();
      term.update(cur.id, patch);
      db.save('settings');
      u.toast('当前学期设置已保存', 'ok'); render(host);
    };
    u.$('#btnPreviewCal').onclick = previewCalendar;
    u.$('#btnAddPeriod').onclick = () => editPeriod(null, () => render(host));
    u.$('#btnAddTerm').onclick = () => termDialog(null, () => render(host));
    u.$('#btnAddCls').onclick = () => editClass(null, () => render(host));
    u.$('#btnImpCls').onclick = () => importClasses(() => render(host));
    u.$('#btnCopyCls').onclick = () => copyClassesDialog(() => render(host));
    u.$('#btnTplCls').onclick = () => TW.io.exportTemplate(
      ['班级名称', '院系/专业', '年级', '人数', '备注'],
      [['2025级英语1班', '外国语学院', '2025', 42, '大学英语A'], ['2025级会计2班', '经管学院', '2025', 45, '']],
      '班级导入模板.xlsx', '班级');

    renderTermList();
    renderPeriods();
    renderClasses(cur);

    /* ---- 学期列表 ---- */
    function renderTermList() {
      const box = u.$('#termList');
      const ts = term.list();
      if (!ts.length) { box.innerHTML = '<div class="empty">还没有学期</div>'; return; }
      box.innerHTML = ts.map(t => {
        const isCur = t.id === term.currentId();
        return '<div class="row" style="padding:9px 0;border-bottom:1px dashed var(--line);gap:10px;align-items:center">' +
          '<span class="tag ' + (isCur ? 't-green' : 't-gray') + '">' + (isCur ? '当前' : '学期') + '</span>' +
          '<b style="flex:1;min-width:0">' + u.esc(t.schoolYear + ' ' + t.termName) + '</b>' +
          '<span class="muted" style="font-size:12px">第1周 ' + u.fmtCn(t.termStart) + ' · ' + (t.totalWeeks || 20) + '周</span>' +
          (isCur ? '' : '<button class="btn btn-sm" data-cur="' + t.id + '">设为当前</button>') +
          '<button class="btn btn-sm" data-edt="' + t.id + '">编辑</button>' +
          (ts.length > 1 ? '<button class="btn btn-sm btn-danger" data-del="' + t.id + '">删除</button>' : '') +
          '</div>';
      }).join('');
      u.$$('[data-cur]', box).forEach(b => b.onclick = () => { term.setCurrent(b.dataset.cur); u.toast('已切换到该学期', 'ok'); });
      u.$$('[data-edt]', box).forEach(b => b.onclick = () => termDialog(b.dataset.edt, () => render(host)));
      u.$$('[data-del]', box).forEach(b => b.onclick = () => u.confirm('删除该学期？其班级、课表、考试、调课、待办将一并删除（不可恢复）。', () => {
        try { term.remove(b.dataset.del); u.toast('学期已删除', 'ok'); render(host); }
        catch (e) { u.toast(e.message, 'warn'); }
      }));
    }

    /* ---- 节次 ---- */
    function renderPeriods() {
      const box = u.$('#periodList');
      if (!S.periods.length) { box.innerHTML = '<div class="empty">尚未设置节次</div>'; return; }
      box.innerHTML = S.periods.map(p =>
        '<div class="row" style="padding:7px 0;border-bottom:1px dashed var(--line)">' +
        '<b style="width:78px;font-size:13px">' + u.esc(p.name) + '</b>' +
        '<span class="muted" style="font-size:12px">' + u.esc(p.start) + ' — ' + u.esc(p.end) + '</span>' +
        '<span class="spacer"></span>' +
        '<button class="btn btn-sm" data-ed="' + p.id + '">编辑</button>' +
        '<button class="btn btn-sm btn-danger" data-del="' + p.id + '">删除</button></div>').join('');
      u.$$('[data-ed]', box).forEach(b => b.onclick = () => editPeriod(b.dataset.ed, () => render(host)));
      u.$$('[data-del]', box).forEach(b => b.onclick = () => {
        u.confirm('删除该节次？使用该节次的课表条目将失去时间信息。', () => {
          S.periods = S.periods.filter(x => x.id !== b.dataset.del); db.save('periods'); render(host);
        });
      });
    }

    /* ---- 班级（当前学期） ---- */
    function renderClasses() {
      const box = u.$('#clsList');
      const cls = term.classesOf();
      if (!cls.length) {
        box.innerHTML = '<div class="empty"><span class="em-ic">🏫</span>当前学期还没有教学班<br><span class="hint">先新增班级，课表、课堂记录、成绩分析都会自动关联；也可从其它学期复制</span></div>';
        return;
      }
      box.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
        '<th>班级名称</th><th>院系/专业</th><th>年级</th><th class="num">花名册</th><th class="num">周课时</th><th>备注</th><th></th>' +
        '</tr></thead><tbody>' +
        cls.map(c => {
          const stu = db.students(c.id).length;
          const per = term.scheduleItems().filter(x => x.classId === c.id).length;
          return '<tr><td><b>' + u.esc(c.name) + '</b></td><td>' + u.esc(c.dept || '—') + '</td><td>' + u.esc(c.grade || '—') + '</td>' +
            '<td class="num">' + (stu ? stu + ' 人' : '<span class="muted">未导入</span>') + '</td>' +
            '<td class="num">' + per + '</td><td class="ellipsis" style="max-width:180px">' + u.esc(c.note || '') + '</td>' +
            '<td class="nowrap"><button class="btn btn-sm" data-ed="' + c.id + '">编辑</button> ' +
            '<button class="btn btn-sm btn-danger" data-del="' + c.id + '">删除</button></td></tr>';
        }).join('') + '</tbody></table></div>';
      u.$$('[data-ed]', box).forEach(b => b.onclick = () => editClass(b.dataset.ed, () => render(host)));
      u.$$('[data-del]', box).forEach(b => b.onclick = () => {
        const c = db.cls(b.dataset.del);
        u.confirm('删除班级「' + (c ? c.name : '') + '」？其花名册、考勤、成绩记录将一并删除，且不可恢复。', () => {
          S.classes = S.classes.filter(x => x.id !== b.dataset.del);
          delete S.roster[b.dataset.del]; delete S.records[b.dataset.del]; delete S.bonus[b.dataset.del];
          S.schedule = S.schedule.filter(x => x.classId !== b.dataset.del);
          S.exams = S.exams.filter(x => x.classId !== b.dataset.del);
          db.save(); db.emit('data:reload'); render(host);
        });
      });
    }
  }

  /* ---------- 弹窗：学期 ---------- */
  function termDialog(id, done) {
    const S = TW.S, isNew = !id;
    const t = id ? term.list().find(x => x.id === id)
      : { id: '', schoolYear: '', termName: '第一学期', termStart: u.ymd(u.today()), totalWeeks: 20, scoreBase: 0 };
    const box = u.el('div');
    box.innerHTML = '<div class="form-grid">' +
      '<div class="field"><label>学年 *</label><input class="input" id="tY" value="' + u.esc(t.schoolYear) + '" placeholder="2026-2027"></div>' +
      '<div class="field"><label>学期</label><select class="select" id="tN">' +
      ['第一学期', '第二学期'].map(x => '<option' + (t.termName === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>第1教学周 · 周一 *</label><input class="input" type="date" id="tS" value="' + u.esc(t.termStart) + '"></div>' +
      '<div class="field"><label>总教学周数</label><input class="input" type="number" min="1" max="30" id="tW" value="' + (t.totalWeeks || 20) + '"></div>' +
      '<div class="field full"><label>平时成绩基础分</label><input class="input" type="number" id="tB" value="' + (t.scoreBase || 0) + '" placeholder="0"></div>' +
      '</div>' +
      (isNew ? '<label class="row" style="gap:8px;margin-top:6px"><input type="checkbox" id="tCopy"> <span class="hint">复制当前学期的班级与课表到新学期（适合授课班级相同的学期）</span></label>' : '');
    u.modal({
      title: id ? '编辑学期' : '新增学期', body: box,
      buttons: [{ text: '取消', class: 'btn', onClick: (b, c) => c() },
      {
        text: '保存', class: 'btn btn-primary', onClick: (b, c) => {
          const y = b.querySelector('#tY').value.trim();
          if (!y) { u.toast('请填写学年', 'warn'); return; }
          const st = b.querySelector('#tS').value;
          if (!st) { u.toast('请选择第1教学周周一', 'warn'); return; }
          const cfg = {
            schoolYear: y, termName: b.querySelector('#tN').value, termStart: st,
            totalWeeks: u.num(b.querySelector('#tW').value, 20), scoreBase: u.num(b.querySelector('#tB').value, 0)
          };
          if (id) { term.update(id, cfg); c(); done && done(); u.toast('学期已更新', 'ok'); }
          else {
            const nt = term.add(cfg);
            const copy = b.querySelector('#tCopy');
            if (copy && copy.checked) {
              const src = term.currentId();
              if (src && src !== nt.id) { term.copyFrom(src, nt.id); term.setCurrent(nt.id); }
            } else term.setCurrent(nt.id);
            c(); done && done(); u.toast('学期已创建' + (copy && copy.checked ? '，已复制班级与课表' : ''), 'ok');
          }
        }
      }]
    });
  }

  /* ---------- 弹窗：从其它学期复制班级 ---------- */
  function copyClassesDialog(done) {
    const cur = term.currentId();
    const others = term.list().filter(t => t.id !== cur);
    if (!others.length) { u.toast('暂无可复制的其它学期', 'warn'); return; }
    const box = u.el('div');
    box.innerHTML = '<div class="field"><label>选择来源学期</label><select class="select" id="cSrc" style="width:100%">' +
      others.map(t => '<option value="' + t.id + '">' + u.esc(t.schoolYear + ' ' + t.termName) + '（' + term.classesOf(t.id).length + '个班）</option>').join('') + '</select></div>' +
      '<div class="hint" style="margin-top:10px">将复制所选学期的<b>班级、课表条目及花名册/考勤/平时分</b>到当前学期（生成独立副本，可单独修改）。</div>';
    u.modal({
      title: '从其它学期复制班级', body: box,
      buttons: [{ text: '取消', class: 'btn', onClick: (b, c) => c() },
      {
        text: '开始复制', class: 'btn btn-primary', onClick: (b, c) => {
          const src = b.querySelector('#cSrc').value;
          term.copyFrom(src, cur);
          c(); done && done(); u.toast('已复制到当前学期', 'ok');
        }
      }]
    });
  }

  /* ---------- 弹窗：节次 ---------- */
  function editPeriod(id, done) {
    const S = TW.S;
    const p = id ? S.periods.find(x => x.id === id) : { id: u.uid('p'), name: '', start: '08:00', end: '09:35' };
    const box = u.el('div');
    box.innerHTML = '<div class="form-grid">' +
      '<div class="field full"><label>节次名称</label><input class="input" id="pn" value="' + u.esc(p.name) + '" placeholder="第1-2节"></div>' +
      '<div class="field"><label>开始时间</label><input class="input" type="time" id="ps" value="' + p.start + '"></div>' +
      '<div class="field"><label>结束时间</label><input class="input" type="time" id="pe" value="' + p.end + '"></div>' +
      '</div>';
    u.modal({
      title: id ? '编辑节次' : '新增节次', body: box,
      buttons: [{ text: '取消', class: 'btn', onClick: (b, c) => c() },
      {
        text: '保存', class: 'btn btn-primary', onClick: (b, c) => {
          p.name = b.querySelector('#pn').value.trim() || '未命名节次';
          p.start = b.querySelector('#ps').value; p.end = b.querySelector('#pe').value;
          if (!id) S.periods.push(p);
          S.periods.sort((a, x) => u.hm2min(a.start) - u.hm2min(x.start));
          TW.db.save('periods'); c(); done && done(); u.toast('已保存', 'ok');
        }
      }]
    });
  }

  /* ---------- 弹窗：班级 ---------- */
  function editClass(id, done) {
    const S = TW.S;
    const tid = term.currentId();
    const c0 = id ? db.cls(id) : { id: u.uid('c'), name: '', dept: '', grade: '', size: '', note: '', termId: tid };
    const box = u.el('div');
    box.innerHTML = '<div class="form-grid">' +
      '<div class="field full"><label>班级名称 *</label><input class="input" id="cn" value="' + u.esc(c0.name) + '" placeholder="如：2025级英语1班"></div>' +
      '<div class="field"><label>院系 / 专业</label><input class="input" id="cd" value="' + u.esc(c0.dept || '') + '"></div>' +
      '<div class="field"><label>年级</label><input class="input" id="cg" value="' + u.esc(c0.grade || '') + '" placeholder="2025"></div>' +
      '<div class="field full"><label>备注</label><input class="input" id="cnote" value="' + u.esc(c0.note || '') + '" placeholder="课程性质、教材版本等"></div>' +
      '</div>';
    u.modal({
      title: id ? '编辑班级' : '新增班级（当前学期）', body: box,
      buttons: [{ text: '取消', class: 'btn', onClick: (b, x) => x() },
      {
        text: '保存', class: 'btn btn-primary', onClick: (b, x) => {
          const n = b.querySelector('#cn').value.trim();
          if (!n) { u.toast('请填写班级名称', 'warn'); return; }
          c0.name = n; c0.dept = b.querySelector('#cd').value.trim();
          c0.grade = b.querySelector('#cg').value.trim(); c0.note = b.querySelector('#cnote').value.trim();
          if (!c0.termId) c0.termId = tid;
          if (!id) S.classes.push(c0);
          TW.db.save('classes'); TW.db.emit('classes:change'); x(); done && done(); u.toast('已保存', 'ok');
        }
      }]
    });
  }

  /* ---------- Excel 导入班级 ---------- */
  async function importClasses(done) {
    const f = await u.pickFile('.xlsx,.xls,.csv');
    if (!f) return;
    try {
      const rows = await TW.io.readSheet(f);
      const tid = term.currentId();
      let n = 0;
      rows.forEach(r => {
        const name = String(TW.io.pick(r, ['班级名称', '班级', '教学班', '班级名'])).trim();
        if (!name) return;
        if (term.classesOf().some(c => c.name === name)) return;
        TW.S.classes.push({
          id: u.uid('c'), name: name, termId: tid,
          dept: String(TW.io.pick(r, ['院系/专业', '院系', '专业', '系部'])).trim(),
          grade: String(TW.io.pick(r, ['年级'])).trim(),
          note: String(TW.io.pick(r, ['备注'])).trim()
        });
        n++;
      });
      TW.db.save('classes'); TW.db.emit('classes:change');
      u.toast('成功导入 ' + n + ' 个班级（当前学期）', 'ok'); done && done();
    } catch (e) { u.toast('导入失败：' + e.message, 'err', 4000); }
  }

  /* ---------- 校历周次表 ---------- */
  function previewCalendar() {
    const s = TW.S.settings, rows = [];
    for (let w = 1; w <= (s.totalWeeks || 20); w++) {
      const a = cal.dateOf(w, 1), b = cal.dateOf(w, 7);
      const isNow = cal.weekOf(u.today()) === w;
      rows.push('<tr' + (isNow ? ' style="background:var(--green-50);font-weight:600"' : '') + '><td>第' + w + '周</td><td>' +
        u.fmtCn(a) + ' — ' + u.fmtCn(b) + '</td><td>' + (isNow ? '<span class="tag t-green">本周</span>' : '') + '</td></tr>');
    }
    u.modal({
      title: cal.termLabel() + ' 校历周次表',
      body: '<div class="tbl-wrap" style="max-height:60vh"><table class="tbl"><thead><tr><th>教学周</th><th>日期区间</th><th></th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>',
      buttons: [{ text: '关闭', class: 'btn', onClick: (b, c) => c() }]
    });
  }

  TW.views.settings = { title: '基础设置', render: render };
  TW.editClass = editClass;
})(window.TW);
