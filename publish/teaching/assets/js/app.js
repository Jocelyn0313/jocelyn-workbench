/* =========================================================
   app.js  启动 / 路由 / 顶栏 / 备份恢复
   ========================================================= */
(function (TW) {
  'use strict';
  const u = TW.u, db = TW.db, cal = TW.cal;

  /* ---------- 备份与恢复视图 ---------- */
  TW.views.backup = {
    title: '备份与恢复',
    render: function (host) {
      const S = TW.S;
      const counts = {
        班级: S.classes.length,
        课表条目: S.schedule.length,
        授课记录: Object.keys(S.lessons).length,
        学生: Object.keys(S.roster).reduce((a, k) => a + S.roster[k].length, 0),
        考勤记录: Object.keys(S.records).reduce((a, k) => a + Object.keys(S.records[k]).length, 0),
        测试: S.exams.length,
        教学资源: S.resources.length,
        待办: S.todos.length,
        教学反思: S.reflections.length
      };
      host.innerHTML =
        '<div class="page-head"><div><h2 class="page-title">备份与恢复</h2>' +
        '<div class="page-sub">数据全部保存在本机浏览器，建议每周备份一次；更换电脑时用备份文件一键迁移</div></div></div>' +

        '<div class="grid g2">' +
        '<div class="card"><div class="card-head"><h3 class="card-title g"><i class="dot"></i>导出备份</h3></div>' +
        '<div class="row" style="gap:10px;margin-bottom:12px">' +
        '<button class="btn btn-primary" id="bkAll">全量备份（含教学资源文件）</button>' +
        '<button class="btn btn-green" id="bkData">仅备份数据（体积小）</button></div>' +
        '<div class="hint">全量备份包含上传的 PDF、音视频等文件，体积较大；仅数据备份包含课表、进度、花名册、考勤、成绩、反思、待办等全部结构化信息。</div>' +
        '<div class="divider"></div>' +
        '<div class="card-head"><h3 class="card-title"><i class="dot"></i>分项导出</h3></div>' +
        '<div class="row" style="gap:8px">' +
        '<button class="btn btn-sm" id="bkXlsx">导出全部数据为 Excel 工作簿</button>' +
        '<button class="btn btn-sm" id="bkLedger">导出学期教学台账 Word</button></div></div>' +

        '<div class="card"><div class="card-head"><h3 class="card-title p"><i class="dot"></i>恢复数据</h3></div>' +
        '<div class="row" style="gap:10px;margin-bottom:12px">' +
        '<button class="btn btn-purple" id="rsMerge">合并恢复（保留现有数据）</button>' +
        '<button class="btn btn-danger" id="rsReplace">覆盖恢复（清空后导入）</button></div>' +
        '<div class="hint">选择此前导出的 .json 备份文件。合并恢复会跳过 ID 相同的条目；覆盖恢复将完全以备份文件为准。</div>' +
        '<div class="divider"></div>' +
        '<div class="card-head"><h3 class="card-title k"><i class="dot"></i>危险操作</h3></div>' +
        '<button class="btn btn-danger" id="bkClear">清空全部数据</button>' +
        '<div class="hint" style="margin-top:8px">清空后不可撤销，请务必先导出备份。</div></div>' +
        '</div>' +

        '<div class="card"><div class="card-head"><h3 class="card-title a"><i class="dot"></i>当前数据概览</h3>' +
        '<span class="hint">存储引擎：' + (db.idbOK ? 'IndexedDB（支持大文件）' : 'localStorage（容量有限，建议用 http 方式打开）') + '</span></div>' +
        '<div class="grid g4">' + Object.keys(counts).map(k =>
          '<div class="stat"><div class="s-k">' + k + '</div><div class="s-v">' + counts[k] + '</div></div>').join('') + '</div></div>';

      u.$('#bkAll').onclick = () => TW.io.backup(true);
      u.$('#bkData').onclick = () => TW.io.backup(false);
      u.$('#bkXlsx').onclick = exportAllXlsx;
      u.$('#bkLedger').onclick = exportTermWord;
      u.$('#rsMerge').onclick = () => doRestore('merge', host);
      u.$('#rsReplace').onclick = () => doRestore('replace', host);
      u.$('#bkClear').onclick = () => u.confirm('确定清空全部数据？所有班级、课表、成绩、资源都会被删除，且无法恢复。', () => {
        u.confirm('最后确认：请再次点击「确定」执行清空。', async () => {
          await db.clearAll(); u.toast('数据已清空', 'ok'); TW.go('dashboard');
        });
      });
    }
  };

  async function doRestore(mode, host) {
    const f = await u.pickFile('.json'); if (!f) return;
    try {
      await TW.io.restore(f, mode);
      TW.views.backup.render(host); refreshTop();
    } catch (e) { u.toast('恢复失败：' + e.message, 'err', 4000); }
  }

  function exportAllXlsx() {
    const S = TW.S, sheets = [];
    sheets.push({
      name: '班级', rows: S.classes.map(c => ({
        班级: c.name, 院系专业: c.dept || '', 年级: c.grade || '', 人数: db.students(c.id).length, 备注: c.note || ''
      }))
    });
    sheets.push({
      name: '课表', rows: S.schedule.map(s => ({
        班级: db.clsName(s.classId), 课程: s.course, 星期: '周' + u.DAY_CN[s.dow % 7],
        节次: cal.periodInfo(s.periodId).name, 教室: s.room || '',
        周次: (s.weeks && s.weeks.length) ? s.weeks.join(',') : '全学期'
      }))
    });
    const occ = cal.allOccurrences();
    sheets.push({
      name: '授课进度', rows: occ.map(o => {
        const p = cal.progressOf(o);
        return {
          日期: o.date, 周次: o.week, 节次: o.pname, 班级: db.clsName(o.classId), 课程: o.course,
          课前进度: p.pre, 授课内容: p.content, 课后进度: p.post, 作业: p.homework, 备注: p.note
        };
      })
    });
    S.classes.forEach(c => {
      const stu = db.students(c.id); if (!stu.length) return;
      const cr = TW.views.classroom;
      sheets.push({
        name: (c.name + '_平时').slice(0, 28), rows: stu.map((s, i) => {
          const t = cr.totalOf(c.id, s.id), a = cr.attStat(c.id, s.id);
          return {
            序号: i + 1, 学号: s.sno || '', 姓名: s.name, 正常: a.normal, 请假: a.leave, 迟到: a.late,
            早退: a.early, 旷课: a.absent, 课堂得分: t.score, 竞赛加分: t.bonus, 平时总分: t.total
          };
        })
      });
    });
    sheets.push({
      name: '测试成绩', rows: (function () {
        const out = [];
        S.exams.forEach(e => {
          db.students(e.classId).forEach(s => {
            if (e.scores[s.id] === undefined) return;
            out.push({ 班级: db.clsName(e.classId), 测试: e.name, 类型: e.type, 日期: e.date, 满分: e.full, 学号: s.sno || '', 姓名: s.name, 成绩: e.scores[s.id] });
          });
        });
        return out;
      })()
    });
    sheets.push({
      name: '教学反思', rows: S.reflections.map(r => ({
        日期: r.date, 学期: r.term, 班级: db.clsName(r.classId), 类型: r.type, 标题: r.title, 内容: r.content, 改进措施: r.measure
      }))
    });
    sheets.push({
      name: '待办', rows: S.todos.map(t => ({
        事项: t.title, 说明: t.detail, 截止: t.due, 优先级: t.priority, 班级: t.classId ? db.clsName(t.classId) : '', 状态: t.done ? '已完成' : '未完成'
      }))
    });
    sheets.push({
      name: '资源清单', rows: S.resources.map(r => ({
        分类: r.cat, 子类: r.sub, 名称: r.title, 格式: r.ext, 大小: u.fmtSize(r.size), 标签: r.tags, 链接: r.link || ''
      }))
    });
    TW.io.exportBook(sheets.filter(s => s.rows && s.rows.length), '教学工作台全量数据_' + u.ymd(u.today()) + '.xlsx');
    u.toast('Excel 工作簿已导出', 'ok');
  }

  function exportTermWord() {
    const S = TW.S, occ = cal.allOccurrences().filter(o => o.date <= u.ymd(u.today()));
    let h = '<h1>' + u.esc(cal.termLabel()) + ' 教学工作台账</h1>' +
      '<div class="sub">任课教师：' + u.esc(S.settings.teacherName || '　　　') + '　·　制表日期：' + u.ymd(u.today()) + '</div>';
    h += '<h2>一、承担教学任务</h2><table><tr><th>班级</th><th>课程</th><th>周课时</th><th>学生数</th><th>本学期已授课次</th></tr>';
    S.classes.forEach(c => {
      const sc = S.schedule.filter(x => x.classId === c.id);
      if (!sc.length) return;
      const courses = Array.from(new Set(sc.map(x => x.course))).join('、');
      h += '<tr><td>' + u.esc(c.name) + '</td><td>' + u.esc(courses) + '</td><td>' + sc.length + '</td><td>' +
        db.students(c.id).length + '</td><td>' + occ.filter(o => o.classId === c.id).length + '</td></tr>';
    });
    h += '</table>';
    h += '<h2>二、授课进度记录（截至今日 ' + occ.length + ' 课次）</h2>' +
      '<table><tr><th>日期</th><th>周次</th><th>班级</th><th>课程</th><th>授课内容</th><th>课后进度</th></tr>';
    occ.forEach(o => {
      const p = cal.progressOf(o);
      h += '<tr><td>' + o.date + '</td><td>第' + o.week + '周</td><td>' + u.esc(db.clsName(o.classId)) + '</td><td>' + u.esc(o.course) +
        '</td><td>' + u.esc(p.content) + '</td><td>' + u.esc(p.post) + '</td></tr>';
    });
    h += '</table>';
    if (S.adjustments.length) {
      h += '<h2>三、调课记录</h2><table><tr><th>类型</th><th>原时间</th><th>调整为</th><th>事由</th></tr>' +
        S.adjustments.map(a => '<tr><td>' + ({ move: '调课', cancel: '停课', extra: '补课' }[a.type] || '') + '</td><td>' +
          (a.fromDate || '—') + '</td><td>' + (a.toDate || '不补') + '</td><td>' + u.esc(a.reason || '') + '</td></tr>').join('') + '</table>';
    }
    if (S.reflections.length) {
      h += '<h2>' + (S.adjustments.length ? '四' : '三') + '、教学反思摘要</h2><ul>' +
        S.reflections.slice(0, 30).map(r => '<li><b>' + u.esc(r.date) + '　' + u.esc(r.title || '') + '</b>：' + u.esc((r.content || '').slice(0, 120)) + '</li>').join('') + '</ul>';
    }
    TW.io.exportWord('教学工作台账', h, cal.termLabel() + '_教学工作台账_' + u.ymd(u.today()));
    u.toast('学期台账已导出', 'ok');
  }

  /* ---------- 顶栏 ---------- */
  function refreshTop() {
    const S = TW.S, t = u.ymd(u.today());
    const w = cal.weekOf(t), raw = cal.rawWeekOf(t);
    const sel = u.$('#tiTermSel');
    if (sel) {
      const terms = TW.term.list(), cur = TW.term.currentId();
      sel.innerHTML = terms.map(x => '<option value="' + x.id + '"' + (x.id === cur ? ' selected' : '') + '>' + u.esc(x.schoolYear + ' ' + x.termName) + '</option>').join('');
      sel.onchange = () => { if (sel.value) TW.term.setCurrent(sel.value); };
    }
    u.$('#tiDate').textContent = u.fmtCn(t) + ' 周' + u.DAY_CN[u.isoDow(t) % 7];
    u.$('#tiWeek').textContent = w ? '第 ' + w + ' 周 / ' + (S.settings.totalWeeks || 20) : (raw < 1 ? '开学前' : '学期已结束');
    const list = cal.lessonsOn(t);
    const cur = cal.currentLesson(list);
    u.$('#tiToday').textContent = list.length
      ? (cur.current ? '进行中 ' + cur.current.course : (cur.next ? '下一节 ' + cur.next.start : list.length + ' 节已结束'))
      : '今日无课';
    const sub = u.$('#brandSub');
    if (sub) sub.textContent = (S.settings.teacherName ? S.settings.teacherName + ' · ' : '') + '个人教学中枢';
  }

  /* ---------- 路由 ---------- */
  TW.current = '';
  TW.go = function (name) {
    if (!TW.views[name]) name = 'dashboard';
    TW.current = name;
    u.$$('.nav-item').forEach(n => n.classList.toggle('on', n.dataset.view === name));
    const host = u.$('#view');
    host.innerHTML = '';
    try { TW.views[name].render(host); }
    catch (e) {
      console.error(e);
      host.innerHTML = '<div class="card"><div class="empty"><span class="em-ic">⚠️</span>模块加载出错：' + u.esc(e.message) + '</div></div>';
    }
    window.scrollTo(0, 0);
    location.hash = '#' + name;
    closeNav();
    refreshTop();
  };

  function closeNav() { u.$('#sidebar').classList.remove('open'); u.$('#scrim').classList.remove('on'); }

  /* ---------- 启动 ---------- */
  async function boot() {
    const r = await db.load();
    if (!r.idb) {
      setTimeout(() => u.toast('当前为本地文件模式，大文件资源上传受限。建议通过网页链接访问以获得完整功能。', 'warn', 6000), 1200);
    }
    u.$$('.nav-item').forEach(n => n.onclick = () => TW.go(n.dataset.view));
    u.$('#btnNav').onclick = () => {
      const s = u.$('#sidebar');
      s.classList.toggle('open');
      u.$('#scrim').classList.toggle('on', s.classList.contains('open'));
    };
    u.$('#scrim').onclick = closeNav;
    u.$('#btnQuickTodo').onclick = () => TW.views.todo.quickAdd(() => { if (TW.current === 'todo' || TW.current === 'dashboard') TW.go(TW.current); });
    u.$('#btnBackupTop').onclick = () => TW.go('backup');

    db.on('data:reload', () => { refreshTop(); TW.go(TW.current || 'dashboard'); });
    db.on('settings:change', refreshTop);
    db.on('schedule:change', refreshTop);
    db.on('term:change', () => { refreshTop(); TW.go(TW.current || 'dashboard'); });

    window.addEventListener('hashchange', () => {
      const n = location.hash.replace('#', '');
      if (n && n !== TW.current) TW.go(n);
    });

    // 首次使用引导
    const firstRun = !TW.S.classes.length && !TW.S.schedule.length && !localStorage.getItem('tw:seen');
    const start = (location.hash || '#dashboard').replace('#', '');
    TW.go(TW.views[start] ? start : 'dashboard');
    db.updateQuota();
    setInterval(refreshTop, 60000);

    if (firstRun) { localStorage.setItem('tw:seen', '1'); setTimeout(welcome, 700); }
  }

  function welcome() {
    u.modal({
      title: '欢迎使用教学工作台',
      body:
        '<div style="line-height:1.9;font-size:13.5px">' +
        '<p style="margin-top:0">建议按以下顺序完成初始化，约 10 分钟即可投入使用：</p>' +
        '<ol style="padding-left:20px;margin:8px 0">' +
        '<li><b>基础设置</b>：先管理学期（可新增多个学期），再为当前学期填写学年、第1教学周的周一日期，全站周次以此为准</li>' +
        '<li><b>新增教学班</b>：班级信息一处录入，课表、考勤、成绩全板块共享</li>' +
        '<li><b>课表设置</b>：录入周固定课，系统自动推算整学期每一次课</li>' +
        '<li><b>导入花名册</b>：课堂记录区支持 Excel 一键导入</li>' +
        '</ol>' +
        '<p class="hint">所有数据仅保存在本机浏览器中，不会上传任何服务器。请定期使用「备份与恢复」导出数据文件。</p></div>',
      buttons: [
        { text: '稍后再说', class: 'btn', onClick: (b, c) => c() },
        { text: '开始设置', class: 'btn btn-primary', onClick: (b, c) => { c(); TW.go('settings'); } }
      ]
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.TW);
