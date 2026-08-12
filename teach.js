/* =========================================================
   teach.js  教学待办桥：个人工作台「教学工作台」与教学工作台共用一份待办
   合并后教学数据已与 JZ 同库（jocelyn-workbench / kv 键 tw:todos），
   因此优先直接读写 TW 内存与存储；仅在 TW 未加载时回退到
   IndexedDB(teaching-workbench 旧键) / localStorage(tw:todos) 兼容桥。
   ========================================================= */
window.JZ = window.JZ || {};
(function (JZ) {
  'use strict';
  const TW_DB = 'jocelyn-workbench', TW_STORE = 'kv', TW_KEY = 'tw:todos';
  const LS_TW = 'tw:todos';
  const LS_SHARE = 'jz:sharedTodos';

  let idb = null, idbOK = false, tried = false;

  function openDB() {
    return new Promise(res => {
      if (!window.indexedDB) return res(null);
      let req;
      try { req = indexedDB.open(TW_DB, 1); } catch (e) { return res(null); }
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(TW_STORE)) db.createObjectStore(TW_STORE);
      };
      req.onsuccess = e => res(e.target.result);
      req.onerror = () => res(null);
      req.onblocked = () => res(null);
      setTimeout(() => res(req.result || null), 2500);
    });
  }
  function idbGet() {
    return new Promise(res => {
      if (!idbOK) return res(null);
      try {
        const tx = idb.transaction(TW_STORE, 'readonly');
        const r = tx.objectStore(TW_STORE).get(TW_KEY);
        r.onsuccess = () => res(r.result); r.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  }
  function idbPut(val) {
    return new Promise(res => {
      if (!idbOK) return res(false);
      try {
        const tx = idb.transaction(TW_STORE, 'readwrite');
        tx.objectStore(TW_STORE).put(val, TW_KEY);
        tx.oncomplete = () => res(true); tx.onerror = () => res(false);
      } catch (e) { res(false); }
    });
  }
  function ensure() {
    if (tried) return Promise.resolve();
    tried = true;
    return openDB().then(d => { idb = d; idbOK = !!d; });
  }
  function lsGet() {
    try { const v = JSON.parse(localStorage.getItem(LS_TW) || 'null'); return Array.isArray(v) ? v : null; }
    catch (e) { return null; }
  }
  function lsSet(arr) {
    try { localStorage.setItem(LS_TW, JSON.stringify(arr)); } catch (e) { }
  }

  /* TW 已加载时，直接读写其内存与存储，保证即时刷新 */
  function twReady() { return !!(window.TW && window.TW.S && window.TW.db); }
  function curTermId() {
    try { return (window.TW && window.TW.term) ? window.TW.term.currentId() : ''; }
    catch (e) { return ''; }
  }

  async function readTodos() {
    if (twReady()) return Array.isArray(window.TW.S.todos) ? window.TW.S.todos.slice() : [];
    await ensure();
    let arr = idbOK ? await idbGet() : null;
    if (!Array.isArray(arr)) arr = lsGet();
    return Array.isArray(arr) ? arr : [];
  }

  async function writeTodos(arr) {
    if (twReady()) {
      window.TW.S.todos = arr.slice();
      window.TW.db.save('todos');
      window.TW.db.emit('data:reload');
      try { localStorage.setItem(LS_TW, JSON.stringify(arr)); } catch (e) { }
      try { window.dispatchEvent(new StorageEvent('storage', { key: LS_TW })); } catch (e) { }
      return;
    }
    await ensure();
    if (idbOK) await idbPut(arr);
    lsSet(arr);
    try { localStorage.setItem(LS_SHARE, JSON.stringify({ at: Date.now(), todos: arr })); } catch (e) { }
    try { window.dispatchEvent(new StorageEvent('storage', { key: LS_SHARE })); } catch (e) { }
  }

  /* 供快速记录使用：写入时自动带上当前学期 id，使待办在教期内可见 */
  async function pushTodo(obj) {
    const arr = await readTodos();
    const item = Object.assign({ id: 't' + Date.now(), done: false, createdAt: new Date().toISOString() }, obj);
    if (!item.termId) item.termId = curTermId();
    arr.push(item);
    await writeTodos(arr);
    return item;
  }

  JZ.teach = {
    readTodos: readTodos,
    writeTodos: writeTodos,
    pushTodo: pushTodo,
    get idbOK() { return idbOK; }
  };
})(window.JZ);
