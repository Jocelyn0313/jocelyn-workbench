/* =========================================================
   tw-bridge.js  把教学工作台（TW）并入个人工作台（JZ）单一应用
   - 将 TW 的 9 个视图注册进 JZ 路由（tw-dashboard / tw-schedule ...）
   - 重路由 TW.go 到 JZ.go，使教学模块内部跳转在单页内完成
   - 每个教学视图顶部挂一个学期切换条
   - 监听 term:change / data:reload，刷新当前教学视图
   - 暴露 JZ.initTeaching()，供 JZ 启动流程加载教学数据
   本文件必须晚于 TW 的 core 与 views 加载，早于 JZ app.js。
   ========================================================= */
window.JZ = window.JZ || {};
(function (JZ) {
  'use strict';
  const u = JZ.u;
  const PREFIX = 'tw-';
  // 需并入 JZ 路由的 TW 视图
  const VIEWS = ['dashboard', 'schedule', 'resources', 'reflection', 'todo', 'classroom', 'analytics', 'settings', 'backup'];

  function bindRouter() {
    const TW = window.TW;
    if (!TW) return;
    // 教学模块内部 TW.go('schedule') -> JZ.go('tw-schedule')
    TW.go = function (name) { JZ.go(PREFIX + name); };
    if (!TW.db || !TW.db.on) return;
    TW.db.on('term:change', () => {
      if (JZ.current && JZ.current.indexOf(PREFIX) === 0) JZ.go(JZ.current);
      if (JZ.refreshTop) JZ.refreshTop();
    });
    TW.db.on('data:reload', () => {
      if (JZ.current && JZ.current.indexOf(PREFIX) === 0) JZ.go(JZ.current);
    });
    TW.db.on('settings:change', () => { if (JZ.refreshTop) JZ.refreshTop(); });
  }

  /* 学期切换条：每个教学视图顶部一个轻量控件 */
  function termBar() {
    const TW = window.TW;
    if (!TW || !TW.term) return u.el('div');
    const bar = u.el('div', {
      style: 'display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap'
    });
    const terms = TW.term.list(), cur = TW.term.currentId();
    bar.innerHTML =
      '<span class="tag t-blue">当前学期</span>' +
      '<select class="select" id="twTermSel" style="max-width:240px">' +
      terms.map(x => '<option value="' + x.id + '"' + (x.id === cur ? ' selected' : '') + '>' + u.esc(x.schoolYear + ' ' + x.termName) + '</option>').join('') +
      '</select>' +
      '<span class="tag t-gray">' + u.esc(TW.cal.termLabel()) + '</span>';
    setTimeout(() => {
      const sel = u.$('#twTermSel', bar);
      if (sel) sel.onchange = () => { if (sel.value) TW.term.setCurrent(sel.value); };
    }, 0);
    return bar;
  }

  function register() {
    const TW = window.TW;
    if (!TW || !TW.views) return;
    VIEWS.forEach(name => {
      if (!TW.views[name]) return;
      JZ.views[PREFIX + name] = {
        render: function (host, param) {
          // dashboard 自带学期信息，不再重复挂条
          if (name !== 'dashboard') {
            try { host.appendChild(termBar()); } catch (e) { }
          }
          try { TW.views[name].render(host, param); }
          catch (e) {
            console.error(e);
            host.innerHTML += '<div class="card"><div class="empty"><span class="em-ic">⚠️</span>教学模块加载出错：' + u.esc(e.message) + '</div></div>';
          }
        }
      };
    });
  }

  /* 供 JZ app.js 启动调用：加载教学数据并挂载桥 */
  JZ.initTeaching = async function () {
    const TW = window.TW;
    if (!TW || !TW.db || !TW.db.load) return { idb: false, skipped: true };
    const r = await TW.db.load();
    bindRouter();
    register();
    return r;
  };

  JZ.teachingReady = function () {
    return !!(window.TW && window.TW.views && JZ.views[PREFIX + 'dashboard']);
  };
})(window.JZ);
