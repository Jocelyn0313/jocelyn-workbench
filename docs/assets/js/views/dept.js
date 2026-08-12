/* =========================================================
   dept.js  二、部门工作：待办备忘 / 部门网页 / 部门报告 / 部门视频
   ========================================================= */
window.JZ.views = window.JZ.views || {};
(function (JZ) {
  'use strict';
  const u = JZ.u, db = JZ.db, cal = JZ.cal, ui = JZ.ui;

  const PRI = [{ v: '1', t: '高' }, { v: '2', t: '中' }, { v: '3', t: '低' }];
  const priTag = p => '<span class="tag ' + (p === '1' ? 't-red' : p === '3' ? 't-gray' : 't-amber') + '">' +
    (p === '1' ? '高' : p === '3' ? '低' : '中') + '优先</span>';

  /* ================= 1 待办备忘 ================= */
  const TODO_F = [
    { k: 'title', label: '事项', required: true, full: true },
    { k: 'detail', label: '具体要求', type: 'textarea', rows: 3, full: true },
    { k: 'due', label: '截止日期', type: 'date' },
    { k: 'priority', label: '优先级', type: 'select', opts: PRI, def: '2' },
    { k: 'tag', label: '来源 / 标签', ph: '如 系部 / 教务处 / 会议布置' },
    { k: 'owner', label: '协作人' }
  ];

  JZ.views.deptTodo = {
    render: function (host) {
      const body = ui.page(host, {
        title: '部门待办备忘',
        sub: '部门交办事项统一入口，截止日期自动换算校历周次，逾期高亮提醒',
        actions: [
          { text: '＋新增待办', class: 'btn-primary', onClick: () => ui.editRecord('deptTodos', TODO_F, null, { name: '待办', preset: { done: false } }, () => JZ.go('deptTodo')) },
          { text: 'Excel导入', class: '', onClick: imp },
          { text: 'Excel导出', class: '', onClick: exp },
          { text: '打印/PDF', class: '', onClick: pdf }
        ]
      });
      let f = JZ.viewState.deptTodoTab || 'open';
      const S = JZ.S, t = u.ymd(u.today());
      const wrap = u.el('div');
      body.appendChild(wrap);
      draw();

      function list() {
        const w = cal.weekOf(t), r = w ? cal.weekRange(w) : null;
        return S.deptTodos.filter(x => {
          if (f === 'open') return !x.done;
          if (f === 'week') return !x.done && x.due && r && x.due >= r.start && x.due <= r.end;
          if (f === 'over') return !x.done && x.due && x.due < t;
          if (f === 'done') return x.done;
          return true;
        }).sort((a, b) => {
          if (!!a.done !== !!b.done) return a.done ? 1 : -1;
          return (a.due || '9999') < (b.due || '9999') ? -1 : 1;
        });
      }
      function draw() {
        wrap.innerHTML = '';
        const w = cal.weekOf(t), r = w ? cal.weekRange(w) : null;
        const counts = {
          open: S.deptTodos.filter(x => !x.done).length,
          week: r ? S.deptTodos.filter(x => !x.done && x.due && x.due >= r.start && x.due <= r.end).length : 0,
          over: S.deptTodos.filter(x => !x.done && x.due && x.due < t).length,
          done: S.deptTodos.filter(x => x.done).length,
          all: S.deptTodos.length
        };
        wrap.appendChild(ui.tabs([
          { k: 'open', t: '未完成', n: counts.open }, { k: 'week', t: '本周（第' + (w || '-') + '周）', n: counts.week },
          { k: 'over', t: '已逾期', n: counts.over }, { k: 'done', t: '已完成', n: counts.done },
          { k: 'all', t: '全部', n: counts.all }
        ], f, k => { f = k; JZ.viewState.deptTodoTab = k; draw(); }));

        const L = list();
        const box = u.el('div');
        box.innerHTML = L.length ? L.map(x => {
          const over = !x.done && x.due && x.due < t;
          const wk = x.due ? cal.weekOf(x.due) : 0;
          return '<div class="item ' + (x.done ? 'ok' : over ? 'warn' : 'hl') + '" data-id="' + x.id + '">' +
            '<div class="item-h"><div class="row" style="gap:9px;align-items:flex-start">' +
            '<span class="chk' + (x.done ? ' on' : '') + '" data-a="tg"></span><div>' +
            '<div class="item-t" style="' + (x.done ? 'text-decoration:line-through;opacity:.6' : '') + '">' + u.esc(x.title) + '</div>' +
            (x.detail ? '<div class="item-x">' + u.esc(x.detail) + '</div>' : '') +
            '<div class="item-f">' + priTag(x.priority) +
            (x.due ? '<span class="tag ' + (over ? 't-red' : 't-blue') + '">' + u.esc(x.due) + (wk ? ' · 第' + wk + '周' : '') + '　' + cal.dueText(x.due) + '</span>' : '') +
            (x.tag ? '<span class="tag t-purple">' + u.esc(x.tag) + '</span>' : '') +
            (x.owner ? '<span class="tag t-gray">协作：' + u.esc(x.owner) + '</span>' : '') +
            '</div></div></div>' +
            '<div class="row"><button class="btn btn-sm" data-a="ed">编辑</button>' +
            '<button class="btn btn-sm btn-danger" data-a="rm">删</button></div></div></div>';
        }).join('') : ui.empty('这一类暂时没有待办', '📋');
        wrap.appendChild(box);
        u.$$('.item', box).forEach(it => {
          const rec = S.deptTodos.find(x => x.id === it.dataset.id);
          u.$('[data-a="tg"]', it).onclick = () => { db.upd('deptTodos', rec.id, { done: !rec.done, doneAt: Date.now() }); draw(); JZ.refreshTop(); };
          u.$('[data-a="ed"]', it).onclick = () => ui.editRecord('deptTodos', TODO_F, rec, { name: '待办' }, draw);
          u.$('[data-a="rm"]', it).onclick = () => ui.confirmDel(rec.title, () => { db.del('deptTodos', rec.id); draw(); JZ.refreshTop(); });
        });
      }

      body.appendChild(ui.card({
        title: '待办相关附件', tone: 'p',
        body: ui.fileZone({ cat: 'dept.todo', refId: '', title: '通知文件、表格模板等', hint: '与部门待办相关的通知、模板、回执，可随时下载' })
      }));

      function exp() {
        JZ.io.exportRows(JZ.S.deptTodos.map(x => ({
          事项: x.title, 具体要求: x.detail || '', 截止日期: x.due || '',
          校历周次: x.due && cal.weekOf(x.due) ? '第' + cal.weekOf(x.due) + '周' : '',
          优先级: x.priority === '1' ? '高' : x.priority === '3' ? '低' : '中',
          来源标签: x.tag || '', 协作人: x.owner || '', 状态: x.done ? '已完成' : '未完成'
        })), '部门待办_' + u.ymd(u.today()) + '.xlsx', '部门待办');
        u.toast('已导出Excel', 'ok');
      }
      async function imp() {
        const f = await u.pickFile('.xlsx,.xls,.csv'); if (!f) return;
        try {
          const rows = await JZ.io.readSheet(f);
          let n = 0;
          rows.forEach(r => {
            const title = JZ.io.pick(r, ['事项', '标题', '任务', '内容']);
            if (!title) return;
            db.add('deptTodos', {
              title: String(title), detail: String(JZ.io.pick(r, ['具体要求', '说明', '备注']) || ''),
              due: fmtDate(JZ.io.pick(r, ['截止日期', '截止', '日期'])),
              priority: ({ 高: '1', 中: '2', 低: '3' })[String(JZ.io.pick(r, ['优先级']) || '').trim()] || '2',
              tag: String(JZ.io.pick(r, ['来源标签', '来源', '标签']) || ''),
              owner: String(JZ.io.pick(r, ['协作人', '负责人']) || ''),
              done: String(JZ.io.pick(r, ['状态']) || '').indexOf('完成') === 0
            });
            n++;
          });
          u.toast('已导入 ' + n + ' 条', 'ok'); draw(); JZ.refreshTop();
        } catch (e) { u.toast('导入失败：' + e.message, 'err', 4000); }
      }
      function pdf() {
        const rows = list();
        JZ.io.exportPDF('部门待办清单', '<h1>部门待办清单</h1><div class="sub">' + cal.termLabel() + '　' + cal.weekText(t) + '　制表 ' + t + '</div>' +
          '<table><tr><th>事项</th><th>要求</th><th>截止</th><th>优先级</th><th>状态</th></tr>' +
          rows.map(x => '<tr><td>' + u.esc(x.title) + '</td><td>' + u.esc(x.detail || '') + '</td><td>' + u.esc(x.due || '') +
            '</td><td>' + (x.priority === '1' ? '高' : x.priority === '3' ? '低' : '中') + '</td><td>' + (x.done ? '已完成' : '未完成') + '</td></tr>').join('') + '</table>');
      }
    }
  };

  /* ================= 2 部门网页 ================= */
  const PAGE_F = [
    { k: 'title', label: '稿件 / 页面标题', required: true, full: true },
    { k: 'column', label: '栏目', ph: '如 通知公告 / 教学动态' },
    { k: 'date', label: '发布日期', type: 'date' },
    { k: 'status', label: '状态', type: 'select', opts: ['待撰写', '待审核', '已发布', '已下线'], def: '待撰写' },
    { k: 'url', label: '页面链接', full: true, ph: 'https://' },
    { k: 'note', label: '备注', type: 'textarea', rows: 2, full: true }
  ];

  JZ.views.deptWeb = {
    render: function (host) {
      const body = ui.page(host, {
        title: '部门网页',
        sub: '一键进入网站后台，稿件发布进度与素材集中管理',
        actions: [
          { text: '进入网页后台', class: 'btn-primary', onClick: () => { const l = db.linksOf('dept.web')[0]; window.open(l ? l.url : 'https://www.hebkx.cn/', '_blank'); } },
          { text: '＋登记稿件', class: 'btn-purple', onClick: () => ui.editRecord('deptPages', PAGE_F, null, { name: '稿件', preset: { date: u.ymd(u.today()) } }, () => JZ.go('deptWeb')) },
          { text: 'Excel导出', onClick: exp }
        ]
      });

      body.appendChild(ui.card({
        title: '后台与常用入口', tone: 'p',
        body: ui.linkZone({ cat: 'dept.web', title: '网站入口', tip: '点击卡片直接在新窗口打开后台，可自行添加更多入口' })
      }));

      const S = JZ.S;
      const listCard = ui.card({
        title: '稿件发布记录', tone: '', count: S.deptPages.length,
        actions: [{ text: '＋登记', class: 'btn-sm btn-primary', onClick: () => ui.editRecord('deptPages', PAGE_F, null, { name: '稿件', preset: { date: u.ymd(u.today()) } }, () => JZ.go('deptWeb')) }],
        body: S.deptPages.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>标题</th><th>栏目</th><th>日期</th><th>周次</th><th>状态</th><th>链接</th><th></th></tr></thead><tbody>' +
          S.deptPages.slice().sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1).map(p =>
            '<tr data-id="' + p.id + '"><td>' + u.esc(p.title) + '</td><td>' + u.esc(p.column || '') + '</td><td>' + u.esc(p.date || '') + '</td>' +
            '<td>' + (p.date && cal.weekOf(p.date) ? '第' + cal.weekOf(p.date) + '周' : '—') + '</td>' +
            '<td><span class="tag ' + (p.status === '已发布' ? 't-green' : p.status === '待审核' ? 't-amber' : 't-gray') + '">' + u.esc(p.status || '') + '</span></td>' +
            '<td>' + (p.url ? '<a href="' + u.esc(p.url) + '" target="_blank" style="color:var(--blue-600)">打开</a>' : '—') + '</td>' +
            '<td class="nowrap"><button class="btn btn-sm" data-a="ed">改</button> <button class="btn btn-sm btn-danger" data-a="rm">删</button></td></tr>').join('') +
          '</tbody></table></div>' : ui.empty('还没有稿件记录', '📰')
      });
      body.appendChild(listCard);
      u.$$('tr[data-id]', listCard).forEach(tr => {
        const rec = db.one('deptPages', tr.dataset.id);
        u.$('[data-a="ed"]', tr).onclick = () => ui.editRecord('deptPages', PAGE_F, rec, { name: '稿件' }, () => JZ.go('deptWeb'));
        u.$('[data-a="rm"]', tr).onclick = () => ui.confirmDel(rec.title, () => { db.del('deptPages', rec.id); JZ.go('deptWeb'); });
      });

      body.appendChild(ui.card({
        title: '网页素材与成果文件', tone: 'g',
        body: ui.fileZone({ cat: 'dept.web.file', refId: '', title: '图文素材、发布稿、截图存档', hint: '支持批量拖拽上传，随时下载或导出清单' })
      }));

      function exp() {
        JZ.io.exportRows(JZ.S.deptPages.map(p => ({
          标题: p.title, 栏目: p.column || '', 发布日期: p.date || '',
          校历周次: p.date && cal.weekOf(p.date) ? '第' + cal.weekOf(p.date) + '周' : '',
          状态: p.status || '', 链接: p.url || '', 备注: p.note || ''
        })), '部门网页稿件_' + u.ymd(u.today()) + '.xlsx', '网页稿件');
        u.toast('已导出Excel', 'ok');
      }
    }
  };

  /* ================= 3 部门报告 ================= */
  const REP_F = [
    { k: 'title', label: '报告名称', required: true, full: true },
    { k: 'kind', label: '类型', type: 'select', opts: ['工作总结', '汇报材料', '申报材料', '教学简报', '会议纪要', '其它'], def: '工作总结' },
    { k: 'status', label: '状态', type: 'select', opts: ['素材收集', '撰写中', '待审核', '已定稿', '已提交'], def: '素材收集' },
    { k: 'owner', label: '主笔 / 分工' },
    { k: 'due', label: '交稿日期', type: 'date' },
    { k: 'tags', label: '标签' },
    { k: 'content', label: '正文 / 要点', type: 'textarea', rows: 8, full: true, ph: '可直接在此撰写，支持导出Word与PDF' }
  ];

  JZ.views.deptReport = {
    render: function (host) {
      const body = ui.page(host, {
        title: '部门报告',
        sub: '参考资料、正文撰写、AI辅助入口、成果导出，一条流水线完成',
        actions: [
          { text: '＋新建报告', class: 'btn-primary', onClick: () => ui.editRecord('deptReports', REP_F, null, { name: '报告', wide: true }, () => JZ.go('deptReport')) },
          { text: 'Excel导出清单', onClick: exp }
        ]
      });

      body.appendChild(ui.card({
        title: 'AI与写作辅助入口', tone: 'p',
        body: ui.linkZone({
          cat: 'dept.ai', title: '常用网站',
          tip: '写报告时的常用工具，点击即在新窗口打开，可自行添加新的网站'
        })
      }));

      const g = u.el('div', { class: 'grid g2' });
      g.appendChild(ui.card({
        title: '参考资料区（上传后作为写作参考）', tone: 'g',
        body: ui.fileZone({ cat: 'dept.report.ref', refId: '', title: '往年报告、素材、数据表', hint: '本地已有的资料上传后可随时打开对照' })
      }));
      g.appendChild(ui.card({
        title: '报告成果区（定稿归档）', tone: 'k',
        body: ui.fileZone({ cat: 'dept.report.out', refId: '', title: '定稿文件', hint: '定稿Word、PDF、盖章扫描件都放这里' })
      }));
      body.appendChild(g);

      const S = JZ.S;
      const lc = ui.card({
        title: '报告清单', count: S.deptReports.length,
        body: S.deptReports.length ? S.deptReports.slice().sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)).map(r =>
          '<div class="item" data-id="' + r.id + '"><div class="item-h"><div style="min-width:0">' +
          '<div class="item-t">' + u.esc(r.title) + '</div>' +
          '<div class="item-f"><span class="tag t-blue">' + u.esc(r.kind || '') + '</span>' +
          '<span class="tag ' + (r.status === '已提交' || r.status === '已定稿' ? 't-green' : 't-amber') + '">' + u.esc(r.status || '') + '</span>' +
          (r.due ? '<span class="tag t-gray">交稿 ' + u.esc(r.due) + '　' + cal.dueText(r.due) + '</span>' : '') +
          (r.owner ? '<span class="tag t-purple">' + u.esc(r.owner) + '</span>' : '') +
          '<span class="muted">' + (r.content || '').length + ' 字</span></div></div>' +
          '<div class="row"><button class="btn btn-sm btn-primary" data-a="wr">撰写</button>' +
          '<button class="btn btn-sm" data-a="ed">属性</button>' +
          '<button class="btn btn-sm" data-a="wd">导Word</button>' +
          '<button class="btn btn-sm" data-a="pf">PDF</button>' +
          '<button class="btn btn-sm btn-danger" data-a="rm">删</button></div></div></div>').join('')
          : ui.empty('还没有报告，点右上角新建', '📑')
      });
      body.appendChild(lc);
      u.$$('.item', lc).forEach(it => {
        const rec = db.one('deptReports', it.dataset.id);
        u.$('[data-a="ed"]', it).onclick = () => ui.editRecord('deptReports', REP_F, rec, { name: '报告', wide: true }, () => JZ.go('deptReport'));
        u.$('[data-a="rm"]', it).onclick = () => ui.confirmDel(rec.title, () => { db.del('deptReports', rec.id); JZ.go('deptReport'); });
        u.$('[data-a="wd"]', it).onclick = () => {
          JZ.io.exportWord(rec.title, '<h1>' + u.esc(rec.title) + '</h1><div class="sub">' + u.esc(rec.kind || '') + '　' +
            u.esc(JZ.S.settings.dept || '') + '　' + u.esc(JZ.S.settings.ownerName || '') + '　' + u.ymd(u.today()) + '</div>' +
            (rec.content || '').split('\n').map(p => '<p>' + u.esc(p) + '</p>').join(''), rec.title);
          u.toast('Word已导出', 'ok');
        };
        u.$('[data-a="pf"]', it).onclick = () => JZ.io.exportPDF(rec.title,
          '<h1>' + u.esc(rec.title) + '</h1><div class="sub">' + u.esc(rec.kind || '') + '　' + u.ymd(u.today()) + '</div>' +
          (rec.content || '').split('\n').map(p => '<p>' + u.esc(p) + '</p>').join(''));
        u.$('[data-a="wr"]', it).onclick = () => writeModal(rec);
      });

      function writeModal(rec) {
        const wrap = u.el('div');
        const blk = ui.textBlock({
          title: rec.title, rows: 18, value: rec.content || '',
          ph: '在此撰写报告正文，内容自动保存',
          onSave: v => db.upd('deptReports', rec.id, { content: v })
        });
        wrap.appendChild(blk);
        const fz = ui.fileZone({ cat: 'dept.report.item', refId: rec.id, title: '本报告的专属附件' });
        wrap.appendChild(u.el('div', { style: 'margin-top:14px' })).appendChild(fz);
        u.modal({
          title: '撰写 · ' + rec.title, wide: true, body: wrap,
          buttons: [
            { text: '导出Word', class: 'btn btn-green', onClick: () => u.$$('.item[data-id="' + rec.id + '"] [data-a="wd"]')[0].click() },
            { text: '完成', class: 'btn btn-primary', onClick: (b, c) => { c(); JZ.go('deptReport'); } }
          ]
        });
      }
      function exp() {
        JZ.io.exportBook([
          {
            name: '报告清单', rows: JZ.S.deptReports.map(r => ({
              报告名称: r.title, 类型: r.kind || '', 状态: r.status || '', 主笔: r.owner || '',
              交稿日期: r.due || '', 字数: (r.content || '').length, 标签: r.tags || ''
            }))
          },
          {
            name: '报告正文', rows: JZ.S.deptReports.map(r => ({ 报告名称: r.title, 正文: r.content || '' }))
          }
        ], '部门报告_' + u.ymd(u.today()) + '.xlsx');
        u.toast('已导出Excel', 'ok');
      }
    }
  };

  /* ================= 4 部门视频 ================= */
  const VID_F = [
    { k: 'title', label: '名称', required: true, full: true },
    { k: 'zone', label: '所属区域', type: 'select', opts: [{ v: 'material', t: '素材区' }, { v: 'output', t: '成果区' }], def: 'material' },
    { k: 'type', label: '类型', type: 'select', opts: ['宣传片', '课程视频', '活动记录', '访谈', '素材片段', '图片音频', '其它'], def: '素材片段' },
    { k: 'duration', label: '时长 / 数量', ph: '如 3分20秒 或 12张' },
    { k: 'date', label: '日期', type: 'date' },
    { k: 'link', label: '在线链接', full: true, ph: '大文件建议放网盘，此处填链接' },
    { k: 'desc', label: '说明', type: 'textarea', rows: 3, full: true }
  ];

  JZ.views.deptVideo = {
    render: function (host) {
      const body = ui.page(host, {
        title: '部门视频',
        sub: '素材区收集拍摄与图文音频原料，成果区归档已完成的成片',
        actions: [
          { text: '＋登记条目', class: 'btn-primary', onClick: () => ui.editRecord('deptVideos', VID_F, null, { name: '视频条目', preset: { date: u.ymd(u.today()) } }, () => JZ.go('deptVideo')) },
          { text: 'Excel导出', onClick: exp }
        ]
      });

      const S = JZ.S;
      [['material', '素材区', 'g', '拍摄原片、配乐、图片、字幕稿等一切原料'],
      ['output', '视频成果区', 'k', '已完成的成片，含不同版本与投放平台']].forEach(z => {
        const list = S.deptVideos.filter(v => (v.zone || 'material') === z[0]);
        const c = ui.card({
          title: z[1], tone: z[2], count: list.length,
          actions: [{
            text: '＋登记', class: 'btn-sm', onClick: () => ui.editRecord('deptVideos', VID_F, null,
              { name: '条目', preset: { zone: z[0], date: u.ymd(u.today()) } }, () => JZ.go('deptVideo'))
          }],
          body: '<div class="hint" style="margin-bottom:10px">' + z[3] + '</div>' +
            (list.length ? '<div class="mini-grid" style="margin-bottom:14px">' + list.map(v =>
              '<div class="mini" data-id="' + v.id + '"><h4>' + (z[0] === 'output' ? '🎬 ' : '🎞 ') + u.esc(v.title) + '</h4>' +
              '<div class="hint">' + u.esc(v.desc || '暂无说明') + '</div>' +
              '<div class="mini-f"><span class="tag t-blue">' + u.esc(v.type || '') + '</span>' +
              '<span>' + u.esc(v.duration || '') + ' ' + u.esc(v.date || '') + '</span></div>' +
              '<div class="row" style="margin-top:8px">' +
              (v.link ? '<a class="btn btn-sm" href="' + u.esc(v.link) + '" target="_blank">在线</a>' : '') +
              '<button class="btn btn-sm" data-a="ed">改</button>' +
              '<button class="btn btn-sm btn-danger" data-a="rm">删</button></div></div>').join('') + '</div>' : '')
        });
        const fz = ui.fileZone({
          cat: 'dept.video.' + z[0], refId: '',
          title: z[0] === 'material' ? '素材文件上传' : '成片文件上传',
          hint: z[0] === 'material' ? '视频、音频、图片、脚本文档均可' : '成片体积较大时建议只存关键版本，其余用在线链接'
        });
        c.bodyEl.appendChild(fz);
        body.appendChild(c);
        u.$$('.mini', c).forEach(m => {
          const rec = db.one('deptVideos', m.dataset.id);
          const ed = u.$('[data-a="ed"]', m), rm = u.$('[data-a="rm"]', m);
          if (ed) ed.onclick = e => { e.stopPropagation(); ui.editRecord('deptVideos', VID_F, rec, { name: '条目' }, () => JZ.go('deptVideo')); };
          if (rm) rm.onclick = e => { e.stopPropagation(); ui.confirmDel(rec.title, () => { db.del('deptVideos', rec.id); JZ.go('deptVideo'); }); };
        });
      });

      function exp() {
        JZ.io.exportRows(JZ.S.deptVideos.map(v => ({
          区域: (v.zone === 'output' ? '成果区' : '素材区'), 名称: v.title, 类型: v.type || '',
          时长数量: v.duration || '', 日期: v.date || '', 链接: v.link || '', 说明: v.desc || ''
        })), '部门视频_' + u.ymd(u.today()) + '.xlsx', '部门视频');
        u.toast('已导出Excel', 'ok');
      }
    }
  };

  function fmtDate(v) {
    if (!v) return '';
    const d = u.parseYmd(String(v));
    return d ? u.ymd(d) : '';
  }
})(window.JZ);
