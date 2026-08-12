/* =========================================================
   core.js  U盘考勤版 核心数据层（无DOM依赖，可在node单测）
   仅承载考勤与平时分所需子集：settings/classes/roster/records/bonus
   与主工作台 store.js 字段形状保持一致，便于合并导入
   ========================================================= */
(function (root) {
  'use strict';

  // 考勤状态：a 字段取值与教学工作台 classroom.js 一致
  const STATUSES = [
    { v: 'normal', label: '到课' },
    { v: 'late',   label: '迟到' },
    { v: 'early',  label: '早退' },
    { v: 'leave',  label: '请假' },
    { v: 'absent', label: '缺勤' },
    { v: '',       label: '未记' }
  ];

  function num(v, d) {
    const n = Number(v);
    return isFinite(n) ? n : (d || 0);
  }

  function defaultData() {
    return {
      __app: 'usb-attendance',
      __ver: 1,
      __at: new Date().toISOString(),
      settings: {
        teacherName: '', schoolYear: '', termName: '', termStart: '',
        totalWeeks: 20, scoreBase: 0,
        terms: [], currentTermId: ''
      },
      classes: [],   // {id,name,dept,grade,size,note,color,termId}
      roster: {},    // classId -> [{id,sno,name,gender,note}]
      records: {},   // classId -> { date -> { studentId -> {a:'',s:null} } }
      bonus: {}      // classId -> { studentId -> number }
    };
  }

  function classesOf(data, termId) {
    const tid = termId || (data.settings && data.settings.currentTermId) || '';
    return (data.classes || []).filter(c => c.termId === tid);
  }

  function studentsOf(data, classId) {
    const r = data.roster && data.roster[classId];
    return r ? r : [];
  }

  function getRecord(data, cid, date, sid) {
    const c = data.records && data.records[cid];
    if (!c) return null;
    const d = c[date];
    if (!d) return null;
    return d[sid] || null;
  }

  function setRecord(data, cid, date, sid, patch) {
    data.records[cid] = data.records[cid] || {};
    data.records[cid][date] = data.records[cid][date] || {};
    data.records[cid][date][sid] = Object.assign(
      { a: '', s: null },
      data.records[cid][date][sid] || {},
      patch
    );
  }

  function setBonus(data, cid, sid, val) {
    data.bonus[cid] = data.bonus[cid] || {};
    data.bonus[cid][sid] = num(val, 0);
  }

  // 平时分 = 基础分(scoreBase) + Σ各次记录 s + 额外加减分(bonus)
  // 公式与主工作台 classroom.js 第91至98行保持一致
  function studentScore(data, cid, sid) {
    const base = num(data.settings && data.settings.scoreBase, 0);
    let rec = 0;
    const c = data.records && data.records[cid];
    if (c) {
      Object.keys(c).forEach(date => {
        const d = c[date];
        const r = d[sid];
        if (r && r.s != null) rec += num(r.s, 0);
      });
    }
    const bn = num((data.bonus && data.bonus[cid] || {})[sid], 0);
    return base + rec + bn;
  }

  // 某日某班的考勤计数
  function daySummary(data, cid, date) {
    const o = { normal: 0, late: 0, early: 0, leave: 0, absent: 0, none: 0 };
    const c = data.records && data.records[cid];
    const d = c && c[date];
    if (!d) return o;
    Object.keys(d).forEach(sid => {
      const a = d[sid] ? d[sid].a : '';
      if (a === 'normal') o.normal++;
      else if (a === 'late') o.late++;
      else if (a === 'early') o.early++;
      else if (a === 'leave') o.leave++;
      else if (a === 'absent') o.absent++;
      else o.none++;
    });
    return o;
  }

  // 从主工作台全量备份 JSON 提取考勤所需子集（作为初始种子）
  // 入参可能是 {data:{...}} 或直接是 data 对象
  function seedFromMainBackup(mainObj) {
    const d = defaultData();
    const src = (mainObj && mainObj.data) ? mainObj.data : (mainObj || {});
    const s = src.settings || {};
    d.settings.teacherName = s.teacherName || '';
    d.settings.schoolYear = s.schoolYear || '';
    d.settings.termName = s.termName || '';
    d.settings.termStart = s.termStart || '';
    d.settings.totalWeeks = s.totalWeeks || 20;
    d.settings.scoreBase = s.scoreBase || 0;
    d.settings.terms = Array.isArray(s.terms) ? clone(s.terms) : [];
    d.settings.currentTermId = s.currentTermId || ((d.settings.terms[0] || {}).id || '');
    d.classes = Array.isArray(src.classes) ? clone(src.classes) : [];
    d.roster = src.roster ? clone(src.roster) : {};
    d.__at = new Date().toISOString();
    return d;
  }

  // 生成可导入主工作台的 JSON（合并模式），字段形状与主工作台 importAll 兼容
  function buildMainImport(data) {
    return {
      __app: 'teaching-workbench',
      __ver: 1,
      __at: new Date().toISOString(),
      __src: 'usb-attendance',
      data: {
        classes: clone(data.classes || []),
        roster: clone(data.roster || {}),
        records: clone(data.records || {}),
        bonus: clone(data.bonus || {})
      }
    };
  }

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  const API = {
    STATUSES, num, defaultData, classesOf, studentsOf,
    getRecord, setRecord, setBonus, studentScore, daySummary,
    seedFromMainBackup, buildMainImport
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.USB = API;
})(typeof window !== 'undefined' ? window : globalThis);
