/* 云端同步客户端（Supabase REST，无SDK依赖）
   设计：本地优先 + 加密镜像。云端只存 AES-GCM 密文与学号级去标识化键。
   登录=Supabase Auth（邮箱密码）；同步口令=同一密码本地派生 CEK，永不传输。 */
(function (root) {
  'use strict';
  const JZ = (root.JZ = root.JZ || {});
  const cfg = JZ.cloudConfig;
  const cm = JZ.crypto;

  const SESSION_KEY = 'jz:cloudSession';
  const PASS_KEY = 'jz:syncPass'; // 设备本地保存同步口令，便于重载自动连接（设备被攻破则同泄，已权衡）
  // 结构化数据同步键（不含 resources 二进制大对象，避免单行过大）
  const SYNC_KEYS = ['settings', 'classes', 'roster', 'records', 'bonus', 'schedule', 'adjustments',
    'exams', 'todos', 'reflections', 'deptTodos', 'rsTasks', 'otherMemos', 'compWorks', 'radar',
    'projOpts', 'topics', 'members', 'experiments', 'writings', 'submissions', 'outputs', 'reviews',
    'webPages', 'reports', 'videos', 'studComp', 'teaComp'];

  let session = null; // {access_token, refresh_token, user_id, email}
  let ceKey = null;   // CryptoKey
  let currentPass = '';
  let status = 'off'; // off | local | online | error
  let statusCb = null;

  function setStatus(s) { status = s; if (statusCb) statusCb(s); }
  function onStatus(cb) { statusCb = cb; }

  function headers(extra) {
    const h = { 'apikey': cfg.anonKey, 'Content-Type': 'application/json' };
    if (session && session.access_token) h['Authorization'] = 'Bearer ' + session.access_token;
    return Object.assign(h, extra || {});
  }
  async function api(path, opts) {
    opts = opts || {};
    const init = Object.assign({}, opts);
    init.headers = headers(opts.headers); // 合并 apikey/Authorization 与调用方附加头（如 Prefer），避免被 opts.headers 整体覆盖
    let res;
    try { res = await fetch(cfg.url + path, init); }
    catch (e) { throw new Error('网络不可达：' + e.message); }
    if (!res.ok) {
      let msg = res.status + (res.statusText ? ' ' + res.statusText : '');
      try {
        const j = JSON.parse(await res.text());
        if (j) {
          const detail = j.msg || j.message || j.error_description || j.error || (j.hint ? ('（' + j.hint + '）') : '');
          if (detail) msg = String(detail);
        }
      } catch (e) {}
      throw new Error(msg);
    }
    const txt = await res.text();
    if (!txt) return null;
    try { return JSON.parse(txt); } catch (e) { return null; }
  }

  function finishAuth(r) {
    if (!r || !r.access_token || !r.user) throw new Error('登录失败：返回数据异常');
    session = { access_token: r.access_token, refresh_token: r.refresh_token, user_id: r.user.id, email: r.user.email };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
    return session;
  }
  async function signUp(email, password) {
    try {
      const r = await api('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: email, password: password }) });
      return finishAuth(r);
    } catch (e) {
      const m = String(e.message || '');
      if (/already registered|already been registered/i.test(m)) throw new Error('该邮箱已注册，请勿重复注册，直接点“登录”即可');
      throw new Error('注册失败：' + m);
    }
  }
  async function signIn(email, password) {
    try {
      const r = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: email, password: password }) });
      return finishAuth(r);
    } catch (e) {
      const m = String(e.message || '');
      if (/invalid_credentials|Invalid login credentials/i.test(m)) throw new Error('登录被拒绝：邮箱或密码不正确。请检查手机是否自动填充了带空格的密码，或确认该邮箱已注册');
      if (/email_not_confirmed|not confirm|not yet confirmed/i.test(m)) throw new Error('登录被拒绝：该邮箱尚未确认。请到邮箱点开 Supabase 的确认邮件链接；或在 Supabase 后台 Auth 设置里关闭“确认邮箱”后重试');
      if (/400/.test(m)) throw new Error('登录被拒绝（400）：可能是 Supabase 项目被暂停或网络受限，请到 Supabase 后台确认项目为 Active');
      throw new Error('登录失败：' + m);
    }
  }
  async function signOut() {
    disableAutoSync();
    try { if (session) await api('/auth/v1/logout', { method: 'POST' }); } catch (e) {}
    session = null; ceKey = null;
    try { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(PASS_KEY); } catch (e) {}
    setStatus('off');
  }
  function getSession() {
    if (session) return session;
    try { const s = localStorage.getItem(SESSION_KEY); if (s) session = JSON.parse(s); } catch (e) {}
    return session;
  }

  async function ensureKey(pass) {
    const uid = getSession().user_id;
    ceKey = await cm.deriveKey(pass, 'jz:' + uid);
    currentPass = pass;
  }

  async function pushAll() {
    const uid = getSession().user_id;
    const items = [];
    for (const k of SYNC_KEYS) {
      const v = JZ.S[k];
      if (v === undefined) continue;
      const enc = await cm.encryptJSON(v, ceKey);
      const hk = await cm.sha256Hex(uid + ':' + k);
      items.push({ k: k, user_id: uid, key: hk, value: enc, updated_at: new Date().toISOString() });
    }
    if (!items.length) { setStatus('online'); return 0; }

    // 先查已存在键：不同版本 PostgREST 对 upsert 头语义不一致，旧版会退化成纯 INSERT 触发主键冲突。
    // 改用 insert(新键)/update(已有键) 拆分，任何版本都不报重复主键。
    const existSet = new Set();
    try {
      const ex = await api('/rest/v1/user_data?user_id=eq.' + encodeURIComponent(uid) + '&select=key', { method: 'GET' });
      if (ex) ex.forEach(r => existSet.add(r.key));
    } catch (e) { console.warn('查已存在键失败，按全量插入处理', e.message); }

    const toInsert = items.filter(it => !existSet.has(it.key));
    const toUpdate = items.filter(it => existSet.has(it.key));

    const stripK = it => { const o = { user_id: it.user_id, key: it.key, value: it.value, updated_at: it.updated_at }; return o; };
    for (let i = 0; i < toInsert.length; i += 100) {
      await api('/rest/v1/user_data', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify(toInsert.slice(i, i + 100).map(stripK))
      });
    }
    for (const it of toUpdate) {
      const body = JSON.stringify({ value: it.value, updated_at: it.updated_at });
      await api('/rest/v1/user_data?user_id=eq.' + encodeURIComponent(uid) + '&key=eq.' + encodeURIComponent(it.key), { method: 'PATCH', body });
    }

    if (!JZ.S.__cloudTs) JZ.S.__cloudTs = {};
    for (const it of items) if (JZ.S[it.k] !== undefined) JZ.S.__cloudTs[it.k] = it.updated_at;
    setStatus('online');
    return items.length;
  }

  async function pullAndMerge() {
    const uid = getSession().user_id;
    const rows = await api('/rest/v1/user_data?user_id=eq.' + encodeURIComponent(uid) + '&select=key,value,updated_at', { method: 'GET' });
    let n = 0;
    if (!JZ.S.__cloudTs) JZ.S.__cloudTs = {};
    for (const row of (rows || [])) {
      for (const k of SYNC_KEYS) {
        if (await cm.sha256Hex(uid + ':' + k) === row.key) {
          try {
            const v = await cm.decryptJSON(row.value.ct, row.value.iv, ceKey);
            const localTs = JZ.S.__cloudTs[k];
            if (!localTs || (row.updated_at && new Date(row.updated_at) > new Date(localTs))) {
              JZ.S[k] = v;
              JZ.S.__cloudTs[k] = row.updated_at;
              n++;
            }
          } catch (e) { console.warn('解密失败跳过', k, e); }
          break;
        }
      }
    }
    if (n) { JZ.db.save(); JZ.db.emit('data:reload'); }
    setStatus('online');
    return n;
  }

  /* ---------- 后台自动同步（阶段4） ---------- */
  let autoTimer = null, pushTimer = null, saveWrapped = false, origSave = null;
  function schedulePush() {
    if (!getSession() || status !== 'online') return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      try { await pushAll(); }
      catch (e) { console.warn('自动上传失败', e.message); setStatus('error'); }
    }, 1200);
  }
  function wrapSave() {
    if (saveWrapped) return;
    origSave = JZ.db.save;
    JZ.db.save = function (k) {
      const r = origSave.apply(JZ.db, arguments);
      schedulePush();
      return r;
    };
    saveWrapped = true;
  }
  function unwrapSave() {
    if (saveWrapped && origSave) { JZ.db.save = origSave; saveWrapped = false; }
  }
  function enableAutoSync() {
    if (!getSession()) return;
    setStatus('online');
    wrapSave();
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(() => {
      if (status !== 'online' || !navigator.onLine) { if (!navigator.onLine) setStatus('local'); return; }
      pullAndMerge().catch(e => { console.warn('自动拉取失败', e.message); setStatus('error'); });
    }, 30000);
  }
  function disableAutoSync() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
    unwrapSave();
  }
  function flushNow() {
    if (!getSession() || status !== 'online') return;
    pushAll().catch(e => console.warn('关闭前上传失败', e.message));
  }

  JZ.cloud = {
    init: function () { /* 配置已静态嵌入 */ },
    onStatus: onStatus,
    status: function () { return status; },
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    getSession: getSession,
    isLoggedIn: function () { return !!getSession(); },
    connect: async function (pass) {
      if (!getSession()) throw new Error('请先登录');
      await ensureKey(pass);
      currentPass = pass;
      try { localStorage.setItem(PASS_KEY, pass); } catch (e) {}
      setStatus('online');
      const n = await pullAndMerge();
      enableAutoSync();
      return n;
    },
    pushAll: pushAll,
    pullAndMerge: pullAndMerge,
    enableAutoSync: enableAutoSync,
    disableAutoSync: disableAutoSync,
    flushNow: flushNow,
    SYNC_KEYS: SYNC_KEYS
  };
})(typeof window !== 'undefined' ? window : globalThis);
