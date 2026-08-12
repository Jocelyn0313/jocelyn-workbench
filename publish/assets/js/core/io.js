/* =========================================================
   io.js  导入导出：Excel / Word / PDF / 备份
   ========================================================= */
(function (JZ) {
  'use strict';
  const u = JZ.u;

  /* ================= Excel ================= */
  async function readWorkbook(file) {
    const buf = await u.readAsArrayBuffer(file);
    return XLSX.read(buf, { type: 'array', cellDates: true });
  }
  /** 读取首个（或指定）工作表为对象数组 */
  async function readSheet(file, sheetName) {
    const wb = await readWorkbook(file);
    const name = sheetName || wb.SheetNames[0];
    const ws = wb.Sheets[name];
    if (!ws) throw new Error('未找到工作表：' + name);
    return XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  }
  /** 读取为二维数组 */
  async function readMatrix(file, sheetName) {
    const wb = await readWorkbook(file);
    const name = sheetName || wb.SheetNames[0];
    return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false });
  }

  function autoWidth(rows) {
    if (!rows.length) return [];
    const keys = Object.keys(rows[0]);
    return keys.map(k => {
      let w = String(k).replace(/[^\x00-\xff]/g, 'xx').length;
      rows.forEach(r => { const l = String(r[k] === null || r[k] === undefined ? '' : r[k]).replace(/[^\x00-\xff]/g, 'xx').length; if (l > w) w = l; });
      return { wch: Math.min(46, Math.max(7, w + 2)) };
    });
  }

  /** 导出单表 */
  function exportRows(rows, filename, sheetName) {
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = autoWidth(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (sheetName || 'Sheet1').slice(0, 30));
    XLSX.writeFile(wb, filename || ('导出数据_' + u.ymd(new Date()) + '.xlsx'));
  }
  /** 导出多表 [{name, rows}] 或 [{name, aoa}] */
  function exportBook(sheets, filename) {
    const wb = XLSX.utils.book_new();
    sheets.forEach((s, i) => {
      const ws = s.aoa ? XLSX.utils.aoa_to_sheet(s.aoa) : XLSX.utils.json_to_sheet(s.rows || []);
      if (s.rows) ws['!cols'] = autoWidth(s.rows);
      if (s.cols) ws['!cols'] = s.cols;
      XLSX.utils.book_append_sheet(wb, ws, (s.name || ('Sheet' + (i + 1))).replace(/[\\\/\?\*\[\]:]/g, '').slice(0, 30) || ('Sheet' + (i + 1)));
    });
    XLSX.writeFile(wb, filename || ('导出工作簿_' + u.ymd(new Date()) + '.xlsx'));
  }
  /** 下载模板 */
  function exportTemplate(headers, sample, filename, sheetName) {
    const aoa = [headers].concat(sample || []);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(10, String(h).replace(/[^\x00-\xff]/g, 'xx').length + 4) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName || '模板');
    XLSX.writeFile(wb, filename);
  }

  /** 智能取列：支持多个候选表头 */
  function pick(row, names) {
    const keys = Object.keys(row);
    for (const n of names) {
      const k = keys.find(x => String(x).replace(/\s/g, '') === n);
      if (k !== undefined && row[k] !== '') return row[k];
    }
    for (const n of names) {
      const k = keys.find(x => String(x).replace(/\s/g, '').indexOf(n) >= 0);
      if (k !== undefined && row[k] !== '') return row[k];
    }
    return '';
  }

  /* ================= Word（.doc，Word/WPS 可直接打开） ================= */
  function exportWord(title, bodyHtml, filename) {
    const html =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head><meta charset="utf-8"><title>' + u.esc(title) + '</title>' +
      '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->' +
      '<style>' +
      '@page{size:A4;margin:2.2cm 2cm}' +
      'body{font-family:"宋体",SimSun,serif;font-size:11pt;line-height:1.75;color:#000}' +
      'h1{font-family:"黑体",SimHei;font-size:18pt;text-align:center;margin:0 0 6pt}' +
      'h2{font-family:"黑体",SimHei;font-size:13pt;margin:16pt 0 6pt;border-bottom:1pt solid #999;padding-bottom:3pt}' +
      'h3{font-size:12pt;margin:10pt 0 4pt}' +
      '.sub{text-align:center;color:#555;font-size:10pt;margin-bottom:14pt}' +
      'table{border-collapse:collapse;width:100%;margin:6pt 0;font-size:10pt}' +
      'th,td{border:1pt solid #888;padding:4pt 6pt;text-align:left;vertical-align:top}' +
      'th{background:#eef3fb;font-weight:bold}' +
      '.meta{color:#555;font-size:9.5pt}' +
      'ul{margin:4pt 0 4pt 18pt}' +
      '</style></head><body>' + bodyHtml + '</body></html>';
    const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
    u.download(blob, filename.replace(/\.docx?$/i, '') + '.doc');
  }

  /* ================= PDF（浏览器打印导出） ================= */
  function exportPDF(title, bodyHtml) {
    const w = window.open('', '_blank');
    if (!w) { u.toast('浏览器拦截了新窗口，请允许弹出窗口', 'warn', 4000); return; }
    w.document.write(
      '<html><head><meta charset="utf-8"><title>' + u.esc(title) + '</title><style>' +
      '@page{size:A4;margin:14mm}' +
      'body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;color:#1e293b;font-size:12px;line-height:1.7;padding:0}' +
      'h1{font-size:19px;text-align:center;margin:0 0 4px}' +
      '.sub{text-align:center;color:#64748b;font-size:11px;margin-bottom:16px}' +
      'h2{font-size:14px;margin:16px 0 6px;padding-left:8px;border-left:3px solid #60a5fa}' +
      'table{border-collapse:collapse;width:100%;font-size:11px;margin:6px 0}' +
      'th,td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left}' +
      'th{background:#eff6ff}' +
      'tr{page-break-inside:avoid}' +
      '.card{border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:8px;page-break-inside:avoid}' +
      '.muted{color:#64748b}' +
      '</style></head><body>' + bodyHtml +
      '<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.print()},350)}</scr' + 'ipt></body></html>');
    w.document.close();
  }

  /* ================= 备份 / 恢复 ================= */
  function getTW() { return window.TW || {}; }
  // 科研中与课题绑定的子表（按 projectId 过滤）
  const RS_SCOPED = ['lits', 'venues', 'progress', 'exps', 'writings', 'rsTasks', 'radar', 'subs', 'reviews'];
  // 各 JZ 大类 -> 包含的数据键
  const GROUPS = {
    settings: { keys: ['settings'], type: 'whole' },
    dept: { keys: ['deptTodos', 'deptPages', 'deptReports', 'deptVideos', 'links'], type: 'keys' },
    comp: { keys: ['comps', 'compYears', 'compItems', 'compWorks'], type: 'comp' },
    research: { keys: ['projects', 'lits', 'venues', 'progress', 'exps', 'writings', 'rsTasks', 'rsDiary', 'radar', 'libItems', 'subs', 'outputs', 'reviews'], type: 'project' },
    other: { keys: ['otherMemos', 'otherResults'], type: 'keys' },
    files: { keys: ['files'], type: 'whole' }
  };
  const JZ_TOTAL = Object.keys(GROUPS).reduce((n, g) => n + GROUPS[g].keys.length, 0); // 26

  function blobToB64(b) {
    return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
  }
  function pickKeys(obj, idSet) {
    const o = {}; Object.keys(obj).forEach(k => { if (idSet.has(k)) o[k] = obj[k]; }); return o;
  }
  function filterLessonsByClass(lessons, classIds) {
    const schedClass = {}; const twS = getTW().S; (twS ? twS.schedule : []).forEach(s => { if (classIds.has(s.classId)) schedClass[s.id] = true; });
    const o = {}; Object.keys(lessons).forEach(k => {
      const sid = k.split('__')[1]; if (schedClass[sid]) o[k] = lessons[k];
    }); return o;
  }

  /* 教学工作台按学期 / 按学期+班级 筛选 */
  function buildTeaching(t) {
    const S = getTW().S; if (!S) return null;
    const data = {}; const subset = [];
    if (t.mode === 'whole') {
      Object.keys(S).forEach(k => data[k] = S[k]);
      return { __subset: [], data: data };
    }
    if (t.mode === 'term') {
      const termIds = t.terms || new Set();
      const classIds = new Set(); S.classes.forEach(c => { if (termIds.has(c.termId)) classIds.add(c.id); });
      data.classes = S.classes.filter(c => termIds.has(c.termId));
      data.schedule = S.schedule.filter(s => termIds.has(s.termId));
      data.exams = S.exams.filter(e => termIds.has(e.termId) || classIds.has(e.classId));
      data.adjustments = S.adjustments.filter(a => termIds.has(a.termId));
      data.todos = S.todos.filter(x => termIds.has(x.termId) || classIds.has(x.classId));
      data.reflections = S.reflections.filter(r => classIds.has(r.classId));
      data.roster = pickKeys(S.roster, classIds);
      data.records = pickKeys(S.records, classIds);
      data.bonus = pickKeys(S.bonus, classIds);
      data.lessons = filterLessonsByClass(S.lessons, classIds);
      data.periods = S.periods;
      data.settings = S.settings;
      ['classes', 'schedule', 'exams', 'adjustments', 'todos', 'reflections', 'roster', 'records', 'bonus', 'lessons'].forEach(k => subset.push(k));
      return { __subset: subset, data: data };
    }
    if (t.mode === 'termClass') {
      const pairs = t.pairs || new Set();
      const classIds = new Set(); Array.from(pairs).forEach(p => { const [tid, cid] = p.split('|'); classIds.add(cid); });
      data.classes = S.classes.filter(c => Array.from(pairs).some(p => { const [tid, cid] = p.split('|'); return cid === c.id && tid === c.termId; }));
      data.schedule = S.schedule.filter(s => classIds.has(s.classId));
      data.exams = S.exams.filter(e => classIds.has(e.classId));
      data.reflections = S.reflections.filter(r => classIds.has(r.classId));
      data.roster = pickKeys(S.roster, classIds);
      data.records = pickKeys(S.records, classIds);   // 考勤 + 平时分
      data.bonus = pickKeys(S.bonus, classIds);       // 平时分加分项
      data.lessons = filterLessonsByClass(S.lessons, classIds);
      data.periods = S.periods;
      data.settings = S.settings;
      ['classes', 'schedule', 'exams', 'reflections', 'roster', 'records', 'bonus', 'lessons'].forEach(k => subset.push(k));
      return { __subset: subset, data: data };
    }
    return null;
  }

  async function buildBackup(sel) {
    sel = sel || {};
    const data = {}; const subset = [];
    for (const g of Object.keys(GROUPS)) {
      const spec = sel[g];
      if (!spec) continue;
      if (spec === 'whole') {
        GROUPS[g].keys.forEach(k => data[k] = JZ.S[k]);
      } else if (GROUPS[g].type === 'keys') {
        (spec.keys || new Set()).forEach(k => { data[k] = JZ.S[k]; });
      } else if (GROUPS[g].type === 'comp') {
        const ids = spec.ids || new Set();
        GROUPS[g].keys.forEach(k => {
          if (k === 'comps') data[k] = JZ.S[k].filter(r => ids.has(r.id));
          else data[k] = JZ.S[k].filter(r => ids.has(r.compId));
          subset.push(k);
        });
      } else if (GROUPS[g].type === 'project') {
        const ids = spec.ids || new Set();
        GROUPS[g].keys.forEach(k => {
          if (k === 'projects') data[k] = JZ.S[k].filter(r => ids.has(r.id));
          else if (RS_SCOPED.indexOf(k) >= 0) data[k] = JZ.S[k].filter(r => ids.has(r.projectId));
          else data[k] = []; // rsDiary/libItems/outputs 不与具体课题绑定，按课题导出时不含
          subset.push(k);
        });
      }
    }
    let blobs = null;
    if (sel.files === 'whole') {
      blobs = {};
      const ids = await JZ.db.allBlobIds();
      for (const id of ids) { const b = await JZ.db.getBlob(id); if (b) blobs[id] = await blobToB64(b); }
    }
    let teaching = null;
    if (sel.teaching) teaching = buildTeaching(sel.teaching);
    const includedJz = Object.keys(data).length;
    const teachingWhole = sel.teaching && sel.teaching.mode === 'whole';
    const partial = includedJz < JZ_TOTAL || (sel.teaching && !teachingWhole);
    return { __app: 'jocelyn-workbench', __ver: 2, __at: new Date().toISOString(), partial: partial, __subset: subset, data: data, blobs: blobs, teaching: teaching };
  }

  // sel: 来自备份页的勾选规格；见 backup.js
  async function backup(sel) {
    const anySel = sel && (Object.keys(GROUPS).some(g => sel[g]) || sel.teaching);
    if (!anySel) { u.toast('请至少勾选一项再导出', 'warn'); return; }
    const teaching = !!(sel && sel.teaching);
    u.toast('正在打包备份' + (sel.files === 'whole' ? '（含资源文件，可能较慢）' : '') + '…', 'ok', 3000);
    const pack = await buildBackup(sel);
    const blob = new Blob([JSON.stringify(pack)], { type: 'application/json' });
    const tag = (pack.partial ? '部分' : '全量') + (teaching ? '_含教学' : '') + (sel.files === 'whole' ? '_含资源' : '');
    u.download(blob, '工作台备份_' + tag + '_' + u.ymd(new Date()) + '.json');
    u.toast('备份文件已下载（' + (pack.partial ? '部分导出' : '全量') + '）', 'ok');
  }
  async function restore(file, mode) {
    const txt = await u.readAsText(file);
    const obj = JSON.parse(txt);
    await JZ.db.importAll(obj, mode || 'replace');
    if (obj.teaching && window.TW && window.TW.db) await window.TW.db.importAll(obj.teaching, mode || 'replace');
    u.toast('数据已恢复', 'ok');
  }

  JZ.io = {
    readWorkbook, readSheet, readMatrix, exportRows, exportBook, exportTemplate, pick,
    exportWord, exportPDF, backup, restore
  };
})(window.JZ);
