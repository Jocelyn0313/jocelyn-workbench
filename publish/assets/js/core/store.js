/* =========================================================
   store.js  数据层：IndexedDB（结构化数据 + 文件二进制）+ localStorage 兜底
   全局唯一数据源 JZ.S，一处录入、全板块共享
   ========================================================= */
(function (JZ) {
  'use strict';
  const u = JZ.u;

  const DB_NAME = 'jocelyn-workbench';
  const DB_VER = 1;
  const ST_KV = 'kv';
  const ST_FILE = 'files';
  const LS_PREFIX = 'jz:';
  const CAL_KEY = 'jz:sharedCalendar';   // 与教学工作台共享的校历

  /* ---------- 默认数据 ---------- */
  function defaultState() {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1;
    const isAutumn = m >= 8 || m < 2;
    const sy = isAutumn ? y : y - 1;
    return {
      settings: {
        ownerName: 'Jocelyn Z.',
        title: '英语教师',
        dept: '',
        school: '',
        schoolYear: sy + '-' + (sy + 1),
        termName: isAutumn ? '第一学期' : '第二学期',
        termStart: isAutumn ? sy + '-09-01' : (sy + 1) + '-02-24',
        totalWeeks: 20,
        researchDirs: ['大学英语教学', '教育技术与AI', '二语习得'],
        litTarget: 3,
        hourTarget: 2,
        calAt: 0
      },
      files: [],          // {id,fileId,name,ext,size,cat,refId,tag,note,createdAt}
      links: [],          // {id,cat,refId,name,url,note,tag,createdAt}
      deptTodos: [],      // {id,title,detail,due,priority,done,tag,createdAt,doneAt}
      deptPages: [],      // {id,title,column,date,status,url,note}
      deptReports: [],    // {id,title,kind,status,owner,due,content,tags,createdAt,updatedAt}
      deptVideos: [],     // {id,zone,title,type,duration,desc,tags,link,createdAt}
      comps: [],          // {id,side,name,org,level,note,createdAt}
      compYears: [],      // {id,compId,year,status,startDate,endDate,note}
      compItems: [],      // {id,compId,year,cat,title,content,date,link,createdAt}
      compWorks: [],      // {id,compId,year,name,members,status,award,summary,steps:[],createdAt}
      projects: [],       // {id,kind,name,code,level,role,status,startDate,endDate,members,abstract,dirs,pct,createdAt}
      lits: [],           // {id,projectId,dir,title,authors,year,source,doi,url,status,summary,quotes,ideas,tags,createdAt}
      venues: [],         // {id,projectId,type,name,level,deadline,url,require,cycle,fee,note,star}
      progress: [],       // {id,projectId,date,title,content,pct,tag}
      exps: [],           // {id,projectId,name,method,content,result,date,status}
      writings: [],       // {id,projectId,section,title,content,updatedAt}
      rsTasks: [],        // {id,date,title,projectId,type,minutes,done,doneAt,note}
      rsDiary: [],        // {id,date,content,hours,mood,tags}
      radar: [],          // {id,date,dir,title,source,url,note,read,star,projectId}
      libItems: [],       // {id,type,title,url,content,tags,createdAt}
      subs: [],           // {id,title,projectId,venueName,type,submitDate,status,history,url,note}
      outputs: [],        // {id,type,title,venue,date,level,authors,doi,note}
      reviews: [],        // {id,projectId,date,title,gain,problem,improve,tags}
      otherMemos: [],     // {id,title,content,source,due,done,priority,createdAt}
      otherResults: []    // {id,title,content,date,type,tags}
    };
  }

  const KEYS = Object.keys(defaultState());

  /* ---------- 首次使用的默认入口（可自行增删） ---------- */
  function seedLinks() {
    const t = Date.now();
    return [
      { id: 'lk_admin', cat: 'dept.web', name: '部门网页后台管理', url: 'https://www.hebkx.cn/admin15fd16a5dbc1.php?c=login&m=index&go=%252Fjcb%252Fadmin15fd16a5dbc1.php', note: '院系网站内容发布后台', tag: '后台', createdAt: t },
      { id: 'lk_ds', cat: 'dept.ai', name: 'DeepSeek', url: 'https://chat.deepseek.com/', note: '中文长文本写作与逻辑梳理', tag: 'AI写作', createdAt: t },
      { id: 'lk_kimi', cat: 'dept.ai', name: 'Kimi', url: 'https://www.kimi.com/?data_source=tracer&data_industry=ocpc_ps_convert&utm_campaign=TR_2MKylJws&utm_content=&utm_medium=360&utm_source=360_pc_search&utm_term=&qhclickid=4a11da5563a0f598', note: '长文档解析与资料整理', tag: 'AI写作', createdAt: t },
      { id: 'lk_gem', cat: 'dept.ai', name: 'Gemini', url: 'https://gemini.google.com/app?utm_source=deepmind.google&utm_medium=referral&utm_campaign=gdm&utm_content=&pli=1', note: '英文表达与多模态处理', tag: 'AI写作', createdAt: t },
      { id: 'lk_qb', cat: 'dept.ai', name: 'QuillBot 语法检查', url: 'https://quillbot.com/grammar-check', note: '英文语法与润色', tag: '语言润色', createdAt: t },
      { id: 'lk_jd', cat: 'dept.ai', name: '交兑网', url: 'https://www.ijiaodui.com/', note: '公文与材料参考', tag: '素材', createdAt: t },
      { id: 'lk_st', cat: 'rs.radar', name: '数图文献平台', url: 'https://3.shutong2.com/', note: '中外文文献检索与下载', tag: '文献源', createdAt: t },
      { id: 'lk_rg', cat: 'rs.radar', name: 'ResearchGate', url: 'https://www.researchgate.net/signup.SignUpFinished.html', note: '全球学者社区与全文获取', tag: '文献源', createdAt: t }
    ];
  }

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
  JZ.S = S;

  const dirty = new Set();
  const flush = u.debounce(async () => {
    const list = Array.from(dirty); dirty.clear();
    for (const k of list) {
      const val = S[k];
      try {
        if (idbOK) await idbPut(ST_KV, k, val);
        else localStorage.setItem(LS_PREFIX + k, JSON.stringify(val));
      } catch (e) {
        try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(val)); }
        catch (e2) { u.toast('数据保存失败，可能已超出浏览器容量', 'err', 4200); }
      }
    }
    updateQuota();
  }, 340);

  function save(key) {
    if (key) dirty.add(key); else KEYS.forEach(k => dirty.add(k));
    if (key === 'settings' || !key) writeSharedCal();
    flush();
  }

  /* ---------- 校历共享（与教学工作台同步） ---------- */
  function writeSharedCal() {
    try {
      const s = S.settings;
      localStorage.setItem(CAL_KEY, JSON.stringify({
        schoolYear: s.schoolYear, termName: s.termName, termStart: s.termStart,
        totalWeeks: s.totalWeeks, teacherName: s.ownerName, at: Date.now()
      }));
    } catch (e) { }
  }
  function readSharedCal() {
    try { return JSON.parse(localStorage.getItem(CAL_KEY) || 'null'); } catch (e) { return null; }
  }
  /** 启动时若教学工作台改过校历且更新更晚，则以其为准 */
  function syncSharedCal() {
    const c = readSharedCal();
    if (!c) { writeSharedCal(); return false; }
    if ((c.at || 0) > (S.settings.calAt || 0)) {
      S.settings.schoolYear = c.schoolYear || S.settings.schoolYear;
      S.settings.termName = c.termName || S.settings.termName;
      S.settings.termStart = c.termStart || S.settings.termStart;
      S.settings.totalWeeks = c.totalWeeks || S.settings.totalWeeks;
      S.settings.calAt = c.at;
      dirty.add('settings'); flush();
      return true;
    }
    return false;
  }

  async function load() {
    idb = await openDB();
    idbOK = !!idb;
    let fresh = true;
    for (const k of KEYS) {
      let v = null;
      if (idbOK) { try { v = await idbGet(ST_KV, k); } catch (e) { v = null; } }
      if (v === undefined || v === null) {
        try { const raw = localStorage.getItem(LS_PREFIX + k); if (raw) v = JSON.parse(raw); } catch (e) { }
      }
      if (v !== undefined && v !== null) {
        fresh = false;
        if (Array.isArray(S[k])) S[k] = Array.isArray(v) ? v : S[k];
        else if (typeof S[k] === 'object') S[k] = Object.assign({}, S[k], v);
        else S[k] = v;
      }
    }
    if (fresh || !S.links.length) { S.links = seedLinks().concat(S.links || []); save('links'); }
    syncSharedCal();
    S.settings.calAt = S.settings.calAt || Date.now();
    return { idb: idbOK, fresh: fresh };
  }

  /* ---------- 文件 ---------- */
  async function putBlob(id, blob) {
    if (idbOK) { await idbPut(ST_FILE, id, blob); return 'idb'; }
    if (blob.size > 1.2 * 1024 * 1024) throw new Error('本地文件模式下单个文件不超过1.2MB，建议用「启动本地服务」方式打开以支持大文件');
    const b64 = await new Promise((res, rej) => {
      const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob);
    });
    localStorage.setItem(LS_PREFIX + 'file:' + id, b64);
    return 'ls';
  }
  async function getBlob(id) {
    if (idbOK) { const b = await idbGet(ST_FILE, id); if (b) return b; }
    const b64 = localStorage.getItem(LS_PREFIX + 'file:' + id);
    if (!b64) return null;
    return await (await fetch(b64)).blob();
  }
  async function delBlob(id) {
    if (idbOK) await idbDel(ST_FILE, id);
    localStorage.removeItem(LS_PREFIX + 'file:' + id);
  }
  async function allBlobIds() {
    const ids = idbOK ? await idbKeys(ST_FILE) : [];
    Object.keys(localStorage).forEach(k => { if (k.indexOf(LS_PREFIX + 'file:') === 0) ids.push(k.slice((LS_PREFIX + 'file:').length)); });
    return ids;
  }

  /** 登记一个文件：cat 业务分类，refId 关联对象 */
  async function addFile(file, cat, refId, extra) {
    const fid = u.uid('f');
    await putBlob(fid, file);
    const dot = file.name.lastIndexOf('.');
    const rec = Object.assign({
      id: u.uid('fr'), fileId: fid, name: file.name,
      ext: dot > 0 ? file.name.slice(dot + 1).toLowerCase() : '',
      size: file.size, cat: cat, refId: refId || '', tag: '', note: '',
      createdAt: Date.now()
    }, extra || {});
    S.files.push(rec); save('files');
    return rec;
  }
  function filesOf(cat, refId) {
    return S.files.filter(f => f.cat === cat && (refId === undefined || f.refId === (refId || '')))
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  async function removeFile(recId) {
    const i = S.files.findIndex(f => f.id === recId);
    if (i < 0) return;
    await delBlob(S.files[i].fileId);
    S.files.splice(i, 1); save('files');
  }
  async function openFile(rec) {
    const b = await getBlob(rec.fileId);
    if (!b) { u.toast('文件已丢失，请重新上传', 'err'); return; }
    const url = URL.createObjectURL(b);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function downloadFile(rec) {
    const b = await getBlob(rec.fileId);
    if (!b) { u.toast('文件已丢失，请重新上传', 'err'); return; }
    u.download(b, rec.name);
  }

  /* ---------- 链接 ---------- */
  function linksOf(cat, refId) {
    return S.links.filter(l => l.cat === cat && (refId === undefined || (l.refId || '') === (refId || '')));
  }

  /* ---------- 通用集合操作 ---------- */
  function add(key, obj) {
    const rec = Object.assign({ id: u.uid(key.slice(0, 3)), createdAt: Date.now() }, obj);
    S[key].push(rec); save(key); emit('change:' + key, rec);
    return rec;
  }
  function upd(key, id, patch) {
    const r = S[key].find(x => x.id === id);
    if (!r) return null;
    Object.assign(r, patch, { updatedAt: Date.now() });
    save(key); emit('change:' + key, r);
    return r;
  }
  function del(key, id) {
    const i = S[key].findIndex(x => x.id === id);
    if (i < 0) return false;
    S[key].splice(i, 1); save(key); emit('change:' + key, null);
    return true;
  }
  function one(key, id) { return S[key].find(x => x.id === id) || null; }

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

  /* ---------- 备份 / 恢复 ---------- */
  // opts: { keys?: string[], withFiles?: bool, onProgress? }
  // keys 省略或为空表示导出全部；withFiles 为 true 时一并打包二进制附件
  async function exportAll(opts) {
    opts = opts || {};
    const keys = (opts.keys && opts.keys.length) ? opts.keys : KEYS;
    const withFiles = !!opts.withFiles;
    const data = {
      __app: 'jocelyn-workbench', __ver: 1, __at: new Date().toISOString(),
      partial: keys.length < KEYS.length, data: {}
    };
    keys.forEach(k => data.data[k] = S[k]);
    if (withFiles) {
      data.blobs = {};
      const ids = await allBlobIds();
      for (let i = 0; i < ids.length; i++) {
        const b = await getBlob(ids[i]);
        if (!b) continue;
        data.blobs[ids[i]] = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
        if (opts.onProgress) opts.onProgress(i + 1, ids.length);
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
        // 子集（部分筛选）导出：仅按 id 合并补充，绝不覆盖同键的兄弟记录
        const ids = new Set(S[k].map(x => x.id));
        obj.data[k].forEach(x => { if (!ids.has(x.id)) S[k].push(x); });
      } else if (mode === 'merge' && Array.isArray(S[k]) && Array.isArray(obj.data[k])) {
        const ids = new Set(S[k].map(x => x.id));
        obj.data[k].forEach(x => { if (!ids.has(x.id)) S[k].push(x); });
      } else if ((isSub || mode === 'merge') && typeof S[k] === 'object' && !Array.isArray(S[k])) {
        S[k] = Object.assign({}, S[k], obj.data[k]);
      } else S[k] = obj.data[k];
    });
    const blobs = obj.blobs || obj.files;
    if (blobs) {
      for (const id of Object.keys(blobs)) {
        try { await putBlob(id, await (await fetch(blobs[id])).blob()); } catch (e) { }
      }
    }
    save(); emit('data:reload');
  }
  async function clearAll() {
    const d = defaultState();
    KEYS.forEach(k => { S[k] = d[k]; });
    S.links = seedLinks();
    const ids = await allBlobIds();
    for (const id of ids) await delBlob(id);
    save(); emit('data:reload');
  }

  JZ.db = {
    load, save, KEYS, defaultState,
    addFile, filesOf, removeFile, openFile, downloadFile, getBlob, putBlob, delBlob, allBlobIds,
    linksOf, add, upd, del, one,
    on, emit, updateQuota, exportAll, importAll, clearAll,
    syncSharedCal, writeSharedCal,
    get idbOK() { return idbOK; }
  };
})(window.JZ);
