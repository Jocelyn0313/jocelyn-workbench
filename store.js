/* =========================================================
   store.js  数据层：IndexedDB(文件+数据) + localStorage 兜底
   全局唯一数据源 TW.S，一处录入全板块共享
   统一存储：与「Jocelyn Z.个人工作台」共用同一个 IndexedDB 库
   (jocelyn-workbench)，kv 与 files 键均加 tw: 前缀避免与 JZ 数据冲突，
   localStorage 仍用 tw: 前缀（本就与 JZ 的 jz: 互不重叠）
   ========================================================= */
(function (TW) {
  'use strict';
  const u = TW.u;

  // 与 JZ 同一物理库，实现「一套 IndexedDB 封装，两模块共库」
  const DB_NAME = 'jocelyn-workbench';
  const DB_VER = 1;
  const ST_KV = 'kv';        // 结构化数据分片
  const ST_FILE = 'files';   // 教学资源二进制
  const LS_PREFIX = 'tw:';
  const KV_P = 'tw:';        // kv 分片键前缀，隔离 JZ 数据

  /* ---------- 默认数据 ---------- */
  function defaultState() {
    const y = new Date().getFullYear();
    const m = new Date().getMonth() + 1;
    const isAutumn = m >= 8 || m < 2;
    const startY = isAutumn ? y : y - 1;
    return {
      settings: {
        teacherName: '',
        schoolYear: startY + '-' + (startY + 1),
        termName: isAutumn ? '第一学期' : '第二学期',
        termStart: isAutumn ? startY + '-09-01' : (startY + 1) + '-02-24', // 第1教学周 周一
        totalWeeks: 20,
        scoreBase: 0,          // 平时成绩基础分
        theme: 'light',
        terms: [],             // 学期列表 [{id,schoolYear,termName,termStart,totalWeeks,scoreBase}]
        currentTermId: ''      // 当前学期 id
      },
      /* 节次时间表 */
      periods: [
        { id: 'p1', name: '第1-2节', start: '08:00', end: '09:35' },
        { id: 'p2', name: '第3-4节', start: '09:55', end: '11:30' },
        { id: 'p3', name: '第5-6节', start: '14:00', end: '15:35' },
        { id: 'p4', name: '第7-8节', start: '15:55', end: '17:30' },
        { id: 'p5', name: '第9-10节', start: '19:00', end: '20:35' }
      ],
      classes: [],        // {id,name,dept,grade,size,note,color}
      schedule: [],       // {id,dow,periodId,classId,course,room,weeks:[1,2..],weekType:'all|odd|even'}
      lessons: {},        // `${date}__${scheduleId}` -> {pre,content,post,status,note,homework}
      adjustments: [],    // {id,type,fromDate,scheduleId,toDate,toPeriodId,reason,createdAt,applied}
      todos: [],          // {id,title,detail,due,priority,done,classId,tag,createdAt,doneAt}
      reflections: [],    // {id,date,classId,term,type,title,content,tags,measure}
      roster: {},         // classId -> [{id,sno,name,gender,note}]
      records: {},        // classId -> { date -> { studentId -> {a:'',s:null} } }
      bonus: {},          // classId -> { studentId -> number }
      exams: [],          // {id,classId,name,date,full,type,scores:{studentId:number}}
      resources: []       // {id,cat,sub,title,fileId,ext,size,tags,note,link,createdAt}
    };
  }

  const KEYS = Object.keys(defaultState());

  /* ---------- IndexedDB ---------- */
  let idb = null, idbOK = false;

  function openDB() {
    return new Promise(resolve => {
      if (!window.indexedDB) return resolve(null);
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VER); } catch (e) { return resolve(null); }
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(ST_KV)) db.createObjectStore(ST_KV);
        if (!db.objectStoreNames.contains(ST_FILE)) db.createObjectStore(ST_FILE);
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
      setTimeout(() => resolve(req.result || null), 2500);
    });
  }

  function idbPut(store, key, val) {
    return new Promise((res, rej) => {
      if (!idb) return rej('no-idb');
      try {
        const tx = idb.transaction(store, 'readwrite');
        tx.objectStore(store).put(val, key);
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
      } catch (e) { rej(e); }
    });
  }
  function idbGet(store, key) {
    return new Promise((res, rej) => {
      if (!idb) return rej('no-idb');
      try {
        const tx = idb.transaction(store, 'readonly');
        const r = tx.objectStore(store).get(key);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
  }
  function idbDel(store, key) {
    return new Promise(res => {
      if (!idb) return res(false);
      try {
        const tx = idb.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => res(true);
        tx.onerror = () => res(false);
      } catch (e) { res(false); }
    });
  }
  function idbKeys(store) {
    return new Promise(res => {
      if (!idb) return res([]);
      try {
        const tx = idb.transaction(store, 'readonly');
        const r = tx.objectStore(store).getAllKeys();
        r.onsuccess = () => res(r.result || []);
        r.onerror = () => res([]);
      } catch (e) { res([]); }
    });
  }

  /* ---------- 状态 ---------- */
  const S = defaultState();
  TW.S = S;

  const dirty = new Set();
  const flush = u.debounce(async () => {
    const list = Array.from(dirty); dirty.clear();
    for (const k of list) {
      const val = S[k];
      try {
        if (idbOK) await idbPut(ST_KV, KV_P + k, val);
        else localStorage.setItem(LS_PREFIX + k, JSON.stringify(val));
      } catch (e) {
        try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(val)); }
        catch (e2) { u.toast('数据保存失败，可能超出浏览器容量', 'err', 4000); }
      }
    }
    updateQuota();
  }, 380);

  function save(key) {
    if (key) dirty.add(key); else KEYS.forEach(k => dirty.add(k));
    flush();
  }

  async function load() {
    idb = await openDB();
    idbOK = !!idb;
    for (const k of KEYS) {
      let v = null;
      if (idbOK) { try { v = await idbGet(ST_KV, KV_P + k); } catch (e) { v = null; } }
      if (v === undefined || v === null) {
        try { const raw = localStorage.getItem(LS_PREFIX + k); if (raw) v = JSON.parse(raw); } catch (e) { }
      }
      if (v !== undefined && v !== null) {
        if (Array.isArray(S[k])) S[k] = Array.isArray(v) ? v : S[k];
        else if (typeof S[k] === 'object') S[k] = Object.assign({}, S[k], v);
        else S[k] = v;
      }
    }
    migrateTerms();
    return { idb: idbOK };
  }

  /* ---------- 学期数据迁移（旧版单学期 -> 多学期） ---------- */
  function migrateTerms() {
    const s = S.settings;
    if (!s.terms || !s.terms.length) {
      s.terms = [{
        id: uidT(), schoolYear: s.schoolYear || '', termName: s.termName || '第一学期',
        termStart: s.termStart || u.ymd(u.today()), totalWeeks: s.totalWeeks || 20, scoreBase: s.scoreBase || 0
      }];
    }
    if (!s.currentTermId) s.currentTermId = (s.terms[0] || {}).id || '';
    const tid = s.currentTermId;
    ['classes', 'schedule', 'exams', 'adjustments', 'todos'].forEach(k => {
      (S[k] || []).forEach(x => { if (!x.termId) x.termId = tid; });
    });
    mirrorTerm();
  }
  function uidT() { return u.uid('t'); }
  function curTermObj() {
    const list = S.settings.terms || [];
    if (!list.length) return null;
    let t = list.find(x => x.id === S.settings.currentTermId);
    if (!t) { t = list[0]; S.settings.currentTermId = t.id; }
    return t;
  }
  function mirrorTerm() {
    const t = curTermObj();
    if (!t) return;
    S.settings.schoolYear = t.schoolYear;
    S.settings.termName = t.termName;
    S.settings.termStart = t.termStart;
    S.settings.totalWeeks = t.totalWeeks;
    S.settings.scoreBase = t.scoreBase;
  }

  /* ---------- 文件（教学资源） ---------- */
  // ST_FILE 键加 tw: 前缀，避免与 JZ 的文件键冲突
  async function putFile(id, blob) {
    if (idbOK) { await idbPut(ST_FILE, KV_P + id, blob); return 'idb'; }
    // 无 IDB 时用 base64 存 localStorage（限小文件）
    if (blob.size > 1.5 * 1024 * 1024) throw new Error('当前浏览器环境仅支持 1.5MB 以内的文件存储');
    const b64 = await new Promise((res, rej) => {
      const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob);
    });
    localStorage.setItem(LS_PREFIX + 'file:' + id, b64);
    return 'ls';
  }
  async function getFile(id) {
    if (idbOK) { const b = await idbGet(ST_FILE, KV_P + id); if (b) return b; }
    const b64 = localStorage.getItem(LS_PREFIX + 'file:' + id);
    if (!b64) return null;
    const res = await fetch(b64); return await res.blob();
  }
  async function delFile(id) {
    if (idbOK) await idbDel(ST_FILE, KV_P + id);
    localStorage.removeItem(LS_PREFIX + 'file:' + id);
  }
  async function allFileIds() {
    const ids = [];
    if (idbOK) {
      const raw = await idbKeys(ST_FILE);
      raw.forEach(k => { ids.push(k.indexOf(KV_P) === 0 ? k.slice(KV_P.length) : k); });
    }
    Object.keys(localStorage).forEach(k => { if (k.indexOf(LS_PREFIX + 'file:') === 0) ids.push(k.slice((LS_PREFIX + 'file:').length)); });
    return ids;
  }

  /* ---------- 容量 ---------- */
  async function updateQuota() {
    const bar = u.$('#stoBar'), txt = u.$('#stoTxt');
    if (!bar) return;
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        const pct = Math.min(100, (e.usage / (e.quota || 1)) * 100);
        bar.style.width = Math.max(1.5, pct) + '%';
        txt.textContent = '本地已用 ' + u.fmtSize(e.usage) + (idbOK ? ' · IndexedDB' : ' · localStorage');
        return;
      }
    } catch (e) { }
    let n = 0; Object.keys(localStorage).forEach(k => { if (k.indexOf(LS_PREFIX) === 0) n += localStorage[k].length; });
    bar.style.width = Math.min(100, n / 50000) + '%';
    txt.textContent = '本地已用 ' + u.fmtSize(n * 2);
  }

  /* ---------- 事件总线 ---------- */
  const bus = {};
  function on(evt, fn) { (bus[evt] = bus[evt] || []).push(fn); }
  function emit(evt, data) { (bus[evt] || []).forEach(f => { try { f(data); } catch (e) { console.error(e); } }); }

  /* ---------- 业务查询辅助 ---------- */
  function cls(id) { return S.classes.find(c => c.id === id) || null; }
  function clsName(id) { const c = cls(id); return c ? c.name : '未分配班级'; }
  function period(id) { return S.periods.find(p => p.id === id) || null; }
  function students(classId) { return S.roster[classId] || []; }

  function lessonKey(date, schedId) { return date + '__' + schedId; }
  function getLesson(date, schedId) {
    return S.lessons[lessonKey(date, schedId)] || null;
  }
  function setLesson(date, schedId, patch) {
    const k = lessonKey(date, schedId);
    S.lessons[k] = Object.assign({ date: date, scheduleId: schedId, pre: '', content: '', post: '', status: '', note: '', homework: '' }, S.lessons[k] || {}, patch);
    save('lessons');
    return S.lessons[k];
  }

  /** 生成唯一颜色索引 */
  function colorOf(id) {
    let h = 0; const s = String(id);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
    return h % 5;
  }

  /* ---------- 导出/恢复 ---------- */
  async function exportAll(withFiles) {
    const data = { __app: 'teaching-workbench', __ver: 1, __at: new Date().toISOString(), data: {} };
    KEYS.forEach(k => data.data[k] = S[k]);
    if (withFiles) {
      data.files = {};
      const ids = await allFileIds();
      for (const id of ids) {
        const blob = await getFile(id);
        if (!blob) continue;
        data.files[id] = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
      }
    }
    return data;
  }

  async function importAll(obj, mode) {
    if (!obj || !obj.data) throw new Error('备份文件格式不正确');
    const subset = obj.__subset || [];
    KEYS.forEach(k => {
      if (obj.data[k] === undefined) return;
      const isSub = subset.includes(k);
      if (isSub && Array.isArray(S[k]) && Array.isArray(obj.data[k])) {
        const ids = new Set(S[k].map(x => x.id));
        obj.data[k].forEach(x => { if (!ids.has(x.id)) S[k].push(x); });
      } else if (mode === 'merge' && Array.isArray(S[k]) && Array.isArray(obj.data[k])) {
        const ids = new Set(S[k].map(x => x.id));
        obj.data[k].forEach(x => { if (!ids.has(x.id)) S[k].push(x); });
      } else if ((isSub || mode === 'merge') && typeof S[k] === 'object' && !Array.isArray(S[k])) {
        S[k] = Object.assign({}, S[k], obj.data[k]);
      } else {
        S[k] = obj.data[k];
      }
    });
    if (obj.files) {
      for (const id of Object.keys(obj.files)) {
        try { const b = await (await fetch(obj.files[id])).blob(); await putFile(id, b); } catch (e) { }
      }
    }
    save();
    emit('data:reload');
  }

  async function clearAll() {
    KEYS.forEach(k => { const d = defaultState(); S[k] = d[k]; });
    const ids = await allFileIds();
    for (const id of ids) await delFile(id);
    save();
    emit('data:reload');
  }

  /* ---------- 学期管理 ---------- */
  const term = {
    list() { return S.settings.terms || []; },
    current() { return curTermObj(); },
    currentId() { const t = curTermObj(); return t ? t.id : ''; },
    label() { const t = curTermObj(); return t ? (t.schoolYear + ' ' + t.termName) : '未设学期'; },
    setCurrent(id) {
      const t = (S.settings.terms || []).find(x => x.id === id);
      if (!t) return;
      S.settings.currentTermId = id;
      mirrorTerm(); save('settings');
      emit('term:change'); emit('settings:change');
    },
    add(cfg) {
      const t = Object.assign({ id: uidT(), schoolYear: '', termName: '第一学期', termStart: u.ymd(u.today()), totalWeeks: 20, scoreBase: 0 }, cfg);
      S.settings.terms = (S.settings.terms || []).concat(t);
      if (!S.settings.currentTermId) S.settings.currentTermId = t.id;
      mirrorTerm(); save('settings');
      emit('term:change'); emit('settings:change');
      return t;
    },
    update(id, patch) {
      const t = (S.settings.terms || []).find(x => x.id === id);
      if (!t) return;
      Object.assign(t, patch);
      if (id === S.settings.currentTermId) mirrorTerm();
      save('settings');
      emit('term:change'); emit('settings:change');
    },
    remove(id) {
      const list = S.settings.terms || [];
      if (list.length <= 1) throw new Error('至少保留一个学期');
      const tid = (S.settings.currentTermId === id) ? (list.find(x => x.id !== id) || {}).id : S.settings.currentTermId;
      S.settings.terms = list.filter(x => x.id !== id);
      S.settings.currentTermId = tid;
      ['classes', 'schedule', 'exams', 'adjustments', 'todos'].forEach(k => {
        S[k] = (S[k] || []).filter(x => x.termId !== id);
      });
      [S.roster, S.records, S.bonus].forEach(store => {
        Object.keys(store).forEach(k => { if (!db.cls(k)) delete store[k]; });
      });
      mirrorTerm(); save();
      emit('term:change'); emit('settings:change'); emit('data:reload');
    },
    classesOf(id) { const tid = id || this.currentId(); return (S.classes || []).filter(c => c.termId === tid); },
    scheduleItems(id) { const tid = id || this.currentId(); return (S.schedule || []).filter(c => c.termId === tid); },
    adjustItems(id) { const tid = id || this.currentId(); return (S.adjustments || []).filter(c => c.termId === tid); },
    examsOf(id) { const tid = id || this.currentId(); return (S.exams || []).filter(c => c.termId === tid); },
    todosOf(id) { const tid = id || this.currentId(); return (S.todos || []).filter(c => c.termId === tid); },
    copyFrom(srcId, dstId) {
      const map = {};
      term.classesOf(srcId).forEach(c => {
        const nc = Object.assign({}, c, { id: u.uid('c'), termId: dstId });
        S.classes.push(nc); map[c.id] = nc.id;
      });
      term.scheduleItems(srcId).forEach(s => {
        S.schedule.push(Object.assign({}, s, { id: u.uid('s'), termId: dstId, classId: map[s.classId] || s.classId }));
      });
      term.classesOf(srcId).forEach(c => {
        const nid = map[c.id];
        if (S.roster[c.id]) S.roster[nid] = JSON.parse(JSON.stringify(S.roster[c.id]));
        if (S.records[c.id]) S.records[nid] = JSON.parse(JSON.stringify(S.records[c.id]));
        if (S.bonus[c.id]) S.bonus[nid] = JSON.parse(JSON.stringify(S.bonus[c.id]));
      });
      save();
    }
  };
  TW.term = term;

  TW.db = {
    load: load, save: save, KEYS: KEYS, defaultState: defaultState,
    putFile: putFile, getFile: getFile, delFile: delFile, allFileIds: allFileIds,
    on: on, emit: emit, updateQuota: updateQuota,
    cls: cls, clsName: clsName, period: period, students: students,
    getLesson: getLesson, setLesson: setLesson, lessonKey: lessonKey, colorOf: colorOf,
    exportAll: exportAll, importAll: importAll, clearAll: clearAll,
    get idbOK() { return idbOK; }
  };
})(window.TW);
