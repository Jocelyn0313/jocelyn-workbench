/* =========================================================
   io.js  导入导出：Excel / Word / PDF / 备份
   ========================================================= */
(function (TW) {
  'use strict';
  const u = TW.u;

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
  async function backup(withFiles) {
    u.toast('正在打包备份' + (withFiles ? '（含资源文件，可能较慢）' : '') + '…', 'ok', 3000);
    const data = await TW.db.exportAll(withFiles);
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const s = TW.S.settings;
    u.download(blob, '教学工作台备份_' + (s.schoolYear || '') + (s.termName || '') + '_' + u.ymd(new Date()) + (withFiles ? '_含资源' : '') + '.json');
    u.toast('备份文件已下载', 'ok');
  }
  async function restore(file, mode) {
    const txt = await u.readAsText(file);
    const obj = JSON.parse(txt);
    await TW.db.importAll(obj, mode || 'replace');
    u.toast('数据已恢复', 'ok');
  }

  TW.io = {
    readWorkbook, readSheet, readMatrix, exportRows, exportBook, exportTemplate, pick,
    exportWord, exportPDF, backup, restore
  };
})(window.TW);
