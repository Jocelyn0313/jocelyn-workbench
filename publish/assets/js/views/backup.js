/* =========================================================
   backup.js  备份与恢复
   支持按大类整体导出，或按板块 / 竞赛项目 / 课题项目 / 学期 / 学期+班级
   做部分导出，避免单一备份文件过大；教学工作台数据一并纳入
   ========================================================= */
window.JZ.views = window.JZ.views || {};
(function (JZ) {
  'use strict';
  const u = JZ.u, db = JZ.db, ui = JZ.ui;
  function twS() { return (window.TW || {}).S; }

  /* 各 JZ 大类包含的数据键（与 io.js GROUPS 保持一致） */
  const GROUP_KEYS = {
    settings: ['settings'],
    dept: ['deptTodos', 'deptPages', 'deptReports', 'deptVideos', 'links'],
    comp: ['comps', 'compYears', 'compItems', 'compWorks'],
    research: ['projects', 'lits', 'venues', 'progress', 'exps', 'writings', 'rsTasks', 'rsDiary', 'radar', 'libItems', 'subs', 'outputs', 'reviews'],
    other: ['otherMemos', 'otherResults'],
    files: ['files']
  };
  const RS_SCOPED = ['lits', 'venues', 'progress', 'exps', 'writings', 'rsTasks', 'radar', 'subs', 'reviews'];

  function byteLen(obj) {
    try { return new Blob([typeof obj === 'string' ? obj : JSON.stringify(obj)]).size; }
    catch (e) { return (JSON.stringify(obj) || '').length; }
  }

  /* 数据概览：各模块记录数 */
  function summary() {
    const S = JZ.S;
    const rows = [
      ['部门待办', S.deptTodos.length],
      ['部门网页入口', db.linksOf('dept.web').length + db.linksOf('dept.ai').length],
      ['部门报告', S.deptReports.length],
      ['部门视频', S.deptVideos.length],
      ['竞赛项目', S.comps.length],
      ['参赛作品', S.compWorks.length],
      ['课题与个研', S.projects.length],
      ['文献库', S.lits.length],
      ['文献雷达', S.radar.length],
      ['投稿记录', S.subs.length],
      ['学术产出', S.outputs.length],
      ['其它成果', S.otherResults.length],
      ['附件文件', S.files.length]
    ];
    return '<div class="grid g3">' + rows.map(r =>
      '<div style="display:flex;justify-content:space-between;border:1px solid var(--line);border-radius:8px;padding:8px 11px">' +
      '<span class="hint">' + u.esc(r[0]) + '</span><b style="font-weight:700">' + r[1] + '</b></div>').join('') + '</div>';
  }

  JZ.views.backup = {
    render: function (host) {
      const body = ui.page(host, {
        title: '备份与恢复',
        sub: '可按大类整体导出，或下钻到板块 / 竞赛项目 / 课题项目 / 学期 / 学期+班级做部分导出；教学工作台数据也一并纳入',
        actions: [{ text: '系统设置', class: 'btn-ghost', onClick: () => JZ.go('settings') }]
      });

      /* 数据概览 */
      body.appendChild(ui.card({
        title: '当前数据概览', tone: 'k',
        hint: '存储方式：' + (db.idbOK ? 'IndexedDB（支持大文件）' : '本地文件模式（单文件上限约1.2MB）'),
        body: summary()
      }));

      /* ---------- 备份导出（二级勾选树） ---------- */
      const GMETA = [
        { id: 'settings', label: '全局设置与校历', desc: '学年、学期、校历、目标等基础配置', whole: true },
        { id: 'dept', label: '部门工作', desc: '待办、网页入口、报告、视频', boards: [
          { k: 'deptTodos', t: '待办备忘' }, { k: 'deptPages', t: '部门网页条目' }, { k: 'deptReports', t: '部门报告' }, { k: 'deptVideos', t: '部门视频' }, { k: 'links', t: '网页入口' }
        ] },
        { id: 'comp', label: '竞赛管理', desc: '竞赛、届次、条目、参赛作品', byItem: 'comp' },
        { id: 'research', label: '科研与课题', desc: '课题、文献、投稿、产出等', byItem: 'project' },
        { id: 'other', label: '其它成果', desc: '备忘录、其它成果记录', boards: [
          { k: 'otherMemos', t: '工作要求备忘' }, { k: 'otherResults', t: '工作成果记录' }
        ] },
        { id: 'files', label: '附件文件（二进制）', desc: '已上传的附件本体，体积最大', whole: true },
        { id: 'teaching', label: '教学工作台', desc: '课表、考勤、平时分、成绩、学情', teaching: true }
      ];

      const sel = { settings: null, dept: null, comp: null, research: null, other: null, files: null, teaching: null };
      const open = {};

      function grpWhole(g) { return sel[g] === 'whole'; }
      function groupSelected(g) {
        if (g === 'teaching') return !!sel.teaching;
        return !!sel[g];
      }
      function countSelected() {
        let n = 0; GMETA.forEach(m => { if (groupSelected(m.id)) n++; }); return n;
      }

      function compProjBytes(g, id) {
        let b = 0;
        if (g === 'comp') {
          b += byteLen(JZ.S.comps.filter(r => r.id === id));
          ['compYears', 'compItems', 'compWorks'].forEach(k => b += byteLen(JZ.S[k].filter(r => r.compId === id)));
        } else {
          b += byteLen(JZ.S.projects.filter(r => r.id === id));
          RS_SCOPED.forEach(k => b += byteLen(JZ.S[k].filter(r => r.projectId === id)));
        }
        return b;
      }
      function twBytes(t) {
        const S = twS(); if (!S) return 0;
        if (t.mode === 'whole') return byteLen(S);
        if (t.mode === 'term') {
          const ids = t.terms || new Set(); const cids = new Set();
          S.classes.forEach(c => { if (ids.has(c.termId)) cids.add(c.id); });
          let b = byteLen(S.classes.filter(c => ids.has(c.termId))) + byteLen(S.schedule.filter(s => ids.has(s.termId)));
          b += byteLen(S.exams.filter(e => ids.has(e.termId) || cids.has(e.classId))) + byteLen(S.adjustments.filter(a => ids.has(a.termId)));
          b += byteLen(S.todos.filter(x => ids.has(x.termId) || cids.has(x.classId))) + byteLen(S.reflections.filter(r => cids.has(r.classId)));
          b += byteLen(pickObj(S.roster, cids)) + byteLen(pickObj(S.records, cids)) + byteLen(pickObj(S.bonus, cids));
          return b;
        }
        if (t.mode === 'termClass') {
          const cids = new Set(); Array.from(t.pairs || new Set()).forEach(p => { const c = p.split('|')[1]; cids.add(c); });
          let b = byteLen(S.classes.filter(c => cids.has(c.id))) + byteLen(S.schedule.filter(s => cids.has(s.classId)));
          b += byteLen(S.exams.filter(e => cids.has(e.classId))) + byteLen(S.reflections.filter(r => cids.has(r.classId)));
          b += byteLen(pickObj(S.roster, cids)) + byteLen(pickObj(S.records, cids)) + byteLen(pickObj(S.bonus, cids));
          return b;
        }
        return 0;
      }
      function pickObj(obj, idSet) { const o = {}; Object.keys(obj).forEach(k => { if (idSet.has(k)) o[k] = obj[k]; }); return o; }

      function updateEst() {
        const est = u.$('#bkEst', bc.bodyEl); if (!est) return;
        let bytes = 0, hasFiles = false, hasTeaching = false;
        GMETA.forEach(m => {
          const g = m.id, spec = sel[g]; if (!spec) return;
          if (g === 'files') { hasFiles = true; bytes += byteLen(JZ.S.files); return; }
          if (spec === 'whole') { GROUP_KEYS[g].forEach(k => bytes += byteLen(JZ.S[k])); }
          else if (spec.keys) { spec.keys.forEach(k => bytes += byteLen(JZ.S[k])); }
          else if (spec.ids) { spec.ids.forEach(id => bytes += compProjBytes(g, id)); }
        });
        if (sel.teaching) { hasTeaching = true; bytes += twBytes(sel.teaching); }
        let txt = '已选 ' + countSelected() + ' 类工作 · 约 ' + u.fmtSize(bytes);
        if (hasFiles) { const fb = JZ.S.files.reduce((s, f) => s + (f.size || 0), 0); txt += '（含附件二进制约 ' + u.fmtSize(fb) + '）'; }
        if (hasTeaching) txt += '（含教学工作台）';
        est.textContent = txt;
      }

      function teachingSub() {
        const t = sel.teaching || {}; const mode = t.mode || '';
        const seg = '<div class="bk-seg">' +
          ['whole', 'term', 'termClass'].map(m => '<span class="chip' + (mode === m ? ' on' : '') + '" data-tmode="' + m + '">' + ({ whole: '整体', term: '按学期', termClass: '按学期+班级' }[m]) + '</span>').join('') + '</div>';
        let body = '';
        if (mode === 'term' || mode === 'termClass') {
          const terms = (twS() && twS().settings && twS().settings.terms) || [];
          if (!terms.length) body = '<div class="hint">尚未在「教学工作台·设置」配置学期</div>';
          else body = terms.map(tm => {
            const tid = tm.id;
            if (mode === 'term') {
              const on = t.terms && t.terms.has(tid);
              return '<label class="bk-item sm"><input type="checkbox" data-tterm="' + tid + '"' + (on ? ' checked' : '') + '><span class="bk-main"><b>' + u.esc((tm.schoolYear || '') + ' ' + (tm.termName || '')) + '</b><span class="hint">课表与学期内全部教学数据</span></span></label>';
            }
            const cls = (twS().classes || []).filter(c => c.termId === tid);
            const classRows = cls.length ? cls.map(c => {
              const pair = tid + '|' + c.id; const on = t.pairs && t.pairs.has(pair);
              return '<label class="bk-item sm nest"><input type="checkbox" data-tpair="' + pair + '"' + (on ? ' checked' : '') + '><span class="bk-main"><b>' + u.esc(c.name || '未命名班级') + '</b><span class="hint">考勤 · 平时分 · 成绩 · 学情</span></span></label>';
            }).join('') : '<span class="hint">该学期暂无班级</span>';
            return '<div class="bk-nest"><div class="bk-nest-h">' + u.esc((tm.schoolYear || '') + ' ' + (tm.termName || '')) + '</div>' + classRows + '</div>';
          }).join('');
        }
        return '<div class="bk-sub">' + seg + body + '</div>';
      }

      function subPanel(g) {
        if (g.id === 'teaching') return teachingSub();
        if (g.boards) {
          return '<div class="bk-sub">' + g.boards.map(b => {
            const on = sel[g.id] && sel[g.id].keys && sel[g.id].keys.has(b.k);
            return '<label class="bk-item sm"><input type="checkbox" data-sub="' + g.id + '" data-key="' + b.k + '"' + (on ? ' checked' : '') + '><span class="bk-main"><b>' + u.esc(b.t) + '</b></span></label>';
          }).join('') + '</div>';
        }
        if (g.byItem === 'comp') {
          const list = JZ.S.comps || [];
          if (!list.length) return '<div class="bk-sub"><span class="hint">暂无竞赛项目</span></div>';
          return '<div class="bk-sub">' + list.map(c => {
            const on = sel.comp && sel.comp.ids && sel.comp.ids.has(c.id);
            return '<label class="bk-item sm"><input type="checkbox" data-sub="comp" data-id="' + c.id + '"' + (on ? ' checked' : '') + '><span class="bk-main"><b>' + u.esc(c.name || '未命名') + '</b>' + (c.org ? '<span class="hint">' + u.esc(c.org) + '</span>' : '') + '</span></label>';
          }).join('') + '</div>';
        }
        if (g.byItem === 'project') {
          const list = JZ.S.projects || [];
          if (!list.length) return '<div class="bk-sub"><span class="hint">暂无课题项目</span></div>';
          return '<div class="bk-sub">' + list.map(p => {
            const on = sel.research && sel.research.ids && sel.research.ids.has(p.id);
            return '<label class="bk-item sm"><input type="checkbox" data-sub="research" data-id="' + p.id + '"' + (on ? ' checked' : '') + '><span class="bk-main"><b>' + u.esc(p.name || '未命名') + '</b>' + (p.kind ? '<span class="hint">' + u.esc(p.kind) + '</span>' : '') + '</span></label>';
          }).join('') + '</div>';
        }
        return '';
      }

      function renderGroups() {
        const wrap = u.$('#bkGroups', bc.bodyEl); if (!wrap) return;
        wrap.innerHTML = GMETA.map(g => {
          const isWhole = grpWhole(g.id);
          const hasSub = !!(g.boards || g.byItem || g.teaching);
          const expanded = open[g.id];
          const sub = (hasSub && expanded) ? subPanel(g) : '';
          return '<div class="bk-group' + (groupSelected(g.id) ? ' on' : '') + '">' +
            '<div class="bk-ghead">' +
            '<label class="bk-item' + (isWhole ? ' on' : '') + '"><input type="checkbox" data-whole="' + g.id + '"' + (isWhole ? ' checked' : '') + '>' +
            '<span class="bk-main"><b>' + u.esc(g.label) + '</b><span class="hint">' + u.esc(g.desc) + '</span></span></label>' +
            (hasSub ? '<button class="bk-caret" data-caret="' + g.id + '" title="展开/收起">' + (expanded ? '▾' : '▸') + '</button>' : '') +
            '</div>' + sub + '</div>';
        }).join('');
        bindGroups(wrap);
        updateEst();
      }

      function bindGroups(wrap) {
        wrap.querySelectorAll('[data-whole]').forEach(cb => {
          cb.onchange = () => { const g = cb.dataset.whole; if (cb.checked) sel[g] = 'whole'; else if (sel[g] === 'whole') sel[g] = null; renderGroups(); };
        });
        wrap.querySelectorAll('[data-caret]').forEach(btn => {
          btn.onclick = () => { const g = btn.dataset.caret; open[g] = !open[g]; renderGroups(); };
        });
        wrap.querySelectorAll('[data-sub]').forEach(cb => {
          cb.onchange = () => {
            const g = cb.dataset.sub; const key = cb.dataset.key; const id = cb.dataset.id;
            if (sel[g] === 'whole') sel[g] = null;
            if (g === 'comp' || g === 'research') {
              if (!sel[g] || !sel[g].ids) sel[g] = { ids: new Set() };
              if (cb.checked) sel[g].ids.add(id); else sel[g].ids.delete(id);
              if (sel[g].ids.size === 0) sel[g] = null;
            } else {
              if (!sel[g] || !sel[g].keys) sel[g] = { keys: new Set() };
              if (cb.checked) sel[g].keys.add(key); else sel[g].keys.delete(key);
              if (sel[g].keys.size === 0) sel[g] = null;
            }
            renderGroups();
          };
        });
        wrap.querySelectorAll('[data-tmode]').forEach(ch => {
          ch.onclick = () => {
            const m = ch.dataset.tmode;
            sel.teaching = m === 'whole' ? { mode: 'whole' } : (m === 'term' ? { mode: 'term', terms: new Set() } : (m === 'termClass' ? { mode: 'termClass', pairs: new Set() } : null));
            renderGroups();
          };
        });
        wrap.querySelectorAll('[data-tterm]').forEach(cb => {
          cb.onchange = () => {
            if (!sel.teaching || sel.teaching.mode !== 'term') sel.teaching = { mode: 'term', terms: new Set() };
            if (cb.checked) sel.teaching.terms.add(cb.dataset.tterm); else sel.teaching.terms.delete(cb.dataset.tterm);
            if (sel.teaching.terms.size === 0) sel.teaching = null;
            renderGroups();
          };
        });
        wrap.querySelectorAll('[data-tpair]').forEach(cb => {
          cb.onchange = () => {
            if (!sel.teaching || sel.teaching.mode !== 'termClass') sel.teaching = { mode: 'termClass', pairs: new Set() };
            if (cb.checked) sel.teaching.pairs.add(cb.dataset.tpair); else sel.teaching.pairs.delete(cb.dataset.tpair);
            if (sel.teaching.pairs.size === 0) sel.teaching = null;
            renderGroups();
          };
        });
      }

      const bc = ui.card({
        title: '备份导出', tone: 'g',
        hint: '勾选大类可整体导出；点右侧箭头可下钻到板块 / 竞赛 / 课题 / 学期进一步选择。未勾选的内容不会被包含',
        body:
          '<p class="hint" style="margin-top:0">导出一个 JSON 文件保存在本机下载目录。' +
          '取消勾选的板块不会被包含，可显著减小体积；附件（二进制）体积最大可按需取舍。' +
          '部分导出恢复时建议用「合并」模式，避免覆盖其它数据。</p>' +
          '<div class="bk-groups" id="bkGroups"></div>' +
          '<div class="row" style="gap:10px;margin-top:10px">' +
          '<button class="btn btn-sm btn-ghost" id="bkSelAll">全选</button>' +
          '<button class="btn btn-sm btn-ghost" id="bkSelNone">全不选</button>' +
          '<span class="hint" id="bkEst" style="align-self:center"></span></div>' +
          '<div class="row" style="gap:10px;margin-top:12px">' +
          '<button class="btn btn-primary" id="bkExp">导出选中内容</button></div>'
      });
      body.appendChild(bc);

      renderGroups();
      u.$('#bkSelAll', bc.bodyEl).onclick = () => {
        GMETA.forEach(m => { if (m.id === 'teaching') sel.teaching = { mode: 'whole' }; else sel[m.id] = 'whole'; });
        for (const k in open) open[k] = false;
        renderGroups();
      };
      u.$('#bkSelNone', bc.bodyEl).onclick = () => {
        GMETA.forEach(m => { sel[m.id] = null; }); sel.teaching = null;
        for (const k in open) open[k] = false;
        renderGroups();
      };
      u.$('#bkExp', bc.bodyEl).onclick = async () => { await JZ.io.backup(sel); };

      /* 恢复导入 */
      const rc = ui.card({
        title: '恢复导入', tone: 'a',
        body:
          '<p class="hint" style="margin-top:0">选择一个此前导出的备份JSON文件。替换模式覆盖现有全部数据；' +
          '合并模式仅补充新记录（按ID去重，不改动已有记录）。<b>部分导出（只含某些板块/项目/班级）请务必用合并模式</b>，否则会丢失其它数据。</p>' +
          '<div class="form-grid"><div class="field full"><label>恢复模式</label>' +
          '<select class="select" id="rsMode">' +
          '<option value="replace">替换全部（覆盖现有数据）</option>' +
          '<option value="merge">合并（保留现有，仅补充新记录）</option></select></div></div>' +
          '<button class="btn btn-primary" id="rsBtn">选择备份文件并恢复</button>'
      });
      body.appendChild(rc);
      u.$('#rsBtn', rc.bodyEl).onclick = async () => {
        const file = await u.pickFile('application/json,.json', false);
        if (!file) return;
        const mode = u.$('#rsMode', rc.bodyEl).value;
        u.confirm('即将' + (mode === 'replace' ? '覆盖' : '合并') + '当前数据，建议先做一次备份。继续？', async () => {
          try {
            await JZ.io.restore(file, mode);
            u.toast('数据已恢复，正在刷新', 'ok');
          } catch (e) { u.toast('恢复失败：' + e.message, 'err', 5000); }
        });
      };

      /* 危险操作 */
      const dc = ui.card({
        title: '危险操作', tone: 'r',
        body:
          '<p class="hint" style="margin-top:0;color:#f87171">清空将删除全部数据及附件文件，且不可撤销。务必先备份。</p>' +
          '<button class="btn btn-danger" id="clrBtn">清空全部数据</button>'
      });
      body.appendChild(dc);
      u.$('#clrBtn', dc.bodyEl).onclick = () => u.confirm('确定清空全部数据？此操作不可恢复！', async () => {
        await db.clearAll();
        u.toast('已清空，回到首页', 'ok');
        JZ.go('dashboard');
      });
    }
  };
})(window.JZ);
