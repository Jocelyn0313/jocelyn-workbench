/* =========================================================
   project.js  四、科研工作（二）：课题研究 / 个人研究 / 学术资料库 / 投稿管理 / 学术产出
   项目视图内含：概览 · 文献库（四区） · 会议期刊雷达 · 进度记录 · 实验调查 · 写作 · 资料
   ========================================================= */
window.JZ.views = window.JZ.views || {};
(function (JZ) {
  'use strict';
  const u = JZ.u, db = JZ.db, cal = JZ.cal, ui = JZ.ui;

  const P_STATUS = ['筹备中', '已立项', '研究中', '中期检查', '结题撰写', '已结题', '暂停'];
  const P_LEVEL = ['校级', '市厅级', '省级', '国家级', '横向课题', '自选研究'];
  const P_ROLE = ['主持人', '第一参与人', '参与人', '指导教师'];
  const LIT_ZONES = [
    { k: '待读', t: '待读区', tone: '', icon: '📥', hint: '刚收集、还没细看的文献' },
    { k: '在读', t: '精读区', tone: 'p', icon: '🔍', hint: '正在精读并做笔记的文献' },
    { k: '已读', t: '已读区', tone: 'g', icon: '✅', hint: '读完并已提炼要点' },
    { k: '核心', t: '核心必引区', tone: 'k', icon: '⭐', hint: '写作时必须引用的核心文献' }
  ];
  const V_TYPES = ['期刊', '学术会议', '课题申报', '征文', '出版社'];
  const OUT_TYPES = ['期刊论文', '会议论文', '专著/教材', '教改课题', '专利/软著', '获奖', '标准/报告', '其它'];
  const SUB_STATUS = ['准备中', '已投稿', '外审中', '退修中', '已录用', '已见刊', '被拒', '撤稿'];

  function dirsOf(p) {
    const g = (JZ.S.settings.researchDirs || []).filter(Boolean);
    const own = String((p && p.dirs) || '').split(/[，,、;；]/).map(s => s.trim()).filter(Boolean);
    return Array.from(new Set(own.concat(g)));
  }
  function projOpts() {
    const arr = [{ v: '', t: '不关联项目' }];
    JZ.S.projects.forEach(p => arr.push({ v: p.id, t: (p.kind === 'topic' ? '［课题］' : '［个人］') + p.name }));
    return arr;
  }
  function projName(id) { const p = db.one('projects', id); return p ? p.name : ''; }

  const PROJ_F = kind => [
    { k: 'name', label: kind === 'topic' ? '课题名称' : '研究主题', required: true, full: true },
    { k: 'code', label: '立项编号' },
    { k: 'level', label: '级别', type: 'select', opts: P_LEVEL, def: kind === 'topic' ? '校级' : '自选研究' },
    { k: 'role', label: '本人角色', type: 'select', opts: P_ROLE, def: '主持人' },
    { k: 'status', label: '状态', type: 'select', opts: P_STATUS, def: kind === 'topic' ? '筹备中' : '研究中' },
    { k: 'startDate', label: '开始日期', type: 'date' },
    { k: 'endDate', label: '结题 / 目标日期', type: 'date' },
    { k: 'pct', label: '完成度（%）', type: 'number', def: 0, min: 0 },
    { k: 'members', label: '成员', full: true, ph: '多人用顿号分隔' },
    { k: 'dirs', label: '研究方向标签', full: true, ph: '多个用顿号分隔，用于文献归类' },
    { k: 'abstract', label: '研究内容简介', type: 'textarea', rows: 4, full: true },
    { k: 'target', label: '预期成果', type: 'textarea', rows: 3, full: true }
  ];
  const LIT_F = p => [
    { k: 'title', label: '文献标题', required: true, full: true },
    { k: 'authors', label: '作者' },
    { k: 'year', label: '发表年份' },
    { k: 'source', label: '期刊 / 出处' },
    { k: 'dir', label: '研究方向', type: 'select', opts: [''].concat(dirsOf(p)) },
    { k: 'status', label: '所在分区', type: 'select', opts: LIT_ZONES.map(z => z.k), def: '待读' },
    { k: 'doi', label: 'DOI / 编号' },
    { k: 'url', label: '链接', full: true, ph: 'https://' },
    { k: 'summary', label: '核心观点与方法', type: 'textarea', rows: 4, full: true },
    { k: 'quotes', label: '可引用原文摘录', type: 'textarea', rows: 4, full: true },
    { k: 'ideas', label: '对我的启发 / 可借鉴之处', type: 'textarea', rows: 3, full: true },
    { k: 'tags', label: '标签' }
  ];
  const VEN_F = [
    { k: 'name', label: '名称', required: true, full: true, ph: '如 现代外语 / 中国外语教育研究会年会' },
    { k: 'type', label: '类型', type: 'select', opts: V_TYPES, def: '期刊' },
    { k: 'level', label: '层次', ph: '如 CSSCI / 北大核心 / 普刊 / 一级学会' },
    { k: 'deadline', label: '截稿 / 申报截止', type: 'date' },
    { k: 'cycle', label: '周期与节奏', ph: '如 每年3月征稿，审稿约2个月' },
    { k: 'fee', label: '版面费 / 会务费' },
    { k: 'url', label: '官网 / 投稿系统', full: true, ph: 'https://' },
    { k: 'require', label: '选题偏好与格式要求', type: 'textarea', rows: 4, full: true },
    { k: 'note', label: '备注', type: 'textarea', rows: 2, full: true }
  ];
  const PRO_F = [
    { k: 'title', label: '进度标题', required: true, full: true },
    { k: 'date', label: '日期', type: 'date' },
    { k: 'pct', label: '完成度（%）', type: 'number', min: 0 },
    { k: 'tag', label: '阶段', ph: '如 开题 / 中期 / 数据' },
    { k: 'content', label: '具体进展', type: 'textarea', rows: 4, full: true }
  ];
  const EXP_F = [
    { k: 'name', label: '实验 / 调查名称', required: true, full: true },
    { k: 'method', label: '方法', ph: '如 准实验 / 问卷 / 访谈 / 语料分析' },
    { k: 'date', label: '实施日期', type: 'date' },
    { k: 'status', label: '状态', type: 'select', opts: ['设计中', '实施中', '数据整理', '已完成'], def: '设计中' },
    { k: 'content', label: '设计与实施过程', type: 'textarea', rows: 4, full: true },
    { k: 'result', label: '结果与结论', type: 'textarea', rows: 4, full: true }
  ];

  /* ================= 项目视图工厂 ================= */
  function makeProject(kind, title, sub) {
    return {
      render: function (host, param) {
        const stKey = 'proj_' + kind;
        let curId = param || JZ.viewState[stKey] || '';
        const mine = () => JZ.S.projects.filter(p => p.kind === kind)
          .sort((a, b) => (a.status === '已结题') - (b.status === '已结题') || (b.createdAt || 0) - (a.createdAt || 0));
        if (curId && !JZ.S.projects.find(p => p.id === curId && p.kind === kind)) curId = '';

        const body = ui.page(host, {
          title: title, sub: sub,
          actions: [
            { text: '＋新建' + (kind === 'topic' ? '课题' : '研究'), class: 'btn-primary', onClick: newProj },
            { text: '总览', onClick: () => { curId = ''; JZ.viewState[stKey] = ''; draw(); } },
            { text: '导出全部', onClick: expAll }
          ]
        });
        const split = u.el('div', { class: 'split' });
        const sideBox = u.el('div', { class: 'side-list' });
        const main = u.el('div');
        split.appendChild(sideBox); split.appendChild(main);
        body.appendChild(split);
        draw();

        function drawSide() {
          const list = mine();
          sideBox.innerHTML = '<div class="sl-h">' + (kind === 'topic' ? '课题' : '研究主题') + ' ' + list.length + '</div>' +
            '<div class="sl-item' + (curId ? '' : ' on') + '" data-id="">总览与统计</div>' +
            (list.length ? list.map(p =>
              '<div class="sl-item' + (p.id === curId ? ' on' : '') + '" data-id="' + p.id + '">' +
              '<span class="ellipsis">' + u.esc(p.name) + '</span><small>' + (u.num(p.pct) || 0) + '%</small></div>').join('')
              : '<div class="hint" style="padding:10px">还没有项目</div>');
          u.$$('.sl-item', sideBox).forEach(it => it.onclick = () => { curId = it.dataset.id; JZ.viewState[stKey] = curId; draw(); });
        }
        function draw() { drawSide(); main.innerHTML = ''; curId ? drawOne() : drawOverview(); }

        function newProj() {
          ui.editRecord('projects', PROJ_F(kind), null, {
            name: kind === 'topic' ? '课题' : '研究主题', wide: true,
            preset: { kind: kind, startDate: u.ymd(u.today()), pct: 0 }
          }, r => { curId = r.id; JZ.viewState[stKey] = r.id; draw(); });
        }

        /* ---------- 总览 ---------- */
        function drawOverview() {
          const list = mine();
          const ids = new Set(list.map(p => p.id));
          const lits = JZ.S.lits.filter(x => ids.has(x.projectId));
          const going = list.filter(p => p.status !== '已结题' && p.status !== '暂停');
          const avg = going.length ? Math.round(going.reduce((a, b) => a + (u.num(b.pct) || 0), 0) / going.length) : 0;
          main.innerHTML = ui.stats([
            { k: (kind === 'topic' ? '课题' : '研究') + '总数', v: list.length, x: '在研 ' + going.length },
            { k: '平均完成度', v: avg + '%', x: '仅统计在研', tone: 'p' },
            { k: '关联文献', v: lits.length, x: '核心 ' + lits.filter(x => x.status === '核心').length },
            { k: '已结题 / 完成', v: list.filter(p => p.status === '已结题').length, x: '归档留痕', tone: 'k' }
          ]);
          const grid = u.el('div', { class: 'mini-grid' });
          if (!list.length) {
            main.appendChild(ui.card({
              title: '建立第一个' + (kind === 'topic' ? '课题' : '研究主题'), tone: 'p',
              body: '<div class="empty"><span class="em-ic">' + (kind === 'topic' ? '📜' : '🖋') + '</span>' +
                (kind === 'topic' ? '有编号的立项课题建议建在这里，文献、进度、实验、写作会自动归入该课题。'
                  : '尚未立项的个人兴趣研究、论文选题、教学反思课题都可以先建在这里，成熟后再申报。') +
                '<div style="margin-top:12px"><button class="btn btn-primary" id="pjNew">＋立即新建</button></div></div>'
            }));
            u.$('#pjNew', main).onclick = newProj;
            return;
          }
          list.forEach(p => {
            const l = JZ.S.lits.filter(x => x.projectId === p.id).length;
            const pr = JZ.S.progress.filter(x => x.projectId === p.id).length;
            const cd = u.el('div', { class: 'mini cn-corner' });
            cd.innerHTML = '<h4>' + u.esc(p.name) + '</h4>' +
              '<div class="hint">' + u.esc(p.code || '未编号') + '　' + u.esc(p.role || '') + '</div>' +
              '<div class="item-f"><span class="tag ' + (p.status === '已结题' ? 't-green' : p.status === '暂停' ? 't-gray' : 't-blue') + '">' + u.esc(p.status || '') + '</span>' +
              '<span class="tag t-purple">' + u.esc(p.level || '') + '</span>' +
              (p.endDate ? '<span class="tag ' + (u.diffDays(p.endDate, u.today()) < 0 && p.status !== '已结题' ? 't-red' : 't-amber') + '">' + u.esc(p.endDate) + '</span>' : '') + '</div>' +
              '<div style="margin-top:9px">' + ui.bar(u.num(p.pct) || 0) + '</div>' +
              '<div class="mini-f"><span>文献 ' + l + '　进度 ' + pr + ' 条</span><span>进入 →</span></div>';
            cd.onclick = () => { curId = p.id; JZ.viewState[stKey] = p.id; draw(); };
            grid.appendChild(cd);
          });
          main.appendChild(ui.card({ title: '全部' + (kind === 'topic' ? '课题' : '研究主题'), count: list.length, body: grid }));
        }

        /* ---------- 项目详情 ---------- */
        function drawOne() {
          const p = db.one('projects', curId);
          if (!p) { curId = ''; draw(); return; }
          let tab = JZ.viewState['pjTab_' + p.id] || 'info';

          main.appendChild(ui.card({
            title: p.name, tone: 'p',
            actions: [
              { text: '编辑', class: 'btn-sm', onClick: () => ui.editRecord('projects', PROJ_F(kind), p, { name: '项目', wide: true }, draw) },
              { text: '导出项目档案Word', class: 'btn-sm btn-purple', onClick: () => expOne(p) },
              { text: '删除', class: 'btn-sm btn-danger', onClick: delProj }
            ],
            body: '<div class="row" style="flex-wrap:wrap;gap:8px">' +
              '<span class="tag t-blue">' + u.esc(p.status || '') + '</span>' +
              '<span class="tag t-purple">' + u.esc(p.level || '') + '</span>' +
              '<span class="tag t-gray">' + u.esc(p.role || '') + '</span>' +
              (p.code ? '<span class="tag t-green">' + u.esc(p.code) + '</span>' : '') +
              (p.startDate ? '<span class="tag t-gray">' + u.esc(p.startDate) + ' 起</span>' : '') +
              (p.endDate ? '<span class="tag t-pink">目标 ' + u.esc(p.endDate) + '　' + cal.dueText(p.endDate) + '</span>' : '') +
              '</div><div style="margin-top:10px">' + ui.bar(u.num(p.pct) || 0) + '</div>' +
              (p.members ? '<div class="hint" style="margin-top:8px">成员：' + u.esc(p.members) + '</div>' : '')
          }));

          const zone = u.el('div');
          const tabBox = ui.tabs([
            { k: 'info', t: '概览' },
            { k: 'lit', t: '文献库', n: JZ.S.lits.filter(x => x.projectId === p.id).length },
            { k: 'venue', t: '会议期刊雷达', n: JZ.S.venues.filter(x => x.projectId === p.id).length },
            { k: 'prog', t: '进度记录', n: JZ.S.progress.filter(x => x.projectId === p.id).length },
            { k: 'exp', t: '实验调查', n: JZ.S.exps.filter(x => x.projectId === p.id).length },
            { k: 'write', t: '写作', n: JZ.S.writings.filter(x => x.projectId === p.id).length },
            { k: 'file', t: '其它资料', n: db.filesOf('proj.file', p.id).length }
          ], tab, k => { tab = k; JZ.viewState['pjTab_' + p.id] = k; draw(); });
          main.appendChild(tabBox);
          main.appendChild(zone);

          if (tab === 'info') tabInfo(p, zone);
          else if (tab === 'lit') tabLit(p, zone);
          else if (tab === 'venue') tabVenue(p, zone);
          else if (tab === 'prog') tabProg(p, zone);
          else if (tab === 'exp') tabExp(p, zone);
          else if (tab === 'write') tabWrite(p, zone);
          else tabFile(p, zone);

          function delProj() {
            u.confirm('删除「' + p.name + '」会同时删除其文献、进度、实验、写作记录，确定继续？', () => {
              ['lits', 'venues', 'progress', 'exps', 'writings'].forEach(k =>
                JZ.S[k].filter(x => x.projectId === p.id).forEach(x => db.del(k, x.id)));
              db.del('projects', p.id);
              curId = ''; JZ.viewState[stKey] = ''; draw(); u.toast('已删除', 'ok');
            });
          }
        }

        /* ---------- 概览 ---------- */
        function tabInfo(p, zone) {
          const lits = JZ.S.lits.filter(x => x.projectId === p.id);
          const prog = JZ.S.progress.filter(x => x.projectId === p.id).sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1);
          const wr = JZ.S.writings.filter(x => x.projectId === p.id);
          const words = wr.reduce((a, b) => a + String(b.content || '').replace(/\s/g, '').length, 0);
          zone.innerHTML = ui.stats([
            { k: '文献', v: lits.length, x: '核心 ' + lits.filter(x => x.status === '核心').length },
            { k: '进度记录', v: prog.length, x: prog[0] ? '最近 ' + prog[0].date : '暂无', tone: 'p' },
            { k: '实验调查', v: JZ.S.exps.filter(x => x.projectId === p.id).length, x: '数据留痕' },
            { k: '写作字数', v: words, x: wr.length + ' 个章节', tone: 'k' }
          ]);
          zone.appendChild(ui.card({
            title: '研究内容简介',
            body: (p.abstract ? '<div class="item-x">' + u.esc(p.abstract) + '</div>' : '<div class="hint">尚未填写，点上方「编辑」补充</div>') +
              (p.target ? '<div style="margin-top:12px"><b style="font-size:13px">预期成果</b><div class="item-x">' + u.esc(p.target) + '</div></div>' : '')
          }));
          zone.appendChild(ui.card({
            title: '最近进展', tone: 'g',
            actions: [{ text: '＋记录进度', class: 'btn-sm btn-primary', onClick: () => ui.editRecord('progress', PRO_F, null, { name: '进度', wide: true, preset: { projectId: p.id, date: u.ymd(u.today()), pct: u.num(p.pct) || 0 } }, draw) }],
            body: ui.timeline(prog.slice(0, 6).map(x => ({
              date: x.date + (cal.weekOf(x.date) ? '　第' + cal.weekOf(x.date) + '周' : ''),
              title: x.title, text: x.content || '', tone: 'g'
            })))
          }));
          zone.appendChild(ui.card({
            title: '立项与结题材料', tone: 'k',
            body: ui.fileZone({ cat: 'proj.doc', refId: p.id, title: '申报书、立项通知、中期报告、结题材料', hint: '与项目管理相关的正式文件存这里' })
          }));
        }

        /* ---------- 文献库四区 ---------- */
        function tabLit(p, zone) {
          const all = JZ.S.lits.filter(x => x.projectId === p.id);
          let kw = JZ.viewState['litKw_' + p.id] || '';
          const bar = u.el('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap;margin-bottom:12px' });
          bar.innerHTML = '<input class="input" style="max-width:260px" id="ltKw" placeholder="搜索标题 / 作者 / 关键词" value="' + u.esc(kw) + '">' +
            '<button class="btn btn-sm btn-primary" id="ltAdd">＋录入文献</button>' +
            '<button class="btn btn-sm" id="ltImp">Excel导入</button>' +
            '<button class="btn btn-sm" id="ltTpl">下载模板</button>' +
            '<button class="btn btn-sm" id="ltExp">导出文献表</button>' +
            '<button class="btn btn-sm btn-purple" id="ltRev">生成文献综述初稿</button>';
          zone.appendChild(bar);
          u.$('#ltKw', bar).oninput = u.debounce(e => { JZ.viewState['litKw_' + p.id] = e.target.value.trim(); draw(); }, 420);
          u.$('#ltAdd', bar).onclick = () => ui.editRecord('lits', LIT_F(p), null, { name: '文献', wide: true, preset: { projectId: p.id, status: '待读' } }, draw);
          u.$('#ltImp', bar).onclick = impLit;
          u.$('#ltTpl', bar).onclick = () => {
            JZ.io.exportTemplate(['标题', '作者', '年份', '期刊出处', '研究方向', '分区', 'DOI', '链接', '核心观点', '引用摘录'],
              [['基于产出导向法的大学英语教学实践', '文秋芳', '2015', '中国外语教育', '大学英语教学', '核心', '', '', 'POA理论框架与教学流程', '"输出驱动、输入促成"']],
              '文献库导入模板.xlsx', '模板');
            u.toast('模板已下载', 'ok');
          };
          u.$('#ltExp', bar).onclick = () => {
            if (!all.length) { u.toast('文献库为空', 'warn'); return; }
            JZ.io.exportRows(all.map(x => ({
              分区: x.status || '', 标题: x.title, 作者: x.authors || '', 年份: x.year || '',
              期刊出处: x.source || '', 研究方向: x.dir || '', DOI: x.doi || '', 链接: x.url || '',
              核心观点: x.summary || '', 引用摘录: x.quotes || '', 启发: x.ideas || '', 标签: x.tags || ''
            })), p.name + '_文献库_' + u.ymd(u.today()) + '.xlsx', '文献库');
            u.toast('已导出', 'ok');
          };
          u.$('#ltRev', bar).onclick = () => review(p, all);

          const match = x => !kw || [x.title, x.authors, x.source, x.tags, x.dir, x.summary].join(' ').toLowerCase().indexOf(kw.toLowerCase()) >= 0;
          LIT_ZONES.forEach(z => {
            const list = all.filter(x => (x.status || '待读') === z.k && match(x))
              .sort((a, b) => (b.year || '') < (a.year || '') ? -1 : 1);
            const bx = u.el('div');
            bx.innerHTML = list.length ? list.map(x =>
              '<div class="item hl" data-id="' + x.id + '"><div class="item-h"><div style="min-width:0">' +
              '<div class="item-t">' + z.icon + ' ' + u.esc(x.title) + '</div>' +
              '<div class="item-f">' + (x.authors ? '<span class="tag t-gray">' + u.esc(x.authors) + '</span>' : '') +
              (x.year ? '<span class="tag t-blue">' + u.esc(x.year) + '</span>' : '') +
              (x.source ? '<span class="tag t-purple">' + u.esc(x.source) + '</span>' : '') +
              (x.dir ? '<span class="tag t-pink">' + u.esc(x.dir) + '</span>' : '') +
              (x.url ? '<a class="tag t-green" href="' + u.esc(x.url) + '" target="_blank">原文 ↗</a>' : '') + '</div>' +
              (x.summary ? '<div class="item-x"><b>观点：</b>' + u.esc(x.summary) + '</div>' : '') +
              (x.quotes ? '<div class="item-x"><b>摘录：</b>' + u.esc(x.quotes) + '</div>' : '') +
              (x.ideas ? '<div class="item-x"><b>启发：</b>' + u.esc(x.ideas) + '</div>' : '') +
              '</div><div class="row" style="flex-direction:column;gap:4px">' +
              '<button class="btn btn-sm" data-a="mv">移动分区</button>' +
              '<button class="btn btn-sm" data-a="ed">编辑</button>' +
              '<button class="btn btn-sm btn-danger" data-a="rm">删</button></div></div></div>').join('')
              : '<div class="hint">' + z.hint + '（暂无）</div>';
            zone.appendChild(ui.card({
              title: z.t, tone: z.tone, count: list.length, hint: z.hint,
              actions: [{
                text: '＋录入', class: 'btn-sm',
                onClick: () => ui.editRecord('lits', LIT_F(p), null, { name: '文献', wide: true, preset: { projectId: p.id, status: z.k } }, draw)
              }],
              body: bx
            }));
            u.$$('.item', bx).forEach(it => {
              const x = db.one('lits', it.dataset.id);
              u.$('[data-a="ed"]', it).onclick = () => ui.editRecord('lits', LIT_F(p), x, { name: '文献', wide: true }, draw);
              u.$('[data-a="rm"]', it).onclick = () => ui.confirmDel(x.title, () => { db.del('lits', x.id); draw(); });
              u.$('[data-a="mv"]', it).onclick = () => ui.editModal({
                title: '移动到分区', fields: [{ k: 'status', label: '目标分区', type: 'select', opts: LIT_ZONES.map(z2 => z2.k), def: x.status }],
                value: x, onOk: d => { db.upd('lits', x.id, d); draw(); }
              });
            });
          });

          zone.appendChild(ui.card({
            title: '文献全文与题录文件',
            body: ui.fileZone({ cat: 'proj.lit', refId: p.id, title: 'PDF 全文 / 笔记 / 题录', hint: '按项目归档的文献 PDF 与阅读笔记' })
          }));

          async function impLit() {
            const f = await u.pickFile('.xlsx,.xls,.csv'); if (!f) return;
            try {
              const rows = await JZ.io.readSheet(f);
              let n = 0;
              rows.forEach(r => {
                const title = JZ.io.pick(r, ['标题', '题名', 'Title']);
                if (!title) return;
                db.add('lits', {
                  projectId: p.id, title: String(title),
                  authors: String(JZ.io.pick(r, ['作者', 'Authors']) || ''),
                  year: String(JZ.io.pick(r, ['年份', 'Year']) || ''),
                  source: String(JZ.io.pick(r, ['期刊出处', '期刊', '出处', 'Source']) || ''),
                  dir: String(JZ.io.pick(r, ['研究方向', '方向']) || ''),
                  status: String(JZ.io.pick(r, ['分区', '状态']) || '待读'),
                  doi: String(JZ.io.pick(r, ['DOI', '编号']) || ''),
                  url: String(JZ.io.pick(r, ['链接', 'URL']) || ''),
                  summary: String(JZ.io.pick(r, ['核心观点', '摘要']) || ''),
                  quotes: String(JZ.io.pick(r, ['引用摘录', '摘录']) || '')
                });
                n++;
              });
              u.toast('已导入 ' + n + ' 篇', 'ok'); draw();
            } catch (e) { u.toast('导入失败：' + e.message, 'err', 4000); }
          }
          function review(p, all) {
            if (!all.length) { u.toast('文献库为空', 'warn'); return; }
            const byDir = {};
            all.forEach(x => { const d = x.dir || '其它'; (byDir[d] = byDir[d] || []).push(x); });
            const html = '<h1>' + u.esc(p.name) + '　文献综述素材</h1>' +
              '<div class="sub">按研究方向归并　共 ' + all.length + ' 篇　生成于 ' + u.ymd(u.today()) + '</div>' +
              Object.keys(byDir).map(d => '<h2>' + u.esc(d) + '（' + byDir[d].length + ' 篇）</h2>' +
                byDir[d].map(x => '<h3>' + u.esc(x.authors || '佚名') + '（' + u.esc(x.year || 'n.d.') + '）' + u.esc(x.title) + '</h3>' +
                  (x.source ? '<p class="meta">' + u.esc(x.source) + (x.doi ? '　' + u.esc(x.doi) : '') + '</p>' : '') +
                  (x.summary ? '<p>' + u.esc(x.summary).replace(/\n/g, '<br>') + '</p>' : '') +
                  (x.quotes ? '<p><i>原文摘录：</i>' + u.esc(x.quotes).replace(/\n/g, '<br>') + '</p>' : '') +
                  (x.ideas ? '<p><i>启发：</i>' + u.esc(x.ideas).replace(/\n/g, '<br>') + '</p>' : '')).join('')).join('') +
              '<h2>参考文献列表</h2><ul>' + all.map(x => '<li>' + u.esc(x.authors || '') + '. ' + u.esc(x.title) + '[J]. ' +
                u.esc(x.source || '') + ', ' + u.esc(x.year || '') + '.</li>').join('') + '</ul>';
            JZ.io.exportWord(p.name + ' 文献综述素材', html, p.name + '_文献综述素材');
            u.toast('Word已生成，可直接在此基础上撰写综述', 'ok');
          }
        }

        /* ---------- 会议期刊雷达 ---------- */
        function tabVenue(p, zone) {
          const all = JZ.S.venues.filter(x => x.projectId === p.id)
            .sort((a, b) => {
              const A = a.deadline || '9999', B = b.deadline || '9999';
              return A < B ? -1 : A > B ? 1 : 0;
            });
          const t = u.ymd(u.today());
          zone.appendChild(ui.card({
            title: '截止提醒', tone: 'k',
            body: (() => {
              const soon = all.filter(x => x.deadline && u.diffDays(x.deadline, t) >= 0 && u.diffDays(x.deadline, t) <= 60);
              return soon.length ? ui.timeline(soon.map(x => ({
                date: x.deadline + '　' + cal.dueText(x.deadline),
                title: x.name + '（' + (x.type || '') + '）',
                text: (x.level ? x.level + '　' : '') + (x.require || ''),
                tone: u.diffDays(x.deadline, t) <= 14 ? 'k' : 'a'
              }))) : '<div class="hint">未来60天内没有临近的截止日期</div>';
            })()
          }));

          const bx = u.el('div', { class: 'mini-grid' });
          bx.innerHTML = all.length ? '' : ui.empty('还没有登记目标期刊或会议', '🎯');
          all.forEach(x => {
            const cd = u.el('div', { class: 'mini' });
            const od = x.deadline && u.diffDays(x.deadline, t) < 0;
            cd.innerHTML = '<h4>' + (x.star ? '⭐ ' : '') + u.esc(x.name) + '</h4>' +
              '<div class="item-f"><span class="tag t-blue">' + u.esc(x.type || '') + '</span>' +
              (x.level ? '<span class="tag t-purple">' + u.esc(x.level) + '</span>' : '') +
              (x.deadline ? '<span class="tag ' + (od ? 't-gray' : 't-pink') + '">' + u.esc(x.deadline) + '　' + cal.dueText(x.deadline) + '</span>' : '') +
              (x.fee ? '<span class="tag t-amber">' + u.esc(x.fee) + '</span>' : '') + '</div>' +
              (x.require ? '<div class="item-x">' + u.esc(x.require) + '</div>' : '') +
              '<div class="mini-f"><span>' + (x.cycle ? u.esc(x.cycle) : '未填周期') + '</span>' +
              '<span class="row">' + (x.url ? '<a class="btn btn-sm" href="' + u.esc(x.url) + '" target="_blank">官网</a>' : '') +
              '<button class="btn btn-sm" data-a="star">星</button><button class="btn btn-sm" data-a="sub">去投稿</button>' +
              '<button class="btn btn-sm" data-a="ed">改</button><button class="btn btn-sm btn-danger" data-a="rm">删</button></span></div>';
            bx.appendChild(cd);
            u.$('[data-a="star"]', cd).onclick = e => { e.stopPropagation(); db.upd('venues', x.id, { star: !x.star }); draw(); };
            u.$('[data-a="ed"]', cd).onclick = e => { e.stopPropagation(); ui.editRecord('venues', VEN_F, x, { name: '期刊/会议', wide: true }, draw); };
            u.$('[data-a="rm"]', cd).onclick = e => { e.stopPropagation(); ui.confirmDel(x.name, () => { db.del('venues', x.id); draw(); }); };
            u.$('[data-a="sub"]', cd).onclick = e => {
              e.stopPropagation();
              db.add('subs', { title: p.name, projectId: p.id, venueName: x.name, type: x.type || '期刊', submitDate: u.ymd(u.today()), status: '准备中', history: [{ d: u.ymd(u.today()), s: '准备中', n: '由会议期刊雷达创建' }] });
              u.toast('已在投稿管理中创建记录', 'ok'); JZ.go('rsSub');
            };
          });
          zone.appendChild(ui.card({
            title: '目标期刊 / 会议 / 申报', count: all.length,
            actions: [
              { text: '＋登记', class: 'btn-sm btn-primary', onClick: () => ui.editRecord('venues', VEN_F, null, { name: '期刊/会议', wide: true, preset: { projectId: p.id } }, draw) },
              { text: '导出', class: 'btn-sm', onClick: () => { if (!all.length) { u.toast('暂无数据', 'warn'); return; } JZ.io.exportRows(all.map(x => ({ 名称: x.name, 类型: x.type || '', 层次: x.level || '', 截止: x.deadline || '', 周期: x.cycle || '', 费用: x.fee || '', 官网: x.url || '', 要求: x.require || '', 备注: x.note || '' })), p.name + '_期刊会议雷达.xlsx', '雷达'); u.toast('已导出', 'ok'); } }
            ],
            body: bx
          }));
          zone.appendChild(ui.card({
            title: '征稿通知与模板文件', tone: 'g',
            body: ui.fileZone({ cat: 'proj.venue', refId: p.id, title: '征稿函、格式模板、投稿指南' })
          }));
        }

        /* ---------- 进度记录 ---------- */
        function tabProg(p, zone) {
          const all = JZ.S.progress.filter(x => x.projectId === p.id).sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1);
          const bx = u.el('div');
          bx.innerHTML = all.length ? all.map(x =>
            '<div class="item hl" data-id="' + x.id + '"><div class="item-h"><div style="min-width:0;flex:1">' +
            '<div class="item-t">' + u.esc(x.title) + '</div>' +
            (x.content ? '<div class="item-x">' + u.esc(x.content) + '</div>' : '') +
            '<div class="item-f"><span class="tag t-blue">' + u.esc(x.date || '') +
            (x.date && cal.weekOf(x.date) ? ' · 第' + cal.weekOf(x.date) + '周' : '') + '</span>' +
            (x.tag ? '<span class="tag t-purple">' + u.esc(x.tag) + '</span>' : '') +
            (x.pct !== '' && x.pct !== undefined ? '<span class="tag t-green">完成度 ' + u.num(x.pct) + '%</span>' : '') + '</div></div>' +
            '<div class="row"><button class="btn btn-sm" data-a="ed">改</button>' +
            '<button class="btn btn-sm btn-danger" data-a="rm">删</button></div></div></div>').join('')
            : ui.empty('还没有进度记录，建议每完成一个动作就记一条', '📈');
          zone.appendChild(ui.card({
            title: '研究进度记录', count: all.length,
            actions: [
              { text: '＋记录进度', class: 'btn-sm btn-primary', onClick: () => ui.editRecord('progress', PRO_F, null, { name: '进度', wide: true, preset: { projectId: p.id, date: u.ymd(u.today()), pct: u.num(p.pct) || 0 } }, syncPct) },
              { text: '导出进度表', class: 'btn-sm', onClick: () => { if (!all.length) { u.toast('暂无数据', 'warn'); return; } JZ.io.exportRows(all.map(x => ({ 日期: x.date || '', 周次: x.date && cal.weekOf(x.date) ? '第' + cal.weekOf(x.date) + '周' : '', 标题: x.title, 阶段: x.tag || '', 完成度: x.pct, 具体进展: x.content || '' })), p.name + '_进度记录.xlsx', '进度'); u.toast('已导出', 'ok'); } }
            ],
            body: bx
          }));
          u.$$('.item', bx).forEach(it => {
            const x = db.one('progress', it.dataset.id);
            u.$('[data-a="ed"]', it).onclick = () => ui.editRecord('progress', PRO_F, x, { name: '进度', wide: true }, syncPct);
            u.$('[data-a="rm"]', it).onclick = () => ui.confirmDel(x.title, () => { db.del('progress', x.id); draw(); });
          });
          zone.appendChild(ui.card({
            title: '过程性材料', tone: 'g',
            body: ui.fileZone({ cat: 'proj.prog', refId: p.id, title: '会议纪要、阶段报告、照片', hint: '中期检查、结题时可直接调取' })
          }));
          function syncPct() {
            const last = JZ.S.progress.filter(x => x.projectId === p.id).sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1)[0];
            if (last && last.pct !== '' && last.pct !== undefined) db.upd('projects', p.id, { pct: u.num(last.pct) });
            draw();
          }
        }

        /* ---------- 实验调查 ---------- */
        function tabExp(p, zone) {
          const all = JZ.S.exps.filter(x => x.projectId === p.id).sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1);
          if (!all.length) {
            zone.appendChild(ui.card({
              title: '实验与调查', tone: 'p',
              body: '<div class="empty"><span class="em-ic">🧪</span>教学实验、问卷调查、访谈、语料分析都可以在这里建档，' +
                '每个实验独立存放设计、过程、原始数据与结论。<div style="margin-top:12px"><button class="btn btn-primary" id="exNew">＋新建实验 / 调查</button></div></div>'
            }));
            u.$('#exNew', zone).onclick = () => ui.editRecord('exps', EXP_F, null, { name: '实验/调查', wide: true, preset: { projectId: p.id, date: u.ymd(u.today()) } }, draw);
            return;
          }
          zone.appendChild(ui.card({
            title: '实验 / 调查列表', tone: 'p', count: all.length,
            actions: [{ text: '＋新建', class: 'btn-sm btn-primary', onClick: () => ui.editRecord('exps', EXP_F, null, { name: '实验/调查', wide: true, preset: { projectId: p.id, date: u.ymd(u.today()) } }, draw) }],
            body: '<div class="hint">每个实验下含「设计与过程」「结果与结论」以及独立的原始数据文件区</div>'
          }));
          all.forEach(x => {
            const wrap = u.el('div');
            wrap.innerHTML = '<div class="row" style="flex-wrap:wrap;gap:8px;margin-bottom:9px">' +
              '<span class="tag ' + (x.status === '已完成' ? 't-green' : 't-amber') + '">' + u.esc(x.status || '') + '</span>' +
              (x.method ? '<span class="tag t-purple">' + u.esc(x.method) + '</span>' : '') +
              (x.date ? '<span class="tag t-blue">' + u.esc(x.date) + '</span>' : '') + '</div>' +
              (x.content ? '<div class="item-x"><b>设计与过程：</b>' + u.esc(x.content) + '</div>' : '') +
              (x.result ? '<div class="item-x"><b>结果与结论：</b>' + u.esc(x.result) + '</div>' : '');
            wrap.appendChild(ui.fileZone({ cat: 'proj.exp', refId: x.id, title: '原始数据与工具', hint: '问卷、成绩表、录音转写、SPSS 输出等' }));
            zone.appendChild(ui.card({
              title: x.name,
              actions: [
                { text: '编辑', class: 'btn-sm', onClick: () => ui.editRecord('exps', EXP_F, x, { name: '实验/调查', wide: true }, draw) },
                { text: '删除', class: 'btn-sm btn-danger', onClick: () => ui.confirmDel(x.name, () => { db.del('exps', x.id); draw(); }) }
              ],
              body: wrap
            }));
          });
        }

        /* ---------- 写作 ---------- */
        function tabWrite(p, zone) {
          const all = JZ.S.writings.filter(x => x.projectId === p.id).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
          const words = all.reduce((a, b) => a + String(b.content || '').replace(/\s/g, '').length, 0);
          zone.appendChild(ui.card({
            title: '论文 / 报告写作区', tone: 'k',
            hint: '合计 ' + words + ' 字（不含空格）',
            actions: [
              { text: '＋新增章节', class: 'btn-sm btn-primary', onClick: addSec },
              { text: '套用论文结构', class: 'btn-sm', onClick: tplSec },
              { text: '合并导出Word', class: 'btn-sm btn-purple', onClick: expW }
            ],
            body: all.length ? '<div class="hint">每个章节独立自动保存，写完可一键合并成完整 Word 文稿</div>' : ui.empty('还没有章节，先套用论文结构模板', '✍️')
          }));
          all.forEach(w => {
            const wc = String(w.content || '').replace(/\s/g, '').length;
            zone.appendChild(ui.card({
              title: w.section || w.title,
              hint: wc + ' 字',
              actions: [
                { text: '重命名', class: 'btn-sm', onClick: () => ui.editRecord('writings', [{ k: 'section', label: '章节名称', required: true, full: true }], w, { name: '章节' }, draw) },
                { text: '删除', class: 'btn-sm btn-danger', onClick: () => ui.confirmDel(w.section, () => { db.del('writings', w.id); draw(); }) }
              ],
              body: ui.textBlock({
                title: '正文', rows: 10, value: w.content || '', ph: '在此撰写，内容自动保存',
                onSave: v => db.upd('writings', w.id, { content: v })
              })
            }));
          });
          function addSec() {
            ui.editModal({
              title: '新增章节', fields: [{ k: 'section', label: '章节名称', required: true, full: true, ph: '如 三、研究设计' }],
              value: {}, onOk: d => { db.add('writings', { projectId: p.id, section: d.section, content: '' }); draw(); }
            });
          }
          function tplSec() {
            u.confirm('将追加标准论文结构（摘要、引言、文献综述、研究设计、结果与分析、讨论、结论、参考文献），确定继续？', () => {
              ['摘要与关键词', '一、引言', '二、文献综述', '三、研究设计', '四、结果与分析', '五、讨论', '六、结论与启示', '参考文献']
                .forEach(s => db.add('writings', { projectId: p.id, section: s, content: '' }));
              draw();
            });
          }
          function expW() {
            if (!all.length) { u.toast('还没有内容', 'warn'); return; }
            JZ.io.exportWord(p.name,
              '<h1>' + u.esc(p.name) + '</h1><div class="sub">' + u.esc(JZ.S.settings.ownerName || '') +
              (JZ.S.settings.school ? '　' + u.esc(JZ.S.settings.school) : '') + '　' + u.ymd(u.today()) + '</div>' +
              all.map(w => '<h2>' + u.esc(w.section || '') + '</h2><p>' +
                u.esc(w.content || '').replace(/\n/g, '<br>') + '</p>').join(''),
              p.name + '_文稿');
            u.toast('Word已生成', 'ok');
          }
        }

        /* ---------- 其它资料 ---------- */
        function tabFile(p, zone) {
          zone.appendChild(ui.card({
            title: '项目常用网站', tone: 'p',
            body: ui.linkZone({ cat: 'proj.link', refId: p.id, title: '相关入口', tip: '课题管理系统、数据平台、协作文档等' })
          }));
          zone.appendChild(ui.card({
            title: '其它资料', body: ui.fileZone({ cat: 'proj.file', refId: p.id, title: '不属于以上分类的所有文件' })
          }));
          zone.appendChild(ui.card({
            title: '零散想法与备忘', tone: 'k',
            body: ui.textBlock({
              title: '随手记', rows: 6, value: p.memo || '', ph: '任何与本项目相关的碎片想法',
              onSave: v => db.upd('projects', p.id, { memo: v })
            })
          }));
        }

        /* ---------- 导出 ---------- */
        function expAll() {
          const list = mine();
          if (!list.length) { u.toast('暂无数据', 'warn'); return; }
          const ids = new Set(list.map(p => p.id));
          JZ.io.exportBook([
            { name: '项目', rows: list.map(p => ({ 名称: p.name, 编号: p.code || '', 级别: p.level || '', 角色: p.role || '', 状态: p.status || '', 开始: p.startDate || '', 结题: p.endDate || '', 完成度: u.num(p.pct) || 0, 成员: p.members || '', 简介: p.abstract || '', 预期成果: p.target || '' })) },
            { name: '文献', rows: JZ.S.lits.filter(x => ids.has(x.projectId)).map(x => ({ 项目: projName(x.projectId), 分区: x.status || '', 标题: x.title, 作者: x.authors || '', 年份: x.year || '', 出处: x.source || '', 核心观点: x.summary || '', 摘录: x.quotes || '' })) },
            { name: '进度', rows: JZ.S.progress.filter(x => ids.has(x.projectId)).map(x => ({ 项目: projName(x.projectId), 日期: x.date || '', 标题: x.title, 阶段: x.tag || '', 完成度: x.pct, 内容: x.content || '' })) },
            { name: '实验调查', rows: JZ.S.exps.filter(x => ids.has(x.projectId)).map(x => ({ 项目: projName(x.projectId), 名称: x.name, 方法: x.method || '', 日期: x.date || '', 状态: x.status || '', 过程: x.content || '', 结论: x.result || '' })) },
            { name: '期刊会议', rows: JZ.S.venues.filter(x => ids.has(x.projectId)).map(x => ({ 项目: projName(x.projectId), 名称: x.name, 类型: x.type || '', 层次: x.level || '', 截止: x.deadline || '', 要求: x.require || '' })) }
          ], (kind === 'topic' ? '课题研究' : '个人研究') + '全量数据_' + u.ymd(u.today()) + '.xlsx');
          u.toast('已导出Excel工作簿', 'ok');
        }
        function expOne(p) {
          const lits = JZ.S.lits.filter(x => x.projectId === p.id);
          const prog = JZ.S.progress.filter(x => x.projectId === p.id).sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1);
          const exps = JZ.S.exps.filter(x => x.projectId === p.id);
          JZ.io.exportWord(p.name + ' 项目档案',
            '<h1>' + u.esc(p.name) + '</h1>' +
            '<div class="sub">' + u.esc(p.code || '') + '　' + u.esc(p.level || '') + '　' + u.esc(p.role || '') + '　' + u.ymd(u.today()) + '</div>' +
            '<h2>一、基本信息</h2><table>' +
            '<tr><th>状态</th><td>' + u.esc(p.status || '') + '</td><th>完成度</th><td>' + (u.num(p.pct) || 0) + '%</td></tr>' +
            '<tr><th>起止</th><td>' + u.esc(p.startDate || '') + ' 至 ' + u.esc(p.endDate || '') + '</td><th>成员</th><td>' + u.esc(p.members || '') + '</td></tr></table>' +
            (p.abstract ? '<h2>二、研究内容</h2><p>' + u.esc(p.abstract).replace(/\n/g, '<br>') + '</p>' : '') +
            (p.target ? '<h2>三、预期成果</h2><p>' + u.esc(p.target).replace(/\n/g, '<br>') + '</p>' : '') +
            '<h2>四、研究进度</h2>' + (prog.length ? '<table><tr><th>日期</th><th>标题</th><th>阶段</th><th>进展</th></tr>' +
              prog.map(x => '<tr><td>' + u.esc(x.date || '') + '</td><td>' + u.esc(x.title) + '</td><td>' + u.esc(x.tag || '') + '</td><td>' + u.esc(x.content || '') + '</td></tr>').join('') + '</table>' : '<p class="meta">（无）</p>') +
            '<h2>五、实验与调查</h2>' + (exps.length ? exps.map(x => '<h3>' + u.esc(x.name) + '（' + u.esc(x.method || '') + '）</h3>' +
              '<p>' + u.esc(x.content || '').replace(/\n/g, '<br>') + '</p><p><b>结论：</b>' + u.esc(x.result || '').replace(/\n/g, '<br>') + '</p>').join('') : '<p class="meta">（无）</p>') +
            '<h2>六、文献基础（' + lits.length + ' 篇）</h2><ul>' +
            lits.map(x => '<li>' + u.esc(x.authors || '') + '. ' + u.esc(x.title) + '. ' + u.esc(x.source || '') + ', ' + u.esc(x.year || '') + '.</li>').join('') + '</ul>',
            p.name + '_项目档案');
          u.toast('Word已生成', 'ok');
        }
      }
    };
  }

  JZ.views.rsTopic = makeProject('topic', '课题研究',
    '已立项或申报中的正式课题，文献、进度、实验、写作全部按课题归档');
  JZ.views.rsPersonal = makeProject('personal', '个人研究',
    '尚未立项的个人选题与长期兴趣方向，成熟后可直接转为课题申报');

  /* ================= 学术资料库 ================= */
  const LIB_TYPES = [
    { k: 'idea', t: '选题灵感', icon: '💡', tone: 'k' },
    { k: 'method', t: '研究方法', icon: '🧭', tone: 'p' },
    { k: 'tool', t: '工具与软件', icon: '🛠', tone: '' },
    { k: 'quote', t: '金句与理论', icon: '❝', tone: 'g' },
    { k: 'template', t: '模板与范式', icon: '📐', tone: '' },
    { k: 'policy', t: '政策与文件', icon: '📜', tone: 'p' }
  ];
  const LIB_F = [
    { k: 'title', label: '标题', required: true, full: true },
    { k: 'type', label: '类别', type: 'select', opts: LIB_TYPES.map(x => ({ v: x.k, t: x.t })), def: 'idea' },
    { k: 'tags', label: '标签', ph: '便于检索' },
    { k: 'url', label: '相关链接', full: true, ph: 'https://' },
    { k: 'content', label: '内容', type: 'textarea', rows: 6, full: true }
  ];

  JZ.views.rsLib = {
    render: function (host) {
      const S = JZ.S;
      let ty = JZ.viewState.libType || '';
      let kw = JZ.viewState.libKw || '';
      const body = ui.page(host, {
        title: '学术资料库',
        sub: '跨项目的通用积累：选题灵感、研究方法、工具、金句、模板、政策文件',
        actions: [
          { text: '＋新增条目', class: 'btn-primary', onClick: () => ui.editRecord('libItems', LIB_F, null, { name: '资料', wide: true, preset: { type: ty || 'idea' } }, () => JZ.go('rsLib')) },
          { text: '导出资料库', onClick: exp }
        ]
      });

      const bar = u.el('div', { class: 'row', style: 'gap:10px;flex-wrap:wrap;margin-bottom:12px' });
      bar.innerHTML = '<div class="badges"><span class="chip' + (ty ? '' : ' on') + '" data-t="">全部 ' + S.libItems.length + '</span>' +
        LIB_TYPES.map(x => '<span class="chip' + (ty === x.k ? ' on' : '') + '" data-t="' + x.k + '">' + x.icon + ' ' + x.t + ' ' +
          S.libItems.filter(i => i.type === x.k).length + '</span>').join('') + '</div>' +
        '<input class="input" style="max-width:240px;margin-left:auto" id="lbKw" placeholder="搜索…" value="' + u.esc(kw) + '">';
      body.appendChild(bar);
      u.$$('.chip', bar).forEach(c => c.onclick = () => { JZ.viewState.libType = c.dataset.t; JZ.go('rsLib'); });
      u.$('#lbKw', bar).oninput = u.debounce(e => { JZ.viewState.libKw = e.target.value.trim(); JZ.go('rsLib'); }, 420);

      const list = S.libItems.filter(x => {
        if (ty && x.type !== ty) return false;
        if (kw && [x.title, x.content, x.tags].join(' ').toLowerCase().indexOf(kw.toLowerCase()) < 0) return false;
        return true;
      }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      const bx = u.el('div');
      bx.innerHTML = list.length ? list.map(x => {
        const ti = LIB_TYPES.find(t => t.k === x.type) || LIB_TYPES[0];
        return '<div class="item hl" data-id="' + x.id + '"><div class="item-h"><div style="min-width:0">' +
          '<div class="item-t">' + ti.icon + ' ' + u.esc(x.title) + '</div>' +
          (x.content ? '<div class="item-x">' + u.esc(x.content) + '</div>' : '') +
          '<div class="item-f"><span class="tag t-blue">' + ti.t + '</span>' +
          (x.tags ? '<span class="tag t-purple">' + u.esc(x.tags) + '</span>' : '') +
          (x.url ? '<a class="tag t-green" href="' + u.esc(x.url) + '" target="_blank">链接 ↗</a>' : '') +
          '<span class="tag t-gray">' + u.ymd(new Date(x.createdAt || Date.now())) + '</span></div></div>' +
          '<div class="row"><button class="btn btn-sm" data-a="pj">转为课题</button>' +
          '<button class="btn btn-sm" data-a="ed">改</button>' +
          '<button class="btn btn-sm btn-danger" data-a="rm">删</button></div></div></div>';
      }).join('') : ui.empty('还没有资料，随手记下的灵感日后往往最值钱', '🗃');
      body.appendChild(ui.card({ title: '资料条目', count: list.length, body: bx }));
      u.$$('.item', bx).forEach(it => {
        const x = db.one('libItems', it.dataset.id);
        u.$('[data-a="ed"]', it).onclick = () => ui.editRecord('libItems', LIB_F, x, { name: '资料', wide: true }, () => JZ.go('rsLib'));
        u.$('[data-a="rm"]', it).onclick = () => ui.confirmDel(x.title, () => { db.del('libItems', x.id); JZ.go('rsLib'); });
        u.$('[data-a="pj"]', it).onclick = () => {
          ui.editRecord('projects', PROJ_F('personal'), null, {
            name: '个人研究', wide: true,
            preset: { kind: 'personal', name: x.title, abstract: x.content || '', startDate: u.ymd(u.today()), pct: 0 }
          }, r => { u.toast('已转为个人研究', 'ok'); JZ.go('rsPersonal', r.id); });
        };
      });

      body.appendChild(ui.card({
        title: '通用文件库', tone: 'p',
        body: ui.fileZone({ cat: 'rs.lib', refId: '', title: '模板、范文、政策文件、工具包', hint: '不属于具体项目的通用资料统一存放于此' })
      }));
      body.appendChild(ui.card({
        title: '常用学术网站', tone: 'g',
        body: ui.linkZone({ cat: 'rs.lib.link', title: '学术工具与平台', tip: '查重、翻译、统计工具、期刊官网等' })
      }));

      function exp() {
        if (!S.libItems.length) { u.toast('资料库为空', 'warn'); return; }
        JZ.io.exportRows(S.libItems.map(x => ({
          类别: (LIB_TYPES.find(t => t.k === x.type) || {}).t || '', 标题: x.title,
          内容: x.content || '', 标签: x.tags || '', 链接: x.url || '',
          记录时间: u.ymd(new Date(x.createdAt || Date.now()))
        })), '学术资料库_' + u.ymd(u.today()) + '.xlsx', '资料库');
        u.toast('已导出', 'ok');
      }
    }
  };

  /* ================= 投稿管理 ================= */
  const SUB_F = [
    { k: 'title', label: '稿件标题', required: true, full: true },
    { k: 'projectId', label: '关联项目', type: 'select', opts: projOpts() },
    { k: 'venueName', label: '投稿去向', required: true, ph: '期刊 / 会议名称' },
    { k: 'type', label: '类型', type: 'select', opts: V_TYPES, def: '期刊' },
    { k: 'submitDate', label: '投稿日期', type: 'date' },
    { k: 'status', label: '当前状态', type: 'select', opts: SUB_STATUS, def: '准备中' },
    { k: 'url', label: '投稿系统链接', full: true, ph: 'https://' },
    { k: 'note', label: '备注（编号、编辑意见摘要）', type: 'textarea', rows: 3, full: true }
  ];

  JZ.views.rsSub = {
    render: function (host) {
      const S = JZ.S, t = u.ymd(u.today());
      let f = JZ.viewState.subTab || 'going';
      const body = ui.page(host, {
        title: '投稿管理',
        sub: '每一篇稿件从准备到见刊的完整轨迹，状态变更自动留痕',
        actions: [
          { text: '＋新建投稿', class: 'btn-primary', onClick: () => ui.editRecord('subs', SUB_F, null, { name: '投稿', wide: true, preset: { submitDate: t, status: '准备中', history: [{ d: t, s: '准备中', n: '创建记录' }] } }, () => JZ.go('rsSub')) },
          { text: '导出投稿表', onClick: exp }
        ]
      });

      const going = S.subs.filter(x => ['已投稿', '外审中', '退修中', '准备中'].indexOf(x.status) >= 0);
      const acc = S.subs.filter(x => ['已录用', '已见刊'].indexOf(x.status) >= 0);
      const rej = S.subs.filter(x => x.status === '被拒');
      body.innerHTML += ui.stats([
        { k: '在途稿件', v: going.length, x: '准备 / 外审 / 退修' },
        { k: '已录用', v: acc.length, x: '含已见刊', tone: 'p' },
        { k: '被拒', v: rej.length, x: '换个方向再投' },
        { k: '命中率', v: (acc.length + rej.length) ? Math.round(acc.length / (acc.length + rej.length) * 100) + '%' : '—', x: '录用 / 已决', tone: 'k' }
      ]);

      const wrap = u.el('div');
      body.appendChild(wrap);
      drawList();
      function drawList() {
        wrap.innerHTML = '';
        wrap.appendChild(ui.tabs([
          { k: 'going', t: '在途', n: going.length }, { k: 'acc', t: '已录用', n: acc.length },
          { k: 'rej', t: '被拒 / 撤稿', n: S.subs.filter(x => x.status === '被拒' || x.status === '撤稿').length },
          { k: 'all', t: '全部', n: S.subs.length }
        ], f, k => { f = k; JZ.viewState.subTab = k; drawList(); }));
        const list = S.subs.filter(x => {
          if (f === 'going') return ['已投稿', '外审中', '退修中', '准备中'].indexOf(x.status) >= 0;
          if (f === 'acc') return ['已录用', '已见刊'].indexOf(x.status) >= 0;
          if (f === 'rej') return x.status === '被拒' || x.status === '撤稿';
          return true;
        }).sort((a, b) => (b.submitDate || '') < (a.submitDate || '') ? -1 : 1);
        const bx = u.el('div');
        bx.innerHTML = list.length ? list.map(x => {
          const days = x.submitDate ? u.diffDays(t, x.submitDate) : 0;
          const tone = ['已录用', '已见刊'].indexOf(x.status) >= 0 ? 'ok' : x.status === '被拒' ? 'warn' : 'hl';
          return '<div class="item ' + tone + '" data-id="' + x.id + '"><div class="item-h"><div style="min-width:0;flex:1">' +
            '<div class="item-t">📨 ' + u.esc(x.title) + '</div>' +
            '<div class="item-f"><span class="tag t-blue">' + u.esc(x.venueName) + '</span>' +
            '<span class="tag ' + (['已录用', '已见刊'].indexOf(x.status) >= 0 ? 't-green' : x.status === '被拒' ? 't-red' : 't-amber') + '">' + u.esc(x.status) + '</span>' +
            (x.submitDate ? '<span class="tag t-gray">' + u.esc(x.submitDate) + (days > 0 ? '　已 ' + days + ' 天' : '') + '</span>' : '') +
            (x.projectId ? '<span class="tag t-purple">' + u.esc(projName(x.projectId)) + '</span>' : '') +
            (x.url ? '<a class="tag t-green" href="' + u.esc(x.url) + '" target="_blank">系统 ↗</a>' : '') + '</div>' +
            (x.note ? '<div class="item-x">' + u.esc(x.note) + '</div>' : '') +
            ((x.history || []).length ? '<div class="item-f">' + x.history.map(h => '<span class="tag t-gray">' + u.esc(h.d) + ' ' + u.esc(h.s) + '</span>').join('') + '</div>' : '') +
            '</div><div class="row" style="flex-direction:column;gap:4px">' +
            '<button class="btn btn-sm btn-primary" data-a="st">更新状态</button>' +
            '<button class="btn btn-sm" data-a="fz">稿件文件</button>' +
            '<button class="btn btn-sm" data-a="ed">改</button>' +
            '<button class="btn btn-sm btn-danger" data-a="rm">删</button></div></div></div>';
        }).join('') : ui.empty('这一类暂无稿件', '📨');
        wrap.appendChild(bx);
        u.$$('.item', bx).forEach(it => {
          const x = db.one('subs', it.dataset.id);
          u.$('[data-a="ed"]', it).onclick = () => ui.editRecord('subs', SUB_F, x, { name: '投稿', wide: true }, () => JZ.go('rsSub'));
          u.$('[data-a="rm"]', it).onclick = () => ui.confirmDel(x.title, () => { db.del('subs', x.id); JZ.go('rsSub'); });
          u.$('[data-a="st"]', it).onclick = () => ui.editModal({
            title: '更新状态 · ' + x.title,
            fields: [
              { k: 'status', label: '新状态', type: 'select', opts: SUB_STATUS, def: x.status },
              { k: 'd', label: '发生日期', type: 'date', def: t },
              { k: 'n', label: '说明（审稿意见摘要等）', type: 'textarea', rows: 3, full: true }
            ], value: { status: x.status, d: t },
            onOk: d => {
              const h = (x.history || []).concat([{ d: d.d, s: d.status, n: d.n || '' }]);
              db.upd('subs', x.id, { status: d.status, history: h, note: d.n ? (x.note ? x.note + '\n' : '') + d.d + ' ' + d.n : x.note });
              if (['已录用', '已见刊'].indexOf(d.status) >= 0 && !JZ.S.outputs.find(o => o.title === x.title)) {
                db.add('outputs', { type: x.type === '学术会议' ? '会议论文' : '期刊论文', title: x.title, venue: x.venueName, date: d.d, level: '', authors: JZ.S.settings.ownerName || '', note: '由投稿管理自动生成' });
                u.toast('已录用，已同步到学术产出', 'ok');
              }
              JZ.go('rsSub');
            }
          });
          u.$('[data-a="fz"]', it).onclick = () => {
            const w = u.el('div');
            w.appendChild(ui.fileZone({ cat: 'rs.sub', refId: x.id, title: '各版本稿件与审稿意见', hint: '初稿、修改稿、返修说明、录用通知' }));
            u.modal({ title: '稿件文件 · ' + x.title, wide: true, body: w, buttons: [{ text: '关闭', class: 'btn btn-primary', onClick: (b, c) => c() }] });
          };
        });
      }
      function exp() {
        if (!S.subs.length) { u.toast('暂无数据', 'warn'); return; }
        JZ.io.exportRows(S.subs.map(x => ({
          稿件标题: x.title, 投稿去向: x.venueName, 类型: x.type || '', 关联项目: projName(x.projectId),
          投稿日期: x.submitDate || '', 当前状态: x.status || '',
          状态轨迹: (x.history || []).map(h => h.d + ' ' + h.s).join(' → '), 备注: x.note || ''
        })), '投稿管理_' + u.ymd(u.today()) + '.xlsx', '投稿');
        u.toast('已导出', 'ok');
      }
    }
  };

  /* ================= 学术产出 ================= */
  const OUT_F = [
    { k: 'title', label: '成果名称', required: true, full: true },
    { k: 'type', label: '类型', type: 'select', opts: OUT_TYPES, def: '期刊论文' },
    { k: 'venue', label: '发表 / 授予单位', ph: '期刊、出版社、主管部门' },
    { k: 'date', label: '日期', type: 'date' },
    { k: 'level', label: '层次 / 等级', ph: '如 CSSCI / 省级一等奖' },
    { k: 'authors', label: '署名与位次', ph: '如 第一作者 / 独著' },
    { k: 'doi', label: 'DOI / 证书编号' },
    { k: 'note', label: '备注', type: 'textarea', rows: 3, full: true }
  ];

  JZ.views.rsOutput = {
    render: function (host) {
      const S = JZ.S;
      let yf = JZ.viewState.outYear || '';
      const body = ui.page(host, {
        title: '学术产出',
        sub: '论文、课题、教材、专利、获奖统一登记，职称材料一键导出',
        actions: [
          { text: '＋登记成果', class: 'btn-primary', onClick: () => ui.editRecord('outputs', OUT_F, null, { name: '成果', wide: true, preset: { date: u.ymd(u.today()), authors: S.settings.ownerName || '' } }, () => JZ.go('rsOutput')) },
          { text: '导出成果表Excel', onClick: expX },
          { text: '导出成果清单Word', class: 'btn-purple', onClick: expW }
        ]
      });

      const years = Array.from(new Set(S.outputs.map(x => (x.date || '').slice(0, 4)).filter(Boolean))).sort().reverse();
      const byType = {};
      S.outputs.forEach(x => { byType[x.type] = (byType[x.type] || 0) + 1; });
      body.innerHTML += ui.stats([
        { k: '成果总数', v: S.outputs.length, x: years.length ? years[years.length - 1] + ' 至今' : '—' },
        { k: '期刊论文', v: (byType['期刊论文'] || 0) + (byType['会议论文'] || 0), x: '含会议论文', tone: 'p' },
        { k: '课题 / 项目', v: byType['教改课题'] || 0, x: '立项与结题' },
        { k: '获奖', v: byType['获奖'] || 0, x: '教学与科研奖项', tone: 'k' }
      ]);

      const bar = u.el('div', { class: 'badges', style: 'margin-bottom:12px' });
      bar.innerHTML = '<span class="chip' + (yf ? '' : ' on') + '" data-y="">全部年份</span>' +
        years.map(y => '<span class="chip' + (yf === y ? ' on' : '') + '" data-y="' + y + '">' + y + ' 年 ' +
          S.outputs.filter(x => (x.date || '').slice(0, 4) === y).length + '</span>').join('');
      body.appendChild(bar);
      u.$$('.chip', bar).forEach(c => c.onclick = () => { JZ.viewState.outYear = c.dataset.y; JZ.go('rsOutput'); });

      const list = S.outputs.filter(x => !yf || (x.date || '').slice(0, 4) === yf)
        .sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1);
      const bx = u.el('div');
      bx.innerHTML = list.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>日期</th><th>类型</th><th>成果名称</th><th>发表/授予</th><th>层次</th><th>署名</th><th></th></tr></thead><tbody>' +
        list.map(x => '<tr data-id="' + x.id + '"><td class="nowrap">' + u.esc(x.date || '') + '</td>' +
          '<td><span class="tag t-blue">' + u.esc(x.type || '') + '</span></td>' +
          '<td>' + u.esc(x.title) + (x.note ? '<div class="hint">' + u.esc(x.note) + '</div>' : '') + '</td>' +
          '<td>' + u.esc(x.venue || '') + '</td><td>' + u.esc(x.level || '') + '</td><td>' + u.esc(x.authors || '') + '</td>' +
          '<td class="nowrap"><button class="btn btn-sm" data-a="fz">附件</button> <button class="btn btn-sm" data-a="ed">改</button> ' +
          '<button class="btn btn-sm btn-danger" data-a="rm">删</button></td></tr>').join('') + '</tbody></table></div>'
        : ui.empty('还没有登记成果', '🌾');
      body.appendChild(ui.card({ title: '成果清单', count: list.length, body: bx }));
      u.$$('tr[data-id]', bx).forEach(tr => {
        const x = db.one('outputs', tr.dataset.id);
        u.$('[data-a="ed"]', tr).onclick = () => ui.editRecord('outputs', OUT_F, x, { name: '成果', wide: true }, () => JZ.go('rsOutput'));
        u.$('[data-a="rm"]', tr).onclick = () => ui.confirmDel(x.title, () => { db.del('outputs', x.id); JZ.go('rsOutput'); });
        u.$('[data-a="fz"]', tr).onclick = () => {
          const w = u.el('div');
          w.appendChild(ui.fileZone({ cat: 'rs.out', refId: x.id, title: '证明材料', hint: '录用通知、期刊 PDF、获奖证书、立项文件' }));
          u.modal({ title: '证明材料 · ' + x.title, wide: true, body: w, buttons: [{ text: '关闭', class: 'btn btn-primary', onClick: (b, c) => c() }] });
        };
      });

      function expX() {
        if (!S.outputs.length) { u.toast('暂无数据', 'warn'); return; }
        JZ.io.exportRows(S.outputs.map(x => ({
          日期: x.date || '', 类型: x.type || '', 成果名称: x.title, 发表授予单位: x.venue || '',
          层次等级: x.level || '', 署名位次: x.authors || '', 编号: x.doi || '', 备注: x.note || ''
        })), '学术产出_' + u.ymd(u.today()) + '.xlsx', '学术产出');
        u.toast('已导出', 'ok');
      }
      function expW() {
        if (!S.outputs.length) { u.toast('暂无数据', 'warn'); return; }
        const g = {};
        S.outputs.forEach(x => { (g[x.type] = g[x.type] || []).push(x); });
        JZ.io.exportWord('学术成果清单',
          '<h1>学术成果清单</h1><div class="sub">' + u.esc(S.settings.ownerName || '') +
          (S.settings.school ? '　' + u.esc(S.settings.school) : '') + '　制表 ' + u.ymd(u.today()) + '</div>' +
          OUT_TYPES.filter(t => g[t]).map(t => '<h2>' + t + '（' + g[t].length + ' 项）</h2><table>' +
            '<tr><th>序号</th><th>成果名称</th><th>发表/授予</th><th>时间</th><th>层次</th><th>署名</th></tr>' +
            g[t].sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1).map((x, i) =>
              '<tr><td>' + (i + 1) + '</td><td>' + u.esc(x.title) + '</td><td>' + u.esc(x.venue || '') + '</td><td>' +
              u.esc(x.date || '') + '</td><td>' + u.esc(x.level || '') + '</td><td>' + u.esc(x.authors || '') + '</td></tr>').join('') +
            '</table>').join(''),
          '学术成果清单_' + u.ymd(u.today()));
        u.toast('Word已生成', 'ok');
      }
    }
  };
})(window.JZ);
