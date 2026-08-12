/* 客户端加密：PBKDF2 派生密钥 + AES-GCM 加解密 JSON
   浏览器与 node22(globalThis.crypto) 均可用；密钥只留本地，云端只见密文 */
(function (root) {
  'use strict';
  const JZ = (root.JZ = root.JZ || {});
  const c = root.crypto;
  const subtle = c && c.subtle;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function b64ToBytes(b) {
    const bin = (typeof atob === 'function') ? atob(b) : Buffer.from(b, 'base64').toString('binary');
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }
  function bytesToB64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return (typeof btoa === 'function') ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
  }
  async function deriveKey(pass, saltStr) {
    const salt = enc.encode(saltStr);
    const base = await subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: 120000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  }
  async function encryptJSON(obj, key) {
    const iv = c.getRandomValues(new Uint8Array(12));
    const pt = enc.encode(JSON.stringify(obj));
    const buf = await subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, pt);
    return { ct: bytesToB64(new Uint8Array(buf)), iv: bytesToB64(iv) };
  }
  async function decryptJSON(ctB64, ivB64, key) {
    const buf = await subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(ivB64) }, key, b64ToBytes(ctB64));
    return JSON.parse(dec.decode(buf));
  }
  async function sha256Hex(str) {
    const buf = await subtle.digest('SHA-256', enc.encode(str));
    return Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, '0')).join('');
  }
  JZ.crypto = { deriveKey: deriveKey, encryptJSON: encryptJSON, decryptJSON: decryptJSON, sha256Hex: sha256Hex, bytesToB64: bytesToB64, b64ToBytes: b64ToBytes };
})(typeof window !== 'undefined' ? window : globalThis);
