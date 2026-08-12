/* =========================================================
   other.js  五、其它工作：工作要求备忘 / 工作成果记录
   ========================================================= */
window.JZ.views = window.JZ.views || {};
(function (JZ) {
  'use strict';
  const u = JZ.u, db = JZ.db, cal = JZ.cal, ui = JZ.ui;

  const PRI = [{ v: '1', t: '高' }, { v: '2', t: '中' }, { v: '3', t: '低' }];
  const priTag = p => '<span class="tag ' + (p === '1' ? 't-red' : p === '3' ? 't-gray' : 't-amber') + '">' +
    (p === '1' ? '高' : p === '3' ? '低' : '中') + '优先</span>';

  const MEMO_F = [
    { k: 'title', label: '工作要求', required: true, full: true, ph: '一句话说明要做什么' },
    { k: 'source', label: '来源', ph: '如 学院 / 教务处 / 工会 / 班主任工作' },
    { k: 'content', label: '具体要求与标准', type: 'textarea', rows: 5, full: true },
    { k: 'due', label: '截止日期', type: 'date' },
    { k: 'priority', label: '优先级', type: 'select', opts: PRI, def: '2' },
    { k: 'link', label: '相关链接', full: true, ph: 'https://' }
  ];
  const RES_F = [
    { k: 'title', label: '成果名称', required: true, full: true },
    { k: 'type', label: '类别', type: 'select', opts: ['日常工作', '临时任务', '志愿服务', '培训学习', '荣誉表彰', '社会服务', '其它'], def: '日常工作' },
    { k: 'date', label: '完成日期', type: 'date' },
    { k: 'content', label: '成果说明与价值', type: 'textarea', rows: 5, full: true },
    { k: 'tags', label: '标签' }
  ];

  /* ================= 1 工作要求备忘 ================= */
  JZ.views.otherMemo = {
    render: function (host) {
      const S = JZ.S, t = u.ymd(u.today());
      let f = JZ.viewState.otherTab || 'open';
      const body = ui.page(host, {
        title: '工作要求备忘',
        sub: '各类零散工作要求集中登记，避免遗漏；截止日期自动换算校历周次',
        actions: [
          { text: '＋新增要求', class: 'btn-primary', onClick: () => ui.editRecord('otherMemos', MEMO_F, null, { name: '工作要求', wide: true, preset: { done: false, priority: '2' } }, () => JZ.go('otherMemo')) },
          { text: 'Excel导入', onClick: imp },
          { text: 'Excel导出', onClick: exp },
          { text: '打印/PDF', onClick: pdf }
        ]
      });

      const wk = cal.weekOf(t), r = wk ? cal.weekRange(wk) : null;
      const counts = {
        open: S.otherMemos.filter(x => !x.done).length,
        week: r ? S.otherMemos.filter(x => !x.done && x.due && x.due >= r.start && x.due <= r.end).length : 0,
        over: S.otherMemos.filter(x => !x.done && x.due && x.due < t).length,
        done: S.otherMemos.filter(x => x.done).length,
        all: S.otherMemos.length
      };
      const wrap = u.el('div');
      body.appendChild(wrap);
      draw();

      function draw() {
        wrap.innerHTML = '';
        wrap.appendChild(ui.tabs([
          { k: 'open', t: '未完成', n: counts.open },
          { k: 'week', t: '本周（第' + (wk || '-') + '周）', n: counts.week },
          { k: 'over', t: '已逾期', n: counts.over },
          { k: 'done', t: '已完成', n: counts.done },
          { k: 'all', t: '全部', n: counts.all }
        ], f, k => { f = k; JZ.viewState.otherTab = k; draw(); }));

        const list = S.otherMemos.filter(x => {
          if (f === 'open') return !x.done;
          if (f === 'week') return !x.done && x.due && r && x.due >= r.start && x.due <= r.end;
          if (f === 'over') return !x.done && x.due && x.due < t;
          if (f === 'done') return x.done;
          return true;
        }).sort((a, b) => {
          if (!!a.done !== !!b.done) return a.done ? 1 : -1;
          return (a.due || '9999') < (b.due || '9999') ? -1 : 1;
        });

        const bx = u.el('div');
        bx.innerHTML = list.length ? list.map(x => {
          const over = !x.done && x.due && x.due < t;
          const w2 = x.due ? cal.weekOf(x.due) : 0;
          return '<div class="item ' + (x.done ? 'ok' : over ? 'warn' : 'hl') + '" data-id="' + x.id + '"><div class="item-h">' +
            '<div class="row" style="gap:9px;align-items:flex-start"><span class="chk' + (x.done ? ' on' : '') + '" data-a="tg"></span><div>' +
            '<div class="item-t" style="' + (x.done ? 'text-decoration:line-through;opacity:.6' : '') + '">' + u.esc(x.title) + '</div>' +
            (x.content ? '<div class="item-x">' + u.esc(x.content) + '</div>' : '') +
            '<div class="item-f">' + priTag(x.priority) +
            (x.source ? '<span class="tag t-purple">' + u.esc(x.source) + '</span>' : '') +
            (x.due ? '<span class="tag ' + (over ? 't-red' : 't-blue') + '">' + u.esc(x.due) + (w2 ? ' · 第' + w2 + '周' : '') + '　' + cal.dueText(x.due) + '</span>' : '') +
            (x.link ? '<a class="tag t-green" href="' + u.esc(x.link) + '" target="_blank">链接 ↗</a>' : '') +
            '</div></div></div><div class="row">' +
            '<button class="btn btn-sm btn-green" data-a="res">记为成果</button>' +
            '<button class="btn btn-sm" data-a="ed">改</button>' +
            '<button class="btn btn-sm btn-danger" data-a="rm">删</button></div></div></div>';
        }).join('') : ui.empty('这一类暂无记录', '🧧');
        wrap.appendChild(bx);
        u.$$('.item', bx).forEach(it => {
          const x = db.one('otherMemos', it.dataset.id);
          u.$('[data-a="tg"]', it).onclick = () => { db.upd('otherMemos', x.id, { done: !x.done, doneAt: Date.now() }); JZ.go('otherMemo'); };
          u.$('[data-a="ed"]', it).onclick = () => ui.editRecord('otherMemos', MEMO_F, x, { name: '工作要求', wide: true }, () => JZ.go('otherMemo'));
          u.$('[data-a="rm"]', it).onclick = () => ui.confirmDel(x.title, () => { db.del('otherMemos', x.id); JZ.go('otherMemo'); });
          u.$('[data-a="res"]', it).onclick = () => ui.editRecord('otherResults', RES_F, null, {
            name: '工作成果', wide: true,
            preset: { title: x.title, content: x.content || '', date: u.ymd(u.today()), type: '日常工作', tags: x.source || '' }
          }, () => { db.upd('otherMemos', x.id, { done: true, doneAt: Date.now() }); u.toast('已完成并记入成果', 'ok'); JZ.go('otherResult'); });
        });
      }

      body.appendChild(ui.card({
        title: '相关通知与附件', tone: 'p',
        body: ui.fileZone({ cat: 'other.memo', refId: '', title: '通知文件、表格、回执', hint: '零散工作对应的文件统一存放，避免翻找邮件与群聊' })
      }));
      body.appendChild(ui.card({
        title: '常用办事入口', tone: 'g',
        body: ui.linkZone({ cat: 'other.link', title: '办事网站', tip: '教务系统、人事系统、工会、财务报销等' })
      }));

      function exp() {
        if (!S.otherMemos.length) { u.toast('暂无数据', 'warn'); return; }
        JZ.io.exportRows(S.otherMemos.map(x => ({
          工作要求: x.title, 来源: x.source || '', 具体要求: x.content || '', 截止日期: x.due || '',
          校历周次: x.due && cal.weekOf(x.due) ? '第' + cal.weekOf(x.due) + '周' : '',
          优先级: x.priority === '1' ? '高' : x.priority === '3' ? '低' : '中',
          状态: x.done ? '已完成' : '未完成', 链接: x.link || ''
        })), '工作要求备忘_' + u.ymd(u.today()) + '.xlsx', '工作要求');
        u.toast('已导出', 'ok');
      }
      async function imp() {
        const f2 = await u.pickFile('.xlsx,.xls,.csv'); if (!f2) return;
        try {
          const rows = await JZ.io.readSheet(f2);
          let n = 0;
          rows.forEach(rw => {
            const title = JZ.io.pick(rw, ['工作要求', '事项', '标题', '任务']);
            if (!title) return;
            db.add('otherMemos', {
              title: String(title), source: String(JZ.io.pick(rw, ['来源', '部门']) || ''),
              content: String(JZ.io.pick(rw, ['具体要求', '说明', '内容']) || ''),
              due: fmtD(JZ.io.pick(rw, ['截止日期', '截止', '日期'])),
              priority: ({ 高: '1', 中: '2', 低: '3' })[String(JZ.io.pick(rw, ['优先级']) || '').trim()] || '2',
              done: String(JZ.io.pick(rw, ['状态']) || '').indexOf('完成') === 0
            });
            n++;
          });
          u.toast('已导入 ' + n + ' 条', 'ok'); JZ.go('otherMemo');
        } catch (e) { u.toast('导入失败：' + e.message, 'err', 4000); }
      }
      function pdf() {
        const list = S.otherMemos.filter(x => f === 'all' ? true : !x.done);
        JZ.io.exportPDF('工作要求备忘',
          '<h1>工作要求备忘</h1><div class="sub">' + cal.termLabel() + '　' + cal.weekText(t) + '　制表 ' + t + '</div>' +
          '<table><tr><th>工作要求</th><th>来源</th><th>截止</th><th>优先级</th><th>状态</th></tr>' +
          list.map(x => '<tr><td>' + u.esc(x.title) + '</td><td>' + u.esc(x.source || '') + '</td><td>' + u.esc(x.due || '') +
            '</td><td>' + (x.priority === '1' ? '高' : x.priority === '3' ? '低' : '中') + '</td><td>' + (x.done ? '已完成' : '未完成') + '</td></tr>').join('') + '</table>');
      }
    }
  };

  /* ================= 2 工作成果记录 ================= */
  JZ.views.otherResult = {
    render: function (host) {
      const S = JZ.S, t = u.ymd(u.today());
      let yf = JZ.viewState.resYear || '';
      const body = ui.page(host, {
        title: '工作成果记录',
        sub: '把做过的事沉淀下来，年度考核、评优、职称材料随时可取',
        actions: [
          { text: '＋登记成果', class: 'btn-primary', onClick: () => ui.editRecord('otherResults', RES_F, null, { name: '工作成果', wide: true, preset: { date: t, type: '日常工作' } }, () => JZ.go('otherResult')) },
          { text: '导出Excel', onClick: expX },
          { text: '生成年度总结Word', class: 'btn-purple', onClick: expW }
        ]
      });

      const years = Array.from(new Set(S.otherResults.map(x => (x.date || '').slice(0, 4)).filter(Boolean))).sort().reverse();
      const thisY = t.slice(0, 4);
      const byType = {};
      S.otherResults.forEach(x => { byType[x.type] = (byType[x.type] || 0) + 1; });
      body.innerHTML += ui.stats([
        { k: '成果总数', v: S.otherResults.length, x: years.length ? years.length + ' 个年度' : '—' },
        { k: '今年记录', v: S.otherResults.filter(x => (x.date || '').slice(0, 4) === thisY).length, x: thisY + ' 年', tone: 'p' },
        { k: '荣誉表彰', v: byType['荣誉表彰'] || 0, x: '含各级奖励' },
        { k: '待办转化', v: S.otherMemos.filter(x => x.done).length, x: '已完成的工作要求', tone: 'k' }
      ]);

      const bar = u.el('div', { class: 'badges', style: 'margin-bottom:12px' });
      bar.innerHTML = '<span class="chip' + (yf ? '' : ' on') + '" data-y="">全部年份</span>' +
        years.map(y => '<span class="chip' + (yf === y ? ' on' : '') + '" data-y="' + y + '">' + y + ' 年 ' +
          S.otherResults.filter(x => (x.date || '').slice(0, 4) === y).length + '</span>').join('');
      body.appendChild(bar);
      u.$$('.chip', bar).forEach(c => c.onclick = () => { JZ.viewState.resYear = c.dataset.y; JZ.go('otherResult'); });

      const list = S.otherResults.filter(x => !yf || (x.date || '').slice(0, 4) === yf)
        .sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1);
      const bx = u.el('div');
      bx.innerHTML = list.length ? list.map(x =>
        '<div class="item ok" data-id="' + x.id + '"><div class="item-h"><div style="min-width:0;flex:1">' +
        '<div class="item-t">🌸 ' + u.esc(x.title) + '</div>' +
        (x.content ? '<div class="item-x">' + u.esc(x.content) + '</div>' : '') +
        '<div class="item-f"><span class="tag t-blue">' + u.esc(x.type || '') + '</span>' +
        '<span class="tag t-gray">' + u.esc(x.date || '') +
        (x.date && cal.weekOf(x.date) ? ' · 第' + cal.weekOf(x.date) + '周' : '') + '</span>' +
        (x.tags ? '<span class="tag t-purple">' + u.esc(x.tags) + '</span>' : '') +
        '<span class="tag t-pink">附件 ' + db.filesOf('other.res', x.id).length + '</span></div></div>' +
        '<div class="row"><button class="btn btn-sm" data-a="fz">附件</button>' +
        '<button class="btn btn-sm" data-a="ed">改</button>' +
        '<button class="btn btn-sm btn-danger" data-a="rm">删</button></div></div></div>').join('')
        : ui.empty('还没有登记成果，做过的每件事都值得留痕', '🌸');
      body.appendChild(ui.card({ title: '成果记录', count: list.length, body: bx }));
      u.$$('.item', bx).forEach(it => {
        const x = db.one('otherResults', it.dataset.id);
        u.$('[data-a="ed"]', it).onclick = () => ui.editRecord('otherResults', RES_F, x, { name: '工作成果', wide: true }, () => JZ.go('otherResult'));
        u.$('[data-a="rm"]', it).onclick = () => ui.confirmDel(x.title, () => { db.del('otherResults', x.id); JZ.go('otherResult'); });
        u.$('[data-a="fz"]', it).onclick = () => {
          const w = u.el('div');
          w.appendChild(ui.fileZone({ cat: 'other.res', refId: x.id, title: '佐证材料', hint: '照片、证书、文件、截图' }));
          u.modal({ title: '佐证材料 · ' + x.title, wide: true, body: w, buttons: [{ text: '关闭', class: 'btn btn-primary', onClick: (b, c) => c() }] });
        };
      });

      body.appendChild(ui.card({
        title: '综合佐证材料库', tone: 'g',
        body: ui.fileZone({ cat: 'other.res.all', refId: '', title: '不针对单条成果的通用材料', hint: '年度考核表、总结、汇总照片等' })
      }));

      function expX() {
        if (!S.otherResults.length) { u.toast('暂无数据', 'warn'); return; }
        JZ.io.exportRows(S.otherResults.map(x => ({
          完成日期: x.date || '', 类别: x.type || '', 成果名称: x.title,
          成果说明: x.content || '', 标签: x.tags || ''
        })), '工作成果记录_' + u.ymd(u.today()) + '.xlsx', '工作成果');
        u.toast('已导出', 'ok');
      }
      function expW() {
        const y = yf || thisY;
        const rows = S.otherResults.filter(x => (x.date || '').slice(0, 4) === y)
          .sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1);
        if (!rows.length) { u.toast(y + ' 年还没有成果记录', 'warn'); return; }
        const g = {};
        rows.forEach(x => { (g[x.type] = g[x.type] || []).push(x); });
        JZ.io.exportWord(y + ' 年度工作成果总结',
          '<h1>' + y + ' 年度工作成果总结</h1>' +
          '<div class="sub">' + u.esc(S.settings.ownerName || '') + (S.settings.dept ? '　' + u.esc(S.settings.dept) : '') +
          '　制表 ' + t + '　共 ' + rows.length + ' 项</div>' +
          Object.keys(g).map(k => '<h2>' + u.esc(k) + '（' + g[k].length + ' 项）</h2>' +
            g[k].map((x, i) => '<h3>' + (i + 1) + '. ' + u.esc(x.title) + '</h3>' +
              '<p class="meta">' + u.esc(x.date || '') + (x.tags ? '　' + u.esc(x.tags) : '') + '</p>' +
              (x.content ? '<p>' + u.esc(x.content).replace(/\n/g, '<br>') + '</p>' : '')).join('')).join(''),
          y + '年度工作成果总结');
        u.toast('Word已生成', 'ok');
      }
    }
  };

  function fmtD(v) {
    if (!v) return '';
    const s = String(v).trim();
    const m = s.match(/^(\d{4})[-\/年.](\d{1,2})[-\/月.](\d{1,2})/);
    if (m) return m[1] + '-' + u.pad(+m[2]) + '-' + u.pad(+m[3]);
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : u.ymd(d);
  }
})(window.JZ);
