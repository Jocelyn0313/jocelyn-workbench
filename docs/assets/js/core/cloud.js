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
  // 同步范围：同时覆盖主工作台(JZ.S) 与 教学工作台(TW.S) 两套状态对象。
  // 存储键 = sha256(uid + ':' + (scope==='tw' ? 'tw:' : '') + k)
  //   - JZ 键不带前缀，与历史已同步数据兼容（旧版只同步了 JZ 侧少量键）
  //   - TW 键加 'tw:' 前缀，避免与 JZ 的 settings 等同名键冲突
  // 说明：二进制文件（resources/files 的 blob）本阶段不进云端，仅同步其结构化元数据；
  //       文件本身仍存本机，后续可接 Supabase Storage 加密同步。
  function buildSyncSet() {
    const jz = (JZ.db && JZ.db.KEYS) || [];
    const tw = (window.TW && window.TW.db && window.TW.db.KEYS) || [];
    return jz.map(k => ({ scope: 'jz', k: k })).concat(tw.map(k => ({ scope: 'tw', k: k })));
  }
  function storeOf(scope) { return scope === 'tw' ? (window.TW && window.TW.S) : JZ.S; }
  function dbOf(scope) { return scope === 'tw' ? (window.TW && window.TW.db) : JZ.db; }
  function hashOf(uid, scope, k) { return cm.sha256Hex(uid + ':' + (scope === 'tw' ? 'tw:' : '') + k); }

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
      // 访问令牌过期：尝试用 refresh_token 续期一次，再原样重试该请求（刷新请求自身不递归）
      if (res.status === 401 && /jwt expired|invalid jwt|token is expired|expired/i.test(msg) && !opts.__refreshing && !/auth\/v1\/token/.test(path)) {
        try {
          await refreshSession();
          return await api(path, Object.assign({}, opts, { __refreshing: true }));
        } catch (e2) {
          throw new Error('登录已过期，请重新登录：' + e2.message);
        }
      }
      throw new Error(msg);
    }
    const txt = await res.text();
    if (!txt) return null;
    try { return JSON.parse(txt); } catch (e) { return null; }
  }

  function finishAuth(r) {
    if (!r || !r.access_token || !r.user) throw new Error('登录失败：返回数据异常');
    let expiresAt = null;
    if (r.expires_in) expiresAt = Date.now() + r.expires_in * 1000;
    else if (r.expires_at) expiresAt = r.expires_at * 1000;
    session = { access_token: r.access_token, refresh_token: r.refresh_token, user_id: r.user.id, email: r.user.email, expires_at: expiresAt };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
    return session;
  }
  // 用 refresh_token 续期（访问令牌默认 1 小时过期，过期后 Supabase 返回 401 JWT expired）。
  // 此请求只带 apikey、不带 Authorization，避免把已过期的旧令牌再发一次。
  async function refreshSession() {
    const s = getSession();
    if (!s || !s.refresh_token) throw new Error('无刷新令牌，请重新登录');
    const init = {
      method: 'POST',
      headers: { 'apikey': cfg.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token })
    };
    let res;
    try { res = await fetch(cfg.url + '/auth/v1/token?grant_type=refresh_token', init); }
    catch (e) { throw new Error('网络不可达：' + e.message); }
    if (!res.ok) {
      let msg = res.status + (res.statusText ? ' ' + res.statusText : '');
      try { const j = JSON.parse(await res.text()); if (j) { const d = j.msg || j.message || j.error_description || j.error; if (d) msg = String(d); } } catch (e) {}
      throw new Error(msg);
    }
    const r = await res.json();
    if (!r || !r.access_token) throw new Error('返回数据异常');
    let expiresAt = null;
    if (r.expires_in) expiresAt = Date.now() + r.expires_in * 1000;
    else if (r.expires_at) expiresAt = r.expires_at * 1000;
    const ns = { access_token: r.access_token, refresh_token: r.refresh_token || s.refresh_token, user_id: (r.user && r.user.id) || s.user_id, email: (r.user && r.user.email) || s.email, expires_at: expiresAt };
    session = ns;
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(ns)); } catch (e) {}
    return ns;
  }
  // 提前续期：若已知过期时间点且临近（60 秒内），先刷新再继续，避免白跑一次失败请求
  async function ensureFreshToken() {
    const s = getSession();
    if (!s) throw new Error('请先登录');
    if (s.expires_at && Date.now() > s.expires_at - 60000) {
      await refreshSession();
    }
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
    await ensureFreshToken();
    const uid = getSession().user_id;
    const set = buildSyncSet();
    const items = [];
    for (const { scope, k } of set) {
      const S = storeOf(scope); if (!S) continue;
      const v = S[k];
      if (v === undefined) continue;
      const enc = await cm.encryptJSON(v, ceKey);
      const hk = await hashOf(uid, scope, k);
      items.push({ k: k, scope: scope, user_id: uid, key: hk, value: enc, updated_at: new Date().toISOString() });
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

    for (const { scope, k } of set) {
      const S = storeOf(scope); if (!S) continue;
      if (!S.__cloudTs) S.__cloudTs = {};
      const it = items.find(x => x.scope === scope && x.k === k);
      if (it) S.__cloudTs[k] = it.updated_at;
    }
    setStatus('online');
    return items.length;
  }

  async function pullAndMerge() {
    await ensureFreshToken();
    const uid = getSession().user_id;
    const rows = await api('/rest/v1/user_data?user_id=eq.' + encodeURIComponent(uid) + '&select=key,value,updated_at', { method: 'GET' });
    const set = buildSyncSet();
    const map = {};
    for (const { scope, k } of set) map[await hashOf(uid, scope, k)] = { scope: scope, k: k };
    let n = 0;
    for (const row of (rows || [])) {
      const m = map[row.key];
      if (!m) continue;
      const S = storeOf(m.scope); if (!S) continue;
      try {
        const v = await cm.decryptJSON(row.value.ct, row.value.iv, ceKey);
        if (!S.__cloudTs) S.__cloudTs = {};
        const localTs = S.__cloudTs[m.k];
        if (!localTs || (row.updated_at && new Date(row.updated_at) > new Date(localTs))) {
          S[m.k] = v;
          S.__cloudTs[m.k] = row.updated_at;
          n++;
        }
      } catch (e) { console.warn('解密失败跳过', m.scope, m.k, e); }
    }
    // 双端状态都落盘并刷新界面
    const TWdb = window.TW && window.TW.db;
    JZ.db.save(); JZ.db.emit('data:reload');
    if (TWdb) { TWdb.save(); TWdb.emit('data:reload'); }
    setStatus('online');
    return n;
  }

  /* ---------- 后台自动同步（阶段4） ---------- */
  let autoTimer = null, pushTimer = null, saveWrapped = false, origSaveJZ = null, origSaveTW = null;
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
    origSaveJZ = JZ.db.save;
    JZ.db.save = function (k) {
      const r = origSaveJZ.apply(JZ.db, arguments);
      schedulePush();
      return r;
    };
    const TWdb = window.TW && window.TW.db;
    if (TWdb && TWdb.save) {
      origSaveTW = TWdb.save;
      TWdb.save = function (k) {
        const r = origSaveTW.apply(TWdb, arguments);
        schedulePush();
        return r;
      };
    }
    saveWrapped = true;
  }
  function unwrapSave() {
    if (saveWrapped) {
      if (origSaveJZ) JZ.db.save = origSaveJZ;
      const TWdb = window.TW && window.TW.db;
      if (origSaveTW && TWdb) TWdb.save = origSaveTW;
      saveWrapped = false;
    }
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
    refreshSession: refreshSession,
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
    syncSet: function () { return buildSyncSet(); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
