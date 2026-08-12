/* =========================================================
   teaching.js  一、教学工作区（并入单应用，应用内导航）
   ========================================================= */
window.JZ.views = window.JZ.views || {};
(function (JZ) {
  'use strict';
  const u = JZ.u, db = JZ.db, cal = JZ.cal, ui = JZ.ui;

  const SUBS = [
    { h: 'tw-dashboard', t: '教学首页', x: '今日课表与授课进度', ic: 'ic-home' },
    { h: 'tw-schedule', t: '教学课表', x: '周课表、调停补课', ic: 'ic-schedule' },
    { h: 'tw-resources', t: '教学资源', x: '课件、音视频、试题', ic: 'ic-resource' },
    { h: 'tw-reflection', t: '教学反思', x: '课后反思与改进', ic: 'ic-reflect' },
    { h: 'tw-todo', t: '教学待办', x: '备课事项提醒', ic: 'ic-todo' },
    { h: 'tw-classroom', t: '考勤与平时分', x: '花名册与课堂记录', ic: 'ic-classroom' },
    { h: 'tw-analytics', t: '成绩与学情', x: '成绩分析与图表', ic: 'ic-analytics' },
    { h: 'tw-settings', t: '基础设置', x: '班级与节次、学期', ic: 'ic-settings' }
  ];

  JZ.views.teaching = {
    render: function (host) {
      const body = ui.page(host, {
        title: '一、教学工作区',
        sub: '备课、课堂记录、学情分析已并入本工作台，校历与学年学期共用一份',
        actions: [
          { text: '进入教学首页', class: 'btn-primary', onClick: () => JZ.go('tw-dashboard') }
        ]
      });

      const entry = u.el('div', { class: 'card' });
      entry.innerHTML =
        '<div class="entry"><div class="entry-ic">📘</div>' +
        '<div style="flex:1;min-width:0"><h3>教学工作台</h3>' +
        '<div class="hint">备课工作区（课表、资源、反思、待办）· 课堂记录区（考勤与平时分）· 学情记录区（成绩分析）</div>' +
        '<div class="badges" style="margin-top:9px">' +
        '<span class="tag t-blue">' + u.esc(cal.termLabel()) + '</span>' +
        '<span class="tag t-green">' + u.esc(cal.weekText(u.ymd(u.today()))) + '</span>' +
        '<span class="tag t-purple">校历已同步</span></div></div>' +
        '<button class="btn btn-primary" id="btnOpen">立即进入 →</button></div>';
      body.appendChild(entry);
      u.$('#btnOpen', entry).onclick = () => JZ.go('tw-dashboard');

      const quick = ui.card({
        title: '模块直达', tone: 'p',
        hint: '点击任意模块，在本工作台内直接打开（无需新窗口）',
        body: '<div class="mini-grid">' + SUBS.map(s =>
          '<div class="mini" data-h="' + s.h + '"><h4><svg class="ic"><use href="#' + s.ic + '"></use></svg>' + u.esc(s.t) + '</h4>' +
          '<div class="hint">' + u.esc(s.x) + '</div>' +
          '<div class="mini-f"><span class="tag t-gray">教学工作台</span><span style="color:var(--blue-600)">打开 →</span></div></div>').join('') + '</div>'
      });
      body.appendChild(quick);
      u.$$('.mini', quick).forEach(m => m.onclick = () => JZ.go(m.dataset.h));

      /* 校历一致性 */
      const shared = readCal();
      const s = JZ.S.settings;
      const same = shared && shared.termStart === s.termStart && String(shared.totalWeeks) === String(s.totalWeeks) &&
        shared.schoolYear === s.schoolYear && shared.termName === s.termName;
      body.appendChild(ui.card({
        title: '校历同步', tone: same ? 'g' : 'k',
        body: '<div class="hint" style="margin-bottom:10px">全站所有「第几周」以系统设置里的校历为准。个人工作台与教学工作台通过本机共享同一份校历，任意一侧修改后，另一侧刷新即可生效。</div>' +
          '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>项目</th><th>个人工作台</th><th>教学工作台（共享记录）</th></tr></thead><tbody>' +
          row('学年', s.schoolYear, shared && shared.schoolYear) +
          row('学期', s.termName, shared && shared.termName) +
          row('第1教学周周一', s.termStart, shared && shared.termStart) +
          row('总周数', s.totalWeeks, shared && shared.totalWeeks) +
          '</tbody></table></div>' +
          '<div class="row" style="margin-top:12px"><button class="btn btn-sm btn-primary" id="pushCal">以个人工作台为准，推送校历</button>' +
          '<button class="btn btn-sm" id="pullCal">读取教学工作台校历</button>' +
          '<button class="btn btn-sm btn-ghost" id="goSet">去修改校历</button></div>'
      }));
      u.$('#pushCal', body).onclick = () => {
        JZ.S.settings.calAt = Date.now(); db.save('settings'); db.writeSharedCal();
        u.toast('已推送，教学工作台刷新后生效', 'ok'); JZ.go('teaching');
      };
      u.$('#pullCal', body).onclick = () => {
        JZ.S.settings.calAt = 0;
        db.syncSharedCal() ? u.toast('已读取共享校历', 'ok') : u.toast('共享校历没有更新', 'warn');
        JZ.refreshTop(); JZ.go('teaching');
      };
      u.$('#goSet', body).onclick = () => JZ.go('settings');
    }
  };

  function row(k, a, b) {
    const ok = String(a || '') === String(b || '');
    return '<tr><td>' + k + '</td><td>' + u.esc(a || '—') + '</td><td>' +
      (b === undefined || b === null || b === '' ? '<span class="muted">未记录</span>' : u.esc(b)) +
      (ok ? ' <span class="tag t-green">一致</span>' : ' <span class="tag t-amber">待同步</span>') + '</td></tr>';
  }
  function readCal() {
    try { return JSON.parse(localStorage.getItem('jz:sharedCalendar') || 'null'); } catch (e) { return null; }
  }
})(window.JZ);
