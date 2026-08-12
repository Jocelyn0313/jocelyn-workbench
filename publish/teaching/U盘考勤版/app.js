/* =========================================================
   app.js  U盘考勤版 UI + 文件读写
   主用 File System Access API（Chrome/Edge，file:// 亦可），
   不支持时回退为「选择文件打开 + 下载保存」
   ========================================================= */
(function () {
  'use strict';
  const USB = window.USB;
  const $ = id => document.getElementById(id);
  const FSA = ('showOpenFilePicker' in window);

  let data = USB.defaultData();
  let fileHandle = null;     // 当前工作数据文件的句柄（FSA）
  let curClass = '';
  let curDate = ymd(new Date());
  let dirty = false;
  let saveTimer = null;
  let pendingResolve = null; // 回退模式打开文件时的回调

  /* ---------- 工具 ---------- */
  function ymd(d) {
    const z = n => (n < 10 ? '0' + n : '' + n);
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function download(text, name) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }
  function toast(msg, kind) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast show ' + (kind || '');
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.className = 'toast'; }, 2600);
  }
  function setDirty(v) {
    dirty = v;
    $('dirty').style.display = v ? 'inline-block' : 'none';
  }
  function scheduleSave() {
    setDirty(true);
    if (FSA && fileHandle) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { writeFile(JSON.stringify(data, null, 2)).catch(e => toast('自动保存失败：' + e.message, 'err')); }, 600);
    }
  }

  /* ---------- 文件读写 ---------- */
  async function writeFile(text) {
    if (FSA) {
      if (!fileHandle) {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: '考勤数据.json',
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        });
      }
      if (fileHandle.queryPermission) {
        const p = await fileHandle.queryPermission({ mode: 'readwrite' });
        if (p !== 'granted') await fileHandle.requestPermission({ mode: 'readwrite' });
      }
      const w = await fileHandle.createWritable();
      await w.write(text);
      await w.close();
      setDirty(false);
      toast('已保存到U盘', 'ok');
    } else {
      download(text, '考勤数据.json');
      setDirty(false);
      toast('已下载文件，请存到U盘覆盖原文件', 'ok');
    }
  }
  async function writeFileAs(text, name) {
    if (FSA) {
      const h = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
      });
      const w = await h.createWritable();
      await w.write(text);
      await w.close();
      toast('已生成导入文件：' + name, 'ok');
    } else {
      download(text, name);
      toast('已下载导入文件', 'ok');
    }
  }
  async function readText() {
    if (FSA) {
      const [h] = await window.showOpenFilePicker({
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
      });
      fileHandle = h;
      const f = await h.getFile();
      return await f.text();
    }
    return await new Promise(res => { pendingResolve = res; $('fileInput').click(); });
  }

  /* ---------- 渲染 ---------- */
  function renderTerms() {
    const sel = $('termSel');
    const terms = data.settings.terms || [];
    sel.innerHTML = '';
    if (!terms.length) {
      sel.innerHTML = '<option value="">（无学期，请先初始化）</option>';
      return;
    }
    terms.forEach(t => {
      const o = document.createElement('option');
      o.value = t.id;
      o.textContent = (t.schoolYear || '') + ' ' + (t.termName || '');
      sel.appendChild(o);
    });
    if (!data.settings.currentTermId && terms[0]) data.settings.currentTermId = terms[0].id;
    sel.value = data.settings.currentTermId;
  }

  function renderClasses() {
    const sel = $('classSel');
    const list = USB.classesOf(data);
    sel.innerHTML = '';
    if (!list.length) {
      sel.innerHTML = '<option value="">（该学期暂无班级）</option>';
      curClass = '';
    } else {
      list.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id; o.textContent = c.name + (c.dept ? '（' + c.dept + '）' : '');
        sel.appendChild(o);
      });
      if (!list.some(c => c.id === curClass)) curClass = list[0].id;
      sel.value = curClass;
    }
    renderHead();
    renderTable();
  }

  function renderHead() {
    const c = (data.classes || []).find(x => x.id === curClass);
    $('clsName').textContent = c ? c.name : '未选择班级';
    $('scoreBase').value = USB.num(data.settings.scoreBase, 0);
  }

  function renderTable() {
    const tb = $('rosterBody');
    tb.innerHTML = '';
    const students = USB.studentsOf(data, curClass);
    if (!curClass) {
      tb.innerHTML = '<tr><td class="empty" colspan="6">请先选择班级</td></tr>';
      renderSummary(); return;
    }
    if (!students.length) {
      tb.innerHTML = '<tr><td class="empty" colspan="6">该班级暂无花名册，请从主工作台初始化</td></tr>';
      renderSummary(); return;
    }
    students.forEach(st => {
      const rec = USB.getRecord(data, curClass, curDate, st.id) || {};
      const bonus = USB.num((data.bonus[curClass] || {})[st.id], 0);
      const total = USB.studentScore(data, curClass, st.id);
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="c-no">' + esc(st.sno || '') + '</td>' +
        '<td class="c-name">' + esc(st.name || '') + '</td>' +
        '<td><select class="att" data-sid="' + st.id + '">' +
          USB.STATUSES.map(s => '<option value="' + s.v + '"' + (rec.a === s.v ? ' selected' : '') + '>' + s.label + '</option>').join('') +
        '</select></td>' +
        '<td><input class="sco" type="number" step="1" data-sid="' + st.id + '" value="' + (rec.s == null ? '' : rec.s) + '" placeholder="0"></td>' +
        '<td><input class="bn" type="number" step="1" data-sid="' + st.id + '" value="' + (bonus || '') + '" placeholder="0"></td>' +
        '<td class="c-total">' + total + '</td>';
      tb.appendChild(tr);
    });
    renderSummary();
  }

  function renderSummary() {
    const bar = $('sumBar');
    if (!curClass) { bar.innerHTML = ''; return; }
    const o = USB.daySummary(data, curClass, curDate);
    bar.innerHTML =
      '<span class="sm normal">到课 ' + o.normal + '</span>' +
      '<span class="sm late">迟到 ' + o.late + '</span>' +
      '<span class="sm early">早退 ' + o.early + '</span>' +
      '<span class="sm leave">请假 ' + o.leave + '</span>' +
      '<span class="sm absent">缺勤 ' + o.absent + '</span>' +
      '<span class="sm none">未记 ' + o.none + '</span>';
  }

  function renderAll() {
    renderTerms();
    renderClasses();
  }

  /* ---------- 事件 ---------- */
  function bind() {
    $('termSel').onchange = e => {
      data.settings.currentTermId = e.target.value;
      renderClasses();
      scheduleSave();
    };
    $('classSel').onchange = e => { curClass = e.target.value; renderTable(); };
    $('dateInput').value = curDate;
    $('dateInput').onchange = e => { curDate = e.target.value || curDate; renderTable(); };
    $('btnToday').onclick = () => { curDate = ymd(new Date()); $('dateInput').value = curDate; renderTable(); };

    $('btnOpen').onclick = async () => {
      try { const txt = await readText(); data = JSON.parse(txt); renderAll(); setDirty(false); toast('数据已打开', 'ok'); }
      catch (e) { if (e && e.name !== 'AbortError') toast('打开失败：' + e.message, 'err'); }
    };
    $('btnNew').onclick = () => {
      if (dirty && !confirm('当前有未保存改动，确定新建空数据？')) return;
      data = USB.defaultData(); fileHandle = null; curClass = '';
      renderAll(); setDirty(false); toast('已新建空数据，记得从主工作台初始化或填写学期', 'ok');
    };
    $('btnSeed').onclick = async () => {
      try {
        const txt = await readText();
        data = USB.seedFromMainBackup(JSON.parse(txt));
        fileHandle = null; // 种子来自主备份，需另存为新文件
        curClass = '';
        renderAll(); setDirty(true);
        toast('已从主工作台备份提取班级与花名册，请保存到U盘', 'ok');
      } catch (e) { if (e && e.name !== 'AbortError') toast('初始化失败：' + e.message, 'err'); }
    };
    $('btnSave').onclick = () => writeFile(JSON.stringify(data, null, 2)).catch(e => toast('保存失败：' + e.message, 'err'));
    $('btnExport').onclick = () => {
      const obj = USB.buildMainImport(data);
      writeFileAs(JSON.stringify(obj, null, 2), 'U盘考勤_导入主工作台.json');
    };
    $('scoreBase').onchange = e => {
      data.settings.scoreBase = USB.num(e.target.value, 0);
      renderTable();
      scheduleSave();
    };

    // 表格内联编辑（事件委托）
    $('rosterBody').addEventListener('change', e => {
      const sid = e.target.dataset.sid;
      if (!sid || !curClass) return;
      if (e.target.classList.contains('att')) {
        USB.setRecord(data, curClass, curDate, sid, { a: e.target.value });
        renderSummary();
      } else if (e.target.classList.contains('sco')) {
        const v = e.target.value === '' ? null : USB.num(e.target.value, 0);
        USB.setRecord(data, curClass, curDate, sid, { s: v });
        e.target.closest('tr').querySelector('.c-total').textContent = USB.studentScore(data, curClass, sid);
      } else if (e.target.classList.contains('bn')) {
        USB.setBonus(data, curClass, sid, e.target.value);
        e.target.closest('tr').querySelector('.c-total').textContent = USB.studentScore(data, curClass, sid);
      }
      scheduleSave();
    });

    // 回退模式：文件选择回调
    $('fileInput').onchange = e => {
      const f = e.target.files && e.target.files[0];
      if (!f) { if (pendingResolve) pendingResolve(''); return; }
      const r = new FileReader();
      r.onload = () => { const t = r.result; if (pendingResolve) { const res = pendingResolve; pendingResolve = null; res(t); } };
      r.onerror = () => { if (pendingResolve) { const res = pendingResolve; pendingResolve = null; res(''); } };
      r.readAsText(f);
    };

    $('helpToggle').onclick = () => {
      const h = $('help');
      h.style.display = (h.style.display === 'block') ? 'none' : 'block';
    };
  }

  /* ---------- 启动 ---------- */
  function boot() {
    bind();
    renderAll();
    setDirty(false);
    if (!FSA) {
      $('envNote').style.display = 'block';
      $('envNote').textContent = '当前浏览器不支持文件系统直写（仅Chrome/Edge支持）。已启用兼容模式：打开用文件选择、保存用下载，请手动把下载的文件覆盖回U盘。';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
