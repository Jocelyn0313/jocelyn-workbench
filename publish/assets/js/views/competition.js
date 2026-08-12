/* =========================================================
   competition.js  三、竞赛工作：教师竞赛 / 学生竞赛
   结构：竞赛项目 → 年份 → 竞赛通知 / 备赛资料 / 参赛作品（全流程+素材+成果） / 竞赛结果
   ========================================================= */
window.JZ.views = window.JZ.views || {};
(function (JZ) {
  'use strict';
  const u = JZ.u, db = JZ.db, cal = JZ.cal, ui = JZ.ui;

  const LEVELS = ['校级', '市级', '省级', '国家级', '国际级', '行业协会', '其它'];
  const Y_STATUS = ['准备中', '备赛中', '已提交', '已获奖', '未获奖', '已归档'];
  const W_STATUS = ['构思', '制作中', '待修改', '已定稿', '已提交', '已获奖'];

  const COMP_F = [
    { k: 'name', label: '竞赛名称', required: true, full: true, ph: '如 全国高校外语教学大赛' },
    { k: 'org', label: '主办单位' },
    { k: 'level', label: '级别', type: 'select', opts: LEVELS, def: '省级' },
    { k: 'cycle', label: '举办周期', ph: '如 每年5月启动' },
    { k: 'site', label: '官网 / 报名入口', full: true, ph: 'https://' },
    { k: 'note', label: '简介与参赛要点', type: 'textarea', rows: 3, full: true }
  ];
  const YEAR_F = [
    { k: 'year', label: '年份 / 届次', required: true, ph: '如 2026 或 2026第八届' },
    { k: 'status', label: '本届状态', type: 'select', opts: Y_STATUS, def: '准备中' },
    { k: 'startDate', label: '启动日期', type: 'date' },
    { k: 'endDate', label: '截止 / 决赛日期', type: 'date' },
    { k: 'note', label: '本届备注', type: 'textarea', rows: 2, full: true }
  ];
  const ITEM_F = [
    { k: 'title', label: '标题', required: true, full: true },
    { k: 'date', label: '日期', type: 'date' },
    { k: 'link', label: '相关链接', full: true, ph: 'https://' },
    { k: 'content', label: '内容 / 要点摘录', type: 'textarea', rows: 5, full: true }
  ];
  const WORK_F = [
    { k: 'name', label: '作品名称', required: true, full: true },
    { k: 'members', label: '参赛人 / 团队', ph: '多人用顿号分隔' },
    { k: 'track', label: '组别 / 赛道', ph: '如 教学设计组' },
    { k: 'status', label: '当前状态', type: 'select', opts: W_STATUS, def: '构思' },
    { k: 'award', label: '获奖情况', ph: '如 省级二等奖' },
    { k: 'summary', label: '作品简介 / 亮点', type: 'textarea', rows: 3, full: true }
  ];

  const STEP_TPL = {
    teacher: ['研读文件与评分标准', '选题与教学设计', '素材收集与整理', '教案与讲稿撰写', '课件与视频制作', '试讲与磨课', '打磨修改定稿', '按要求报送提交'],
    student: ['宣讲动员与选拔', '组队与分工', '赛题解读与选题', '指导与资料准备', '作品创作与训练', '模拟演练与点评', '修改完善定稿', '报名提交与参赛']
  };

  const ITEM_CATS = [
    { k: 'notice', t: '竞赛通知', tone: '', icon: '📢', hint: '文件通知、报名要求、评分标准原文' },
    { k: 'prep', t: '备赛资料', tone: 'p', icon: '📚', hint: '往届优秀作品、参考文献、培训记录' },
    { k: 'result', t: '竞赛结果', tone: 'g', icon: '🏅', hint: '成绩公示、获奖证书、总结复盘' }
  ];

  /* ================= 视图工厂 ================= */
  function makeView(side, title, sub) {
    return {
      render: function (host, param) {
        const stKey = 'comp_' + side;
        let curId = param || JZ.viewState[stKey] || '';
        const mine = () => JZ.S.comps.filter(c => c.side === side)
          .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh'));
        if (curId && !JZ.S.comps.find(c => c.id === curId && c.side === side)) curId = '';

        const body = ui.page(host, {
          title: title, sub: sub,
          actions: [
            { text: '＋新建竞赛项目', class: 'btn-primary', onClick: newComp },
            { text: '总览统计', onClick: () => { curId = ''; JZ.viewState[stKey] = ''; draw(); } },
            { text: '导出全部竞赛', onClick: expAll }
          ]
        });
        const split = u.el('div', { class: 'split' });
        const sideBox = u.el('div', { class: 'side-list' });
        const main = u.el('div');
        split.appendChild(sideBox); split.appendChild(main);
        body.appendChild(split);
        draw();

        /* ---------- 左侧竞赛列表 ---------- */
        function drawSide() {
          const list = mine();
          sideBox.innerHTML = '<div class="sl-h">竞赛项目 ' + list.length + '</div>' +
            '<div class="sl-item' + (curId ? '' : ' on') + '" data-id="">总览与统计</div>' +
            (list.length ? list.map(c => {
              const yrs = JZ.S.compYears.filter(y => y.compId === c.id).length;
              const ws = JZ.S.compWorks.filter(w => w.compId === c.id).length;
              return '<div class="sl-item' + (c.id === curId ? ' on' : '') + '" data-id="' + c.id + '">' +
                '<span class="ellipsis">' + u.esc(c.name) + '</span>' +
                '<small>' + yrs + '届 / ' + ws + '作品</small></div>';
            }).join('')             : '<div class="hint" style="padding:10px">还没有竞赛项目</div>');
          u.$$('.sl-item', sideBox).forEach(it => it.onclick = () => {
            curId = it.dataset.id; JZ.viewState[stKey] = curId; draw();
          });
        }

        function draw() { drawSide(); main.innerHTML = ''; curId ? drawComp() : drawOverview(); }

        /* ---------- 总览 ---------- */
        function drawOverview() {
          const list = mine();
          const ids = new Set(list.map(c => c.id));
          const years = JZ.S.compYears.filter(y => ids.has(y.compId));
          const works = JZ.S.compWorks.filter(w => ids.has(w.compId));
          const awarded = works.filter(w => (w.award || '').trim()).length;
          const doing = years.filter(y => y.status === '备赛中' || y.status === '准备中').length;

          main.innerHTML = ui.stats([
            { k: '竞赛项目', v: list.length, x: side === 'teacher' ? '教师参赛' : '学生参赛' },
            { k: '累计届次', v: years.length, x: '进行中 ' + doing, tone: 'p' },
            { k: '参赛作品', v: works.length, x: '全流程留痕' },
            { k: '获奖作品', v: awarded, x: works.length ? '获奖率 ' + Math.round(awarded / works.length * 100) + '%' : '—', tone: 'k' }
          ]);

          const grid = u.el('div', { class: 'mini-grid', style: 'margin-top:16px' });
          if (!list.length) {
            grid.innerHTML = '';
            main.appendChild(ui.card({
              title: '开始建立竞赛档案', tone: 'p',
              body: '<div class="empty"><span class="em-ic">🏆</span>每一项竞赛建一个项目，项目内按年份归档通知、备赛资料、参赛作品与结果，' +
                '往届经验可直接复用。<div style="margin-top:12px"><button class="btn btn-primary" id="cpNew">＋新建第一个竞赛项目</button></div></div>'
            }));
            u.$('#cpNew', main).onclick = newComp;
            return;
          }
          list.forEach(c => {
            const yrs = JZ.S.compYears.filter(y => y.compId === c.id).sort((a, b) => (b.year || '') < (a.year || '') ? -1 : 1);
            const ws = JZ.S.compWorks.filter(w => w.compId === c.id);
            const aw = ws.filter(w => (w.award || '').trim());
            const cd = u.el('div', { class: 'mini cn-corner' });
            cd.innerHTML = '<h4>' + u.esc(c.name) + '</h4>' +
              '<div class="hint">' + u.esc(c.org || '未填主办单位') + '</div>' +
              '<div class="item-f"><span class="tag t-blue">' + u.esc(c.level || '—') + '</span>' +
              (yrs[0] ? '<span class="tag t-purple">最新 ' + u.esc(yrs[0].year) + ' · ' + u.esc(yrs[0].status || '') + '</span>' : '<span class="tag t-gray">未设年份</span>') +
              (aw.length ? '<span class="tag t-green">获奖' + aw.length + '</span>' : '') + '</div>' +
              '<div class="mini-f"><span>' + yrs.length + ' 届 · ' + ws.length + ' 件作品</span><span>进入 →</span></div>';
            cd.onclick = () => { curId = c.id; JZ.viewState[stKey] = c.id; draw(); };
            grid.appendChild(cd);
          });
          main.appendChild(ui.card({ title: '全部竞赛项目', count: list.length, body: grid }));

          // 近三年获奖一览
          const awList = works.filter(w => (w.award || '').trim())
            .sort((a, b) => (b.year || '') < (a.year || '') ? -1 : 1).slice(0, 12);
          main.appendChild(ui.card({
            title: '获奖记录', tone: 'k', count: awList.length,
            actions: [{ text: '导出获奖表', class: 'btn-sm', onClick: () => expAward(works, list) }],
            body: awList.length ? ui.timeline(awList.map(w => {
              const c = list.find(x => x.id === w.compId);
              return { date: w.year || '', title: w.award + '　' + w.name, text: (c ? c.name : '') + (w.members ? '　参赛：' + w.members : ''), tone: 'k' };
            })) : ui.empty('还没有获奖记录，先去登记参赛作品', '🏅')
          }));
        }

        /* ---------- 竞赛详情 ---------- */
        function drawComp() {
          const c = db.one('comps', curId);
          if (!c) { curId = ''; draw(); return; }
          const yrs = JZ.S.compYears.filter(y => y.compId === c.id)
            .sort((a, b) => (b.year || '') < (a.year || '') ? -1 : 1);
          let year = JZ.viewState['compY_' + c.id] || (yrs[0] ? yrs[0].year : '');
          if (year && !yrs.find(y => y.year === year)) year = yrs[0] ? yrs[0].year : '';

          /* 竞赛头卡 */
          const head = ui.card({
            title: c.name, tone: 'p',
            actions: [
              { text: '编辑竞赛', class: 'btn-sm', onClick: () => ui.editRecord('comps', COMP_F, c, { name: '竞赛项目', wide: true }, draw) },
              { text: '＋新增年份', class: 'btn-sm btn-primary', onClick: addYear },
              { text: '删除竞赛', class: 'btn-sm btn-danger', onClick: delComp }
            ],
            body: '<div class="row" style="flex-wrap:wrap;gap:8px">' +
              '<span class="tag t-blue">' + u.esc(c.level || '—') + '</span>' +
              (c.org ? '<span class="tag t-purple">' + u.esc(c.org) + '</span>' : '') +
              (c.cycle ? '<span class="tag t-amber">' + u.esc(c.cycle) + '</span>' : '') +
              (c.site ? '<a class="tag t-green" href="' + u.esc(c.site) + '" target="_blank">官网入口 ↗</a>' : '') +
              '<span class="tag t-gray">共 ' + yrs.length + ' 届</span></div>' +
              (c.note ? '<div class="item-x" style="margin-top:9px">' + u.esc(c.note) + '</div>' : '')
          });
          main.appendChild(head);

          if (!yrs.length) {
            main.appendChild(ui.card({
              title: '按年份建立档案',
              body: '<div class="empty"><span class="em-ic">📅</span>先添加一个年份（届次），随后即可分类归档竞赛通知、备赛资料、参赛作品与竞赛结果。' +
                '<div style="margin-top:12px"><button class="btn btn-primary" id="cpAddY">＋新增年份</button></div></div>'
            }));
            u.$('#cpAddY', main).onclick = addYear;
            return;
          }

          /* 年份标签 */
          const yBox = u.el('div');
          yBox.appendChild(ui.tabs(yrs.map(y => ({
            k: y.year, t: y.year + '　' + (y.status || ''),
            n: JZ.S.compWorks.filter(w => w.compId === c.id && w.year === y.year).length
          })), year, k => { year = k; JZ.viewState['compY_' + c.id] = k; draw(); }));
          main.appendChild(yBox);

          const yr = yrs.find(y => y.year === year);
          const ref = c.id + '@' + year;

          /* 本届概况 */
          const dueTxt = yr.endDate ? cal.dueText(yr.endDate) : '';
          const wkS = yr.startDate && cal.weekOf(yr.startDate) ? '第' + cal.weekOf(yr.startDate) + '周' : '';
          const wkE = yr.endDate && cal.weekOf(yr.endDate) ? '第' + cal.weekOf(yr.endDate) + '周' : '';
          main.appendChild(ui.card({
            title: year + ' 本届概况',
            actions: [
              { text: '编辑本届', class: 'btn-sm', onClick: () => ui.editRecord('compYears', YEAR_F, yr, { name: '年份' }, draw) },
              { text: '本届小结导出Word', class: 'btn-sm', onClick: () => expYearWord(c, yr) },
              { text: '删除本届', class: 'btn-sm btn-danger', onClick: () => ui.confirmDel(c.name + ' ' + year, () => { db.del('compYears', yr.id); JZ.viewState['compY_' + c.id] = ''; draw(); }) }
            ],
            body: '<div class="row" style="flex-wrap:wrap;gap:8px">' +
              '<span class="tag ' + (yr.status === '已获奖' ? 't-green' : yr.status === '备赛中' ? 't-amber' : 't-blue') + '">' + u.esc(yr.status || '') + '</span>' +
              (yr.startDate ? '<span class="tag t-gray">启动 ' + u.esc(yr.startDate) + (wkS ? ' · ' + wkS : '') + '</span>' : '') +
              (yr.endDate ? '<span class="tag ' + (dueTxt.indexOf('逾期') >= 0 ? 't-red' : 't-pink') + '">截止 ' + u.esc(yr.endDate) + (wkE ? ' · ' + wkE : '') + '　' + dueTxt + '</span>' : '') +
              '</div>' + (yr.note ? '<div class="item-x" style="margin-top:9px">' + u.esc(yr.note) + '</div>' : '')
          }));

          /* 三类条目区 */
          ITEM_CATS.forEach(cat => {
            const items = JZ.S.compItems.filter(x => x.compId === c.id && x.year === year && x.cat === cat.k)
              .sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1);
            const box = u.el('div');
            box.innerHTML = items.length ? items.map(x =>
              '<div class="item hl" data-id="' + x.id + '"><div class="item-h"><div style="min-width:0">' +
              '<div class="item-t">' + cat.icon + ' ' + u.esc(x.title) + '</div>' +
              (x.content ? '<div class="item-x">' + u.esc(x.content) + '</div>' : '') +
              '<div class="item-f">' + (x.date ? '<span class="tag t-blue">' + u.esc(x.date) +
                (cal.weekOf(x.date) ? ' · 第' + cal.weekOf(x.date) + '周' : '') + '</span>' : '') +
              (x.link ? '<a class="tag t-green" href="' + u.esc(x.link) + '" target="_blank">打开链接 ↗</a>' : '') + '</div></div>' +
              '<div class="row"><button class="btn btn-sm" data-a="ed">编辑</button>' +
              '<button class="btn btn-sm btn-danger" data-a="rm">删</button></div></div></div>').join('') : '';
            const fz = ui.fileZone({ cat: 'comp.' + cat.k, refId: ref, title: cat.t + '附件', hint: cat.hint });
            const wrap = u.el('div');
            wrap.appendChild(box); wrap.appendChild(fz);
            const cd = ui.card({
              title: cat.t, tone: cat.tone, count: items.length + db.filesOf('comp.' + cat.k, ref).length,
              actions: [{
                text: '＋记录一条', class: 'btn-sm btn-primary',
                onClick: () => ui.editRecord('compItems', ITEM_F, null, {
                  name: cat.t, wide: true, preset: { compId: c.id, year: year, cat: cat.k, date: u.ymd(u.today()) }
                }, draw)
              }],
              body: wrap
            });
            main.appendChild(cd);
            u.$$('.item', box).forEach(it => {
              const rec = db.one('compItems', it.dataset.id);
              u.$('[data-a="ed"]', it).onclick = () => ui.editRecord('compItems', ITEM_F, rec, { name: cat.t, wide: true }, draw);
              u.$('[data-a="rm"]', it).onclick = () => ui.confirmDel(rec.title, () => { db.del('compItems', rec.id); draw(); });
            });
          });

          /* 参赛作品 */
          const works = JZ.S.compWorks.filter(w => w.compId === c.id && w.year === year)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          const wg = u.el('div', { class: 'mini-grid' });
          if (!works.length) wg.innerHTML = ui.empty('本届还没有登记参赛作品', '🎨');
          works.forEach(w => {
            const st = w.steps || [];
            const done = st.filter(s => s.done).length;
            const pct = st.length ? Math.round(done / st.length * 100) : 0;
            const src = db.filesOf('comp.work.src', w.id).length, out = db.filesOf('comp.work.out', w.id).length;
            const cdw = u.el('div', { class: 'mini' });
            cdw.innerHTML = '<h4>' + u.esc(w.name) + '</h4>' +
              '<div class="hint">' + u.esc(w.members || '未填参赛人') + (w.track ? '　·　' + u.esc(w.track) : '') + '</div>' +
              '<div class="item-f"><span class="tag ' + (w.status === '已获奖' ? 't-green' : w.status === '已提交' || w.status === '已定稿' ? 't-blue' : 't-amber') + '">' + u.esc(w.status || '') + '</span>' +
              (w.award ? '<span class="tag t-pink">' + u.esc(w.award) + '</span>' : '') + '</div>' +
              '<div style="margin-top:9px">' + ui.bar(pct) + '</div>' +
              '<div class="mini-f"><span>流程 ' + done + '/' + st.length + '　素材' + src + '　成果' + out + '</span><span>进入 →</span></div>';
            cdw.onclick = () => workPanel(c, year, w);
            wg.appendChild(cdw);
          });
          main.appendChild(ui.card({
            title: '参赛作品（全流程 · 素材 · 成果）', tone: 'k', count: works.length,
            actions: [
              { text: '＋新建作品', class: 'btn-sm btn-primary', onClick: () => newWork(c, year) },
              { text: '作品清单导出', class: 'btn-sm', onClick: () => expWorks(c, year, works) }
            ],
            body: wg
          }));

          function addYear() {
            const nowY = String(new Date().getFullYear());
            ui.editRecord('compYears', YEAR_F, null, {
              name: '年份', preset: { compId: c.id, year: nowY, status: '准备中' }
            }, r => { JZ.viewState['compY_' + c.id] = r.year; draw(); });
          }
          function delComp() {
            u.confirm('删除竞赛「' + c.name + '」会同时删除其全部年份、条目与作品记录，确定继续？', () => {
              JZ.S.compYears.filter(y => y.compId === c.id).forEach(y => db.del('compYears', y.id));
              JZ.S.compItems.filter(x => x.compId === c.id).forEach(x => db.del('compItems', x.id));
              JZ.S.compWorks.filter(w => w.compId === c.id).forEach(w => db.del('compWorks', w.id));
              db.del('comps', c.id);
              curId = ''; JZ.viewState[stKey] = ''; draw();
              u.toast('已删除', 'ok');
            });
          }
        }

        /* ---------- 新建 ---------- */
        function newComp() {
          ui.editRecord('comps', COMP_F, null, {
            name: '竞赛项目', wide: true, preset: { side: side },
            tip: side === 'teacher' ? '教师个人或团队参加的教学、科研、技能类竞赛' : '指导学生参加的各类学科与技能竞赛'
          }, r => { curId = r.id; JZ.viewState[stKey] = r.id; draw(); });
        }
        function newWork(c, year) {
          ui.editModal({
            title: '新建参赛作品', wide: true,
            fields: WORK_F.concat([{
              k: 'tpl', label: '流程模板', type: 'select',
              opts: [{ v: 'y', t: '套用标准八步流程（推荐）' }, { v: 'n', t: '空白，稍后自定义' }], def: 'y'
            }]),
            value: { status: '构思' },
            onOk: d => {
              const steps = d.tpl === 'y' ? STEP_TPL[side].map(t => ({ t: t, done: false, date: '', note: '' })) : [];
              delete d.tpl;
              const r = db.add('compWorks', Object.assign({ compId: c.id, year: year, steps: steps }, d));
              u.toast('作品已创建', 'ok'); draw(); workPanel(c, year, r);
            }
          });
        }

        /* ---------- 作品面板：全流程 + 素材 + 成果 ---------- */
        function workPanel(c, year, w) {
          const wrap = u.el('div');
          const m = u.modal({
            title: '参赛作品 · ' + w.name, wide: true, body: wrap, autofocus: false,
            buttons: [
              { text: '导出作品档案Word', class: 'btn', onClick: () => expWorkWord(c, year, w) },
              { text: '删除作品', class: 'btn btn-danger', onClick: (b, close) => ui.confirmDel(w.name, () => { db.del('compWorks', w.id); close(); draw(); }) },
              { text: '完成', class: 'btn btn-primary', onClick: (b, close) => { close(); draw(); } }
            ]
          });
          paint();
          function paint() {
            wrap.innerHTML = '';
            const st = w.steps || [];
            const done = st.filter(s => s.done).length;
            const pct = st.length ? Math.round(done / st.length * 100) : 0;

            /* 基本信息 */
            const info = u.el('div');
            info.innerHTML = '<div class="row" style="flex-wrap:wrap;gap:8px;margin-bottom:9px">' +
              '<span class="tag t-blue">' + u.esc(c.name) + '</span><span class="tag t-purple">' + u.esc(year) + '</span>' +
              '<span class="tag t-amber">' + u.esc(w.status || '') + '</span>' +
              (w.track ? '<span class="tag t-gray">' + u.esc(w.track) + '</span>' : '') +
              (w.award ? '<span class="tag t-pink">' + u.esc(w.award) + '</span>' : '') +
              '<button class="btn btn-sm" id="wkEd">编辑基本信息</button></div>' +
              (w.members ? '<div class="hint">参赛：' + u.esc(w.members) + '</div>' : '') +
              (w.summary ? '<div class="item-x">' + u.esc(w.summary) + '</div>' : '') +
              '<div style="margin-top:10px">' + ui.bar(pct) + '</div>';
            wrap.appendChild(info);
            u.$('#wkEd', info).onclick = () => ui.editRecord('compWorks', WORK_F, w, { name: '作品', wide: true }, () => { w = db.one('compWorks', w.id); paint(); });

            /* 全流程 */
            const flow = u.el('div', { class: 'flow', style: 'margin-top:12px' });
            flow.innerHTML = st.length ? st.map((s, i) =>
              '<div class="fl-i ' + (s.done ? 'done' : '') + '" data-i="' + i + '">' +
              '<span class="fl-n">' + (i + 1) + '</span><div class="fl-b"><b>' + u.esc(s.t) + '</b>' +
              (s.date || s.note ? '<div class="hint">' + u.esc([s.date, s.note].filter(Boolean).join('　')) + '</div>' : '') + '</div>' +
              '<div class="row"><button class="btn btn-sm" data-a="tg">' + (s.done ? '撤销' : '完成') + '</button>' +
              '<button class="btn btn-sm" data-a="ed">改</button>' +
              '<button class="btn btn-sm btn-danger" data-a="rm">删</button></div></div>').join('')
              : '<div class="hint">还没有流程步骤，点右上角添加，或新建作品时套用模板</div>';
            wrap.appendChild(ui.card({
              title: '制作全流程', tone: 'p', count: done + '/' + st.length,
              actions: [
                { text: '＋加一步', class: 'btn-sm btn-primary', onClick: addStep },
                { text: '套用模板', class: 'btn-sm', onClick: applyTpl }
              ],
              body: flow
            }));
            u.$$('.fl-i', flow).forEach(fi => {
              const i = +fi.dataset.i;
              u.$('[data-a="tg"]', fi).onclick = () => {
                st[i].done = !st[i].done; st[i].date = st[i].done ? u.ymd(u.today()) : '';
                db.upd('compWorks', w.id, { steps: st }); paint();
              };
              u.$('[data-a="ed"]', fi).onclick = () => ui.editModal({
                title: '编辑步骤', fields: [
                  { k: 't', label: '步骤名称', required: true, full: true },
                  { k: 'date', label: '完成日期', type: 'date' },
                  { k: 'note', label: '过程记录', type: 'textarea', rows: 3, full: true }
                ], value: st[i], onOk: d => { Object.assign(st[i], d); db.upd('compWorks', w.id, { steps: st }); paint(); }
              });
              u.$('[data-a="rm"]', fi).onclick = () => { st.splice(i, 1); db.upd('compWorks', w.id, { steps: st }); paint(); };
            });
            function addStep() {
              ui.editModal({
                title: '新增步骤', fields: [
                  { k: 't', label: '步骤名称', required: true, full: true },
                  { k: 'note', label: '过程记录', type: 'textarea', rows: 3, full: true }
                ], value: {}, onOk: d => { st.push({ t: d.t, done: false, date: '', note: d.note || '' }); db.upd('compWorks', w.id, { steps: st }); paint(); }
              });
            }
            function applyTpl() {
              u.confirm('套用标准流程模板会在现有步骤后追加，确定继续？', () => {
                STEP_TPL[side].forEach(t => st.push({ t: t, done: false, date: '', note: '' }));
                db.upd('compWorks', w.id, { steps: st }); paint();
              });
            }

            /* 素材 / 成果 */
            wrap.appendChild(ui.card({
              title: '制作素材', count: db.filesOf('comp.work.src', w.id).length,
              body: ui.fileZone({ cat: 'comp.work.src', refId: w.id, title: '素材文件', hint: '教案初稿、图片、音视频、课件源文件、参考资料' })
            }));
            wrap.appendChild(ui.card({
              title: '作品成果', tone: 'g', count: db.filesOf('comp.work.out', w.id).length,
              body: ui.fileZone({ cat: 'comp.work.out', refId: w.id, title: '成果文件', hint: '最终报送稿、成品视频、获奖证书、评委反馈' })
            }));

            /* 过程手记 */
            wrap.appendChild(ui.card({
              title: '过程手记与反思', tone: 'k',
              body: ui.textBlock({
                title: '随时记录，自动保存', rows: 5, value: w.diary || '',
                ph: '磨课意见、评委反馈、下一届可复用的经验…',
                onSave: v => { db.upd('compWorks', w.id, { diary: v }); }
              })
            }));
          }
        }

        /* ---------- 导出 ---------- */
        function expAll() {
          const list = mine();
          if (!list.length) { u.toast('还没有竞赛数据', 'warn'); return; }
          const nameOf = id => (list.find(c => c.id === id) || {}).name || '';
          JZ.io.exportBook([
            { name: '竞赛项目', rows: list.map(c => ({ 竞赛名称: c.name, 主办单位: c.org || '', 级别: c.level || '', 周期: c.cycle || '', 官网: c.site || '', 简介: c.note || '' })) },
            { name: '年份届次', rows: JZ.S.compYears.filter(y => list.find(c => c.id === y.compId)).map(y => ({ 竞赛名称: nameOf(y.compId), 年份: y.year, 状态: y.status || '', 启动: y.startDate || '', 截止: y.endDate || '', 备注: y.note || '' })) },
            { name: '通知与资料', rows: JZ.S.compItems.filter(x => list.find(c => c.id === x.compId)).map(x => ({ 竞赛名称: nameOf(x.compId), 年份: x.year, 类别: ({ notice: '竞赛通知', prep: '备赛资料', result: '竞赛结果' })[x.cat] || x.cat, 标题: x.title, 日期: x.date || '', 内容: x.content || '', 链接: x.link || '' })) },
            { name: '参赛作品', rows: JZ.S.compWorks.filter(w => list.find(c => c.id === w.compId)).map(w => ({ 竞赛名称: nameOf(w.compId), 年份: w.year, 作品名称: w.name, 参赛人: w.members || '', 组别: w.track || '', 状态: w.status || '', 获奖: w.award || '', 流程完成: (w.steps || []).filter(s => s.done).length + '/' + (w.steps || []).length, 简介: w.summary || '' })) }
          ], (side === 'teacher' ? '教师竞赛' : '学生竞赛') + '全量数据_' + u.ymd(u.today()) + '.xlsx');
          u.toast('已导出Excel工作簿', 'ok');
        }
        function expAward(works, list) {
          const rows = works.filter(w => (w.award || '').trim()).map(w => ({
            年份: w.year, 竞赛名称: (list.find(c => c.id === w.compId) || {}).name || '',
            作品名称: w.name, 参赛人: w.members || '', 获奖等级: w.award, 组别: w.track || ''
          }));
          if (!rows.length) { u.toast('还没有获奖记录', 'warn'); return; }
          JZ.io.exportRows(rows, (side === 'teacher' ? '教师' : '学生') + '竞赛获奖一览_' + u.ymd(u.today()) + '.xlsx', '获奖一览');
          u.toast('已导出', 'ok');
        }
        function expWorks(c, year, works) {
          if (!works.length) { u.toast('本届还没有作品', 'warn'); return; }
          JZ.io.exportRows(works.map(w => ({
            作品名称: w.name, 参赛人: w.members || '', 组别: w.track || '', 状态: w.status || '',
            获奖: w.award || '', 流程完成: (w.steps || []).filter(s => s.done).length + '/' + (w.steps || []).length,
            简介: w.summary || '', 手记: w.diary || ''
          })), c.name + '_' + year + '_参赛作品.xlsx', '参赛作品');
          u.toast('已导出', 'ok');
        }
        function expYearWord(c, yr) {
          const items = JZ.S.compItems.filter(x => x.compId === c.id && x.year === yr.year);
          const works = JZ.S.compWorks.filter(w => w.compId === c.id && w.year === yr.year);
          const sec = k => items.filter(x => x.cat === k).map(x =>
            '<h3>' + u.esc(x.title) + '</h3><p class="meta">' + u.esc(x.date || '') + '</p><p>' + u.esc(x.content || '').replace(/\n/g, '<br>') + '</p>').join('') || '<p class="meta">（无记录）</p>';
          JZ.io.exportWord(c.name + ' ' + yr.year + ' 参赛工作小结',
            '<h1>' + u.esc(c.name) + '　' + u.esc(yr.year) + '　参赛工作小结</h1>' +
            '<div class="sub">' + u.esc(c.org || '') + '　' + u.esc(c.level || '') + '　制表 ' + u.ymd(u.today()) + '</div>' +
            '<h2>一、本届基本情况</h2><p>状态：' + u.esc(yr.status || '') + '；启动：' + u.esc(yr.startDate || '—') + '；截止：' + u.esc(yr.endDate || '—') + '。</p>' +
            (yr.note ? '<p>' + u.esc(yr.note).replace(/\n/g, '<br>') + '</p>' : '') +
            '<h2>二、竞赛通知</h2>' + sec('notice') +
            '<h2>三、备赛资料</h2>' + sec('prep') +
            '<h2>四、参赛作品</h2>' +
            (works.length ? '<table><tr><th>作品名称</th><th>参赛人</th><th>状态</th><th>获奖</th><th>流程完成</th></tr>' +
              works.map(w => '<tr><td>' + u.esc(w.name) + '</td><td>' + u.esc(w.members || '') + '</td><td>' + u.esc(w.status || '') +
                '</td><td>' + u.esc(w.award || '') + '</td><td>' + (w.steps || []).filter(s => s.done).length + '/' + (w.steps || []).length + '</td></tr>').join('') + '</table>'
              : '<p class="meta">（无作品）</p>') +
            '<h2>五、竞赛结果与复盘</h2>' + sec('result'),
            c.name + '_' + yr.year + '_参赛小结');
          u.toast('Word已生成', 'ok');
        }
        function expWorkWord(c, year, w) {
          const st = w.steps || [];
          JZ.io.exportWord(w.name + ' 作品档案',
            '<h1>' + u.esc(w.name) + '</h1>' +
            '<div class="sub">' + u.esc(c.name) + '　' + u.esc(year) + '　' + u.esc(w.track || '') + '</div>' +
            '<h2>一、基本信息</h2><table>' +
            '<tr><th>参赛人</th><td>' + u.esc(w.members || '') + '</td><th>状态</th><td>' + u.esc(w.status || '') + '</td></tr>' +
            '<tr><th>获奖情况</th><td colspan="3">' + u.esc(w.award || '尚未公布') + '</td></tr></table>' +
            (w.summary ? '<h2>二、作品简介</h2><p>' + u.esc(w.summary).replace(/\n/g, '<br>') + '</p>' : '') +
            '<h2>三、制作全流程</h2>' +
            (st.length ? '<table><tr><th>序</th><th>步骤</th><th>完成</th><th>日期</th><th>过程记录</th></tr>' +
              st.map((s, i) => '<tr><td>' + (i + 1) + '</td><td>' + u.esc(s.t) + '</td><td>' + (s.done ? '√' : '') + '</td><td>' + u.esc(s.date || '') + '</td><td>' + u.esc(s.note || '') + '</td></tr>').join('') + '</table>' : '<p class="meta">（无）</p>') +
            '<h2>四、素材与成果清单</h2>' +
            '<p><b>素材：</b>' + (db.filesOf('comp.work.src', w.id).map(f => u.esc(f.name)).join('、') || '（无）') + '</p>' +
            '<p><b>成果：</b>' + (db.filesOf('comp.work.out', w.id).map(f => u.esc(f.name)).join('、') || '（无）') + '</p>' +
            (w.diary ? '<h2>五、过程手记与反思</h2><p>' + u.esc(w.diary).replace(/\n/g, '<br>') + '</p>' : ''),
            w.name + '_作品档案');
          u.toast('Word已生成', 'ok');
        }
      }
    };
  }

  JZ.views.compTeacher = makeView('teacher', '教师竞赛',
    '教学能力大赛、微课、说课、课件等教师参赛项目，按竞赛与年份归档全流程');
  JZ.views.compStudent = makeView('student', '学生竞赛',
    '指导学生参加的各类竞赛，选手、作品、辅导过程与获奖情况一处管理');

})(window.JZ);
