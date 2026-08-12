/* =========================================================
   sw.js  离线应用外壳缓存（PWA）
   策略：网络优先，失败回退缓存。保证多端总是拿到最新代码，
   离线时仍可打开外壳。数据本身存于 IndexedDB，关了再开不会丢。
   注意：Service Worker 仅在 http/https 下生效；file:// 双击打开时
   不会注册，但数据持久化不受影响。
   ========================================================= */
const CACHE = 'jz-workbench-v2';
const NET_FIRST = true;
const SHELL = [
  './',
  'index.html',
  'assets/css/app.css',
  'assets/css/ext.css',
  'assets/js/app.js',
  'assets/js/core/utils.js',
  'assets/js/core/store.js',
  'assets/js/core/calendar.js',
  'assets/js/core/io.js',
  'assets/js/core/teach.js',
  'assets/js/core/ui.js',
  'assets/js/core/tw-bridge.js',
  'assets/js/core/cloud-config.js',
  'assets/js/core/crypto.js',
  'assets/js/core/cloud.js',
  'assets/js/views/dashboard.js',
  'assets/js/views/teaching.js',
  'assets/js/views/dept.js',
  'assets/js/views/competition.js',
  'assets/js/views/research.js',
  'assets/js/views/project.js',
  'assets/js/views/other.js',
  'assets/js/views/settings.js',
  'assets/js/views/backup.js',
  'assets/vendor/xlsx.full.min.js',
  'teaching/assets/css/app.css',
  'teaching/assets/js/core/utils.js',
  'teaching/assets/js/core/store.js',
  'teaching/assets/js/core/calendar.js',
  'teaching/assets/js/core/io.js',
  'teaching/assets/js/core/sync.js',
  'teaching/assets/js/views/dashboard.js',
  'teaching/assets/js/views/schedule.js',
  'teaching/assets/js/views/resources.js',
  'teaching/assets/js/views/reflection.js',
  'teaching/assets/js/views/todo.js',
  'teaching/assets/js/views/classroom.js',
  'teaching/assets/js/views/analytics.js',
  'teaching/assets/js/views/settings.js',
  'assets/icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (NET_FIRST) {
    // 网络优先：联网即取最新代码（多端一致性），离线回退缓存
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'default')) {
          caches.open(CACHE).then(c => c.put(req, res.clone()));
        }
        return res;
      }).catch(() => caches.match(req).then(c => c || Response.error()))
    );
  } else {
    e.respondWith(
      caches.match(req).then(cached => {
        const net = fetch(req).then(res => {
          if (res && res.status === 200 && (res.type === 'basic' || res.type === 'default')) {
            caches.open(CACHE).then(c => c.put(req, res.clone()));
          }
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
  }
});
