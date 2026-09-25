// オフラインでも あそべるように キャッシュする
const CACHE = 'jewel-survivor-v12';
const ASSETS = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/main.js', './js/game.js', './js/weapons.js', './js/data.js', './js/render.js', './js/fx.js',
  './js/audio.js', './js/input.js', './js/ui.js', './js/save.js', './js/util.js',
  './js/stages.js', './js/enemies.js', './js/hazards.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'no-cache' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

// ネットワーク優先（更新がすぐ反映される）→ だめなら キャッシュ
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // 同じサイトのファイルはブラウザの HTTP キャッシュを通さず、必ずサーバーに更新を確認する
  // （GitHub Pages は 10 分キャッシュされるため、これがないと更新直後に古い版が出る）
  const sameOrigin = new URL(e.request.url).origin === location.origin;
  const req = sameOrigin
    ? fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin', redirect: e.request.mode === 'navigate' ? 'manual' : 'follow' })
    : fetch(e.request);
  e.respondWith(
    req
      .then((res) => {
        const host = new URL(e.request.url).host;
        const cacheable = new URL(e.request.url).origin === location.origin || host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com';
        if ((res.ok || res.type === 'opaque') && cacheable) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
