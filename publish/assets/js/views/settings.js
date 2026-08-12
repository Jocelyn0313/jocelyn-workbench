/* =========================================================
   settings.js  系统设置 · 校历
   学年学期、第1教学周周一、总周数统一在此设置，并自动同步给教学工作台
   研究方向标签供文献雷达与科研模块分类使用
   ========================================================= */
window.JZ.views = window.JZ.views || {};
(function (JZ) {
  'use strict';
  const u = JZ.u, db = JZ.db, cal = JZ.cal, ui = JZ.ui;

  /* 合并并落盘设置（同时把校历同步给教学工作台） */
  function patch(p) {
    Object.assign(JZ.S.settings, p);
    JZ.S.settings.calAt = Date.now();
    db.save('settings');
    if (JZ.refreshTop) JZ.refreshTop();
  }

  /* 校历概览（实时换算） */
  function calPreview() {
    const s = JZ.S.settings;
    const r = cal.termRange();
    const w = cal.weekOf(u.today());
    const tp = cal.termProgress();
    const items = [
      ['学年学期', cal.termLabel()],
      ['第1教学周周一', u.ymd(cal.week1Monday())],
      ['学期起止', r.start + ' ～ ' + r.end],
      ['今日校历', w ? ('第' + w + '周 / 共' + s.totalWeeks + '周') : '不在本学期范围内'],
      ['学期进度', tp.passed + ' / ' + tp.total + ' 天（' + tp.pct + '%）']
    ];
    return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 20px">' +
      items.map(i => '<div style="display:flex;justify-content:space-between;gap:10px;border-bottom:1px dashed var(--line);padding-bottom:6px">' +
        '<span class="hint" style="white-space:nowrap">' + u.esc(i[0]) + '</span>' +
        '<b style="text-align:right;font-weight:600">' + u.esc(i[1]) + '</b></div>').join('') + '</div>';
  }

  /* 研究方向标签卡片（自带重绘） */
  function dirCard() {
    const host = u.el('div');
    function draw() {
      const dirs = JZ.S.settings.researchDirs || [];
      const c = ui.card({
        title: '研究方向标签', tone: 'p',
        hint: '文献雷达与科研模块按此分类',
        actions: [{ text: '＋添加方向', class: 'btn-purple', onClick: addDir }],
        body: '<div class="badges" style="margin:2px 0 2px">' + (dirs.length
          ? dirs.map((d, i) => '<span class="chip on" data-rm="' + i + '" style="cursor:pointer">' + u.esc(d) + '<b style="margin-left:7px;opacity:.6">×</b></span>').join('')
          : '<span class="hint" style="margin:0">尚未设置研究方向，点击下方添加</span>') + '</div>'
      });
      host.innerHTML = '';
      host.appendChild(c);
      u.$$('[data-rm]', c.bodyEl).forEach(b => b.onclick = () => {
        const i = +b.dataset.rm;
        const arr = JZ.S.settings.researchDirs;
        const name = arr[i]; arr.splice(i, 1);
        patch({ researchDirs: arr }); draw(); u.toast('已删除「' + name + '」', 'ok');
      });
    }
    function addDir() {
      u.prompt({ title: '添加研究方向', label: '方向名称（如 二语习得）', value: '' }).then(v => {
        if (!v) return; v = v.trim();
        const arr = JZ.S.settings.researchDirs || [];
        if (arr.indexOf(v) >= 0) { u.toast('该方向已存在', 'warn'); return; }
        arr.push(v); patch({ researchDirs: arr }); draw(); u.toast('已添加', 'ok');
      });
    }
    draw();
    return host;
  }

  JZ.views.settings = {
    render: function (host) {
      const s = JZ.S.settings;
      const body = ui.page(host, {
        title: '系统设置 · 校历',
        sub: '学年学期、第1教学周周一、总周数统一在此设置，并自动同步给教学工作台',
        actions: [{ text: '备份与恢复', class: 'btn-green', onClick: () => JZ.go('backup') }]
      });

      /* 1 校历设置 */
      const CAL_F = [
        { k: 'schoolYear', label: '学年', required: true, ph: '如 2025-2026', def: s.schoolYear },
        { k: 'termName', label: '学期', type: 'select', opts: ['第一学期', '第二学期'], def: s.termName },
        { k: 'termStart', label: '第1教学周周一', type: 'date', required: true, def: s.termStart, full: true, hint: '校历基准日，全站所有周次据此推算' },
        { k: 'totalWeeks', label: '学期总周数', type: 'number', min: 1, step: 1, def: s.totalWeeks }
      ];
      const calCard = ui.card({
        title: '校历设置', tone: 'k',
        hint: '修改后全站同步',
        actions: [{ text: '保存校历', class: 'btn-primary', onClick: saveCal }],
        body: ui.formHtml(CAL_F, s) + '<div class="cn-corner" style="margin-top:14px">' + calPreview() + '</div>'
      });
      body.appendChild(calCard);
      function saveCal() {
        const d = ui.collect(calCard.bodyEl, CAL_F);
        if (!d.schoolYear || !d.termStart) { u.toast('请填写学年和第1教学周周一', 'warn'); return; }
        patch({ schoolYear: d.schoolYear, termName: d.termName, termStart: d.termStart, totalWeeks: d.totalWeeks || 20 });
        u.toast('校历已保存并同步', 'ok');
        JZ.go('settings');
      }

      /* 2 个人信息 */
      const P_F = [
        { k: 'ownerName', label: '姓名', ph: '如 Jocelyn Z.', def: s.ownerName },
        { k: 'title', label: '职称 / 岗位', ph: '如 讲师', def: s.title },
        { k: 'dept', label: '所属部门', ph: '如 应用英语系', def: s.dept },
        { k: 'school', label: '学校名称', ph: '如 某某职业技术学院', def: s.school }
      ];
      const pCard = ui.card({
        title: '个人信息', tone: 'a',
        actions: [{ text: '保存资料', class: 'btn-primary', onClick: saveP }],
        body: ui.formHtml(P_F, s)
      });
      body.appendChild(pCard);
      function saveP() {
        const d = ui.collect(pCard.bodyEl, P_F);
        patch({ ownerName: d.ownerName, title: d.title, dept: d.dept, school: d.school });
        u.toast('个人资料已保存', 'ok');
        JZ.go('settings');
      }

      /* 3 研究方向标签 */
      body.appendChild(dirCard());

      /* 4 科研目标 */
      const G_F = [
        { k: 'litTarget', label: '每日文献目标（篇）', type: 'number', min: 0, def: s.litTarget, hint: '今日科研页据此推荐未读文献数量' },
        { k: 'hourTarget', label: '每日科研投入目标（小时）', type: 'number', min: 0, step: 0.5, def: s.hourTarget }
      ];
      const gCard = ui.card({
        title: '科研目标', tone: 'g',
        actions: [{ text: '保存目标', class: 'btn-primary', onClick: saveG }],
        body: ui.formHtml(G_F, s)
      });
      body.appendChild(gCard);
      function saveG() {
        const d = ui.collect(gCard.bodyEl, G_F);
        patch({ litTarget: d.litTarget === '' ? 0 : d.litTarget, hourTarget: d.hourTarget === '' ? 0 : d.hourTarget });
        u.toast('科研目标已保存', 'ok');
        JZ.go('settings');
      }

      /* 说明 */
      body.appendChild(ui.card({
        title: '关于本地存储', tone: 'p',
        body: '<div class="hint" style="line-height:1.9;margin:0">全部数据只保存在这台电脑的浏览器中，不上传任何服务器。' +
          '校历会在个人工作台与教学工作台之间自动同步，以最近一次修改为准。' +
          '换电脑或重装浏览器前，请到「备份与恢复」导出全量数据；大文件超过浏览器上限时，双击「启动工作台（推荐）.bat」以本地服务模式打开可获得完整支持。</div>'
      }));
    }
  };
})(window.JZ);
