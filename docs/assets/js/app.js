/* =========================================================
   app.js  启动 / 路由 / 顶栏 / 快速记录
   ========================================================= */
window.JZ.views = window.JZ.views || {};

(function (JZ) {
  'use strict';
  const u = JZ.u, db = JZ.db, cal = JZ.cal;

  /* ---------- 顶栏 ---------- */
  function refreshTop() {
    const S = JZ.S, t = u.ymd(u.today());
    u.$('#tiTerm').textContent = (S.settings.schoolYear || '—') + ' ' + (S.settings.termName || '');
    u.$('#tiDate').textContent = u.fmtCn(t) + ' 周' + u.DAY_CN[u.isoDow(t) % 7];
    u.$('#tiWeek').textContent = cal.weekText(t);
    const due = JZ.stat.dueToday();
    u.$('#tiTodo').textContent = due.total ? due.total + '项待处理' + (due.over ? '（逾期' + due.over + '项）' : '') : '暂无待办';
    const sub = u.$('#brandSub');
    if (sub) sub.textContent = (S.settings.ownerName || '') + (S.settings.dept ? ' · ' + S.settings.dept : ' · 教学、部门、竞赛、科研');
    u.$$('.nav-item').forEach(n => {
      const badge = JZ.stat.navBadge(n.dataset.view);
      let b = n.querySelector('.nb');
      if (badge) { if (!b) { b = u.el('span', { class: 'nb' }); n.appendChild(b); } b.textContent = badge; }
      else if (b) b.remove();
    });
  }

  /* ---------- 统计（跨模块共享） ---------- */
  JZ.stat = {
    dueToday: function () {
      const t = u.ymd(u.today());
      const a = JZ.S.deptTodos.filter(x => !x.done && x.due && x.due <= t);
      const b = JZ.S.otherMemos.filter(x => !x.done && x.due && x.due <= t);
      const c = JZ.S.rsTasks.filter(x => !x.done && x.date && x.date <= t);
      const over = a.concat(b, c).filter(x => (x.due || x.date) < t).length;
      return { total: a.length + b.length + c.length, over: over, dept: a.length, other: b.length, rs: c.length };
    },
    navBadge: function (v) {
      const t = u.ymd(u.today());
      if (v === 'deptTodo') { const n = JZ.S.deptTodos.filter(x => !x.done && x.due && x.due <= t).length; return n || ''; }
      if (v === 'otherMemo') { const n = JZ.S.otherMemos.filter(x => !x.done && x.due && x.due <= t).length; return n || ''; }
      if (v === 'rsToday') { const n = JZ.S.rsTasks.filter(x => !x.done && x.date === t).length; return n || ''; }
      if (v === 'rsRadar') { const n = JZ.S.radar.filter(x => !x.read).length; return n || ''; }
      return '';
    }
  };

  /* ---------- 快速记录（记一条，按首页五大待办框分类） ---------- */
  function quickAdd() {
    const t = u.ymd(u.today());
    const opts = [
      { k: 'teach', t: '教学工作', tone: 'btn-green' },
      { k: 'deptTodos', t: '部门工作', tone: 'btn-primary' },
      { k: 'compWorks', t: '竞赛工作', tone: 'btn-purple' },
      { k: 'rsTasks', t: '科研工作', tone: 'btn-pink' },
      { k: 'otherMemos', t: '其它工作', tone: 'btn-ghost' }
    ];
    const wrap = u.el('div');
    wrap.innerHTML = '<div class="badges" style="margin-bottom:12px" id="qkTabs">' +
      opts.map((o, i) => '<span class="chip' + (i === 0 ? ' on' : '') + '" data-k="' + o.k + '">' + o.t + '</span>').join('') + '</div>' +
      '<div class="hint" style="margin:0 0 10px">选择上面的分类，保存后待办会出现在首页对应的待办框中</div>' +
      '<div class="field"><label>待办内容</label><textarea class="textarea" id="qkTxt" rows="4" placeholder="一句话记录，保存后显示在下方对应待办框"></textarea></div>' +
      '<div class="form-grid" style="margin-top:10px"><div class="field"><label>日期 / 截止</label>' +
      '<input class="input" type="date" id="qkDate" value="' + t + '"></div>' +
      '<div class="field"><label>标签 / 类别</label><input class="input" id="qkTag" placeholder="可留空，如 系部 / 竞赛名"></div></div>';
    let kind = 'teach';
    const m = u.modal({
      title: '记一条待办', body: wrap,
      buttons: [
        { text: '取消', class: 'btn', onClick: (b, c) => c() },
        { text: '保存', class: 'btn btn-primary', onClick: (b, c) => { doSave(b, c); } }
      ]
    });
    u.$$('#qkTabs .chip', m.body).forEach(ch => ch.onclick = () => {
      u.$$('#qkTabs .chip', m.body).forEach(x => x.classList.remove('on'));
      ch.classList.add('on'); kind = ch.dataset.k;
    });
    async function doSave(b, c) {
      const txt = u.$('#qkTxt', b).value.trim();
      if (!txt) { u.toast('内容不能为空', 'warn'); return; }
      const date = u.$('#qkDate', b).value, tag = u.$('#qkTag', b).value.trim();
      const title = txt.split('\n')[0].slice(0, 80);
      if (kind === 'teach') {
        await JZ.teach.pushTodo({ title: title, detail: txt, due: date, priority: '2' });
      } else if (kind === 'deptTodos') {
        db.add('deptTodos', { title: title, detail: txt, due: date, priority: '2', done: false, tag: tag });
      } else if (kind === 'compWorks') {
        db.add('compWorks', { name: title, summary: txt, status: '构思', members: tag, steps: [], createdAt: Date.now() });
      } else if (kind === 'rsTasks') {
        db.add('rsTasks', { title: title, note: txt, date: date, done: false, type: tag || '其它', minutes: 45 });
      } else {
        db.add('otherMemos', { title: title, content: txt, due: date, done: false, priority: '2', source: tag });
      }
      u.toast('已记录', 'ok');
      c(); refreshTop();
      if (JZ.current) JZ.go(JZ.current);
    }
  }

  /* ---------- 路由 ---------- */
  JZ.current = '';
  JZ.go = function (name, param) {
    if (!JZ.views[name]) name = 'dashboard';
    JZ.current = name; JZ.param = param || null;
    u.$$('.nav-item').forEach(n => n.classList.toggle('on', n.dataset.view === name));
    const host = u.$('#view');
    host.innerHTML = '';
    try { JZ.views[name].render(host, param); }
    catch (e) {
      console.error(e);
      host.innerHTML = '<div class="card"><div class="empty"><span class="em-ic">⚠️</span>模块加载出错：' + u.esc(e.message) + '</div></div>';
    }
    window.scrollTo(0, 0);
    location.hash = '#' + name;
    closeNav(); refreshTop();
  };
  function closeNav() { u.$('#sidebar').classList.remove('open'); u.$('#scrim').classList.remove('on'); }

  /* ---------- 云端同步（阶段2：本地优先 + 加密镜像） ---------- */
  function updateCloudBtn(s) {
    const b = u.$('#btnCloud'); if (!b) return;
    const dot = b.querySelector('.cdot'); const lbl = b.querySelector('.clbl');
    const map = { off: ['#bbb', '未连云端'], local: ['#f0a23b', '本机'], online: ['#3fbf6f', '已同步'], error: ['#e26a6a', '同步出错'] };
    const m = map[s] || map.off;
    if (dot) dot.style.background = m[0];
    if (lbl) lbl.textContent = m[1];
  }
  function authHTML() {
    return '<div class="hint" style="margin:0 0 10px">数据本地优先；登录后上传的是<b>加密密文</b>，云端不可读。邮箱与密码只用于登录，不会透露给我。</div>' +
      '<div class="form-grid"><div class="field"><label>邮箱</label><input class="input" id="clEmail" type="email" placeholder="你注册Supabase的邮箱"></div>' +
      '<div class="field"><label>密码（同时作为同步加密口令）</label><input class="input" id="clPass" type="password" placeholder="登录密码=加密口令"></div></div>' +
      '<div class="badges" style="margin-top:10px"><span class="chip on" id="clModeLogin">登录</span><span class="chip" id="clModeSign">注册新账号</span></div>' +
      '<button class="btn btn-primary" id="clSubmit" style="margin-top:12px">登录</button>' +
      '<div class="hint" style="margin-top:8px">首次使用先在Supabase后台关闭“确认邮箱”或点确认邮件；注册即建你自己的账号。</div>';
  }
  function loggedHTML() {
    const s = JZ.cloud.getSession();
    return '<div class="hint">已登录：' + (s ? u.esc(s.email) : '') + '</div>' +
      '<div class="row" style="margin-top:10px;gap:8px">' +
      '<button class="btn btn-primary" id="clPush">上传本地到云端</button>' +
      '<button class="btn" id="clPull">从云端拉取</button>' +
      '<button class="btn btn-ghost" id="clOut">退出登录</button></div>' +
      '<div class="hint" style="margin-top:8px">本地优先：上传=把本地加密后推云端；拉取=云端解密合并本地。</div>';
  }
  function bindCloud(body) {
    const submit = u.$('#clSubmit', body);
    if (!submit) {
      const push = u.$('#clPush', body), pull = u.$('#clPull', body), out = u.$('#clOut', body);
      if (push) push.onclick = async () => { try { const n = await JZ.cloud.pushAll(); u.toast('已上传加密数据 ' + n + ' 项', 'ok'); } catch (e) { u.toast('上传失败：' + e.message, 'warn', 5000); } };
      if (pull) pull.onclick = async () => { try { const n = await JZ.cloud.pullAndMerge(); u.toast('已拉取 ' + n + ' 项', 'ok'); refreshTop(); if (JZ.current) JZ.go(JZ.current); } catch (e) { u.toast('拉取失败：' + e.message, 'warn', 5000); } };
      if (out) out.onclick = async () => { try { await JZ.cloud.signOut(); u.toast('已退出', 'ok'); u.$('#cloudBody', body).innerHTML = authHTML(); bindCloud(body); updateCloudBtn('off'); } catch (e) { u.toast('退出失败：' + e.message, 'warn', 5000); } };
      return;
    }
    let mode = 'login';
    const loginChip = u.$('#clModeLogin', body), signChip = u.$('#clModeSign', body);
    loginChip.onclick = () => { mode = 'login'; loginChip.classList.add('on'); signChip.classList.remove('on'); submit.textContent = '登录'; };
    signChip.onclick = () => { mode = 'signup'; signChip.classList.add('on'); loginChip.classList.remove('on'); submit.textContent = '注册并连接'; };
    submit.onclick = async () => {
      const email = u.$('#clEmail', body).value.trim();
      const pass = u.$('#clPass', body).value;
      if (!email || !pass) { u.toast('邮箱和密码必填', 'warn'); return; }
      submit.disabled = true; submit.textContent = '处理中…';
      try {
        if (mode === 'signup') await JZ.cloud.signUp(email, pass); else await JZ.cloud.signIn(email, pass);
        await JZ.cloud.connect(pass);
        u.toast('已连接云端', 'ok');
        u.$('#cloudBody', body).innerHTML = loggedHTML(); bindCloud(body); refreshTop();
      } catch (e) {
        const tip = (mode === 'signup' ? '注册失败：' : '登录失败：') + e.message; u.toast(tip, 'warn', 6000);
        submit.disabled = false; submit.textContent = mode === 'signup' ? '注册并连接' : '登录';
      }
    };
  }
  function openCloudModal() {
    const wrap = u.el('div');
    wrap.innerHTML = '<div id="cloudBody">' + (JZ.cloud.isLoggedIn() ? loggedHTML() : authHTML()) + '</div>';
    u.modal({ title: '云端同步（Supabase）', body: wrap, buttons: [{ text: '关闭', class: 'btn', onClick: (b, c) => c() }] });
    bindCloud(wrap);
  }

  /* ---------- 启动 ---------- */
  async function boot() {
    const r = await db.load();
    // 加载教学工作台数据并挂载到单应用（共用同一 IndexedDB）
    if (JZ.initTeaching) { try { await JZ.initTeaching(); } catch (e) { console.error('教学模块加载失败', e); } }
    u.$$('.nav-item').forEach(n => n.onclick = () => JZ.go(n.dataset.view));
    u.$$('.nav-title').forEach(t => t.onclick = () => t.parentNode.classList.toggle('fold'));
    u.$('#btnNav').onclick = () => {
      const s = u.$('#sidebar');
      s.classList.toggle('open');
      u.$('#scrim').classList.toggle('on', s.classList.contains('open'));
    };
    u.$('#scrim').onclick = closeNav;
    u.$('#btnQuick').onclick = quickAdd;
    u.$('#btnBackupTop').onclick = () => JZ.go('backup');
    JZ.quickAdd = quickAdd;

    // 云端同步（阶段2：本地优先 + 加密镜像）
    if (JZ.cloud) {
      JZ.cloud.onStatus(updateCloudBtn);
      const clBtn = u.$('#btnCloud');
      if (clBtn) clBtn.onclick = openCloudModal;
      if (JZ.cloud.isLoggedIn()) {
        const cp = (function () { try { return localStorage.getItem('jz:syncPass') || ''; } catch (e) { return ''; } })();
        if (cp && navigator.onLine !== false) {
          JZ.cloud.connect(cp).then(function (n) {
            if (n) { refreshTop(); if (JZ.current) JZ.go(JZ.current); }
            u.toast('已从云端同步 ' + (n || 0) + ' 项', 'ok', 3000);
          }).catch(function (e) { console.warn('云端拉取失败', e); u.toast('云端同步失败：' + e.message, 'warn', 4000); });
        } else { updateCloudBtn('local'); }
      }
    }

    db.on('data:reload', () => { refreshTop(); JZ.go(JZ.current || 'dashboard'); });

    // 关闭/切后台前加固：立即本地落盘（绕开防抖）+ 教学工作台同落盘 + 尽力补推云端，防最后几秒改动丢失
    const hardFlush = () => {
      try {
        db.flushNow();
        const TWdb = window.TW && window.TW.db;
        if (TWdb && TWdb.flushNow) TWdb.flushNow();
        if (JZ.cloud && JZ.cloud.isLoggedIn()) JZ.cloud.flushNow();
      } catch (e) {}
    };
    window.addEventListener('pagehide', hardFlush);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') hardFlush(); });

    window.addEventListener('hashchange', () => {
      const n = location.hash.replace('#', '');
      if (n && n !== JZ.current) JZ.go(n);
    });

    const start = (location.hash || '#dashboard').replace('#', '');
    JZ.go(JZ.views[start] ? start : 'dashboard');
    db.updateQuota();
    setInterval(refreshTop, 60000);

    if (!r.idb) setTimeout(() => u.toast('当前为本地文件模式，大文件上传受限。双击「启动工作台（推荐）.bat」可获得完整大文件支持。', 'warn', 7000), 1200);
    if (r.fresh) setTimeout(welcome, 600);

    // 注册 Service Worker（仅 http/https；file:// 双击打开不注册，但数据仍持久化）
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => { /* 离线外壳不可用不影响数据 */ });
      });
    }
  }

  function welcome() {
    u.modal({
      title: '欢迎使用个人工作台',
      body:
        '<div style="line-height:1.9;font-size:13.5px">' +
        '<p style="margin-top:0">建议按以下顺序完成初始化，大约5分钟：</p>' +
        '<ol style="padding-left:20px;margin:8px 0">' +
        '<li><b>系统设置</b>：填写学年、学期、第1教学周的周一日期，全站周次以此校历为准，并自动同步给教学工作台</li>' +
        '<li><b>研究方向</b>：在系统设置里维护研究方向标签，文献雷达按方向推送</li>' +
        '<li><b>建立课题</b>：在课题研究或个人研究中新建项目，文献库、进度、实验、写作自动归位</li>' +
        '<li><b>定期备份</b>：备份与恢复支持全量导出，换电脑一键迁移</li>' +
        '</ol>' +
        '<p class="hint">全部数据只保存在这台电脑的浏览器里，不上传任何服务器。</p></div>',
      buttons: [
        { text: '先随便看看', class: 'btn', onClick: (b, c) => c() },
        { text: '去设置校历', class: 'btn btn-primary', onClick: (b, c) => { c(); JZ.go('settings'); } }
      ]
    });
  }

  JZ.refreshTop = refreshTop;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.JZ);
