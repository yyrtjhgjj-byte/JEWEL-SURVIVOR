// オフラインでも あそべるように キャッシュする
const CACHE = 'jewel-survivor-v104';
const ASSETS = [
  './', './index.html', './css/style.css', './manifest.webmanifest',
  './js/main.js', './js/game.js', './js/weapons.js', './js/data.js', './js/render.js', './js/fx.js',
  './js/audio.js', './js/input.js', './js/ui.js', './js/save.js', './js/util.js',
  './js/stages.js', './js/enemies.js', './js/hazards.js', './js/atelier.js', './js/atelier-ui.js', './js/auction.js', './js/beasts.js', './js/artifacts.js', './js/artifact-art.js', './js/shop-art.js', './js/gem-facts.js', './js/elements.js', './js/rank.js', './js/howto.js', './js/gem-art.js', './js/jukebox.js', './js/diag.js',
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

// ネットワーク優先（更新がすぐ反映される）→ だめなら キャッシュ。
// 電波が弱くて返事が来ないときは、ページ本体を NAV_TIMEOUT で保存分に切り替える（待ち続けて起動が遅くならないように）。
// 保存分でページを開いたら、続く JS・CSS なども少しの間は保存分を優先する（新旧の版のファイルが混ざると起動しないため）
const NAV_TIMEOUT = 3000;
const CACHE_FIRST_FOR = 15000;
let cacheFirstUntil = 0;

const fromCache = (req) => caches.match(req, { ignoreSearch: true });

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const sameOrigin = url.origin === location.origin;
  const cacheable = sameOrigin || url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com';
  const isNav = e.request.mode === 'navigate';
  // 同じサイトのファイルはブラウザの HTTP キャッシュを通さず、必ずサーバーに更新を確認する
  // （GitHub Pages は 10 分キャッシュされるため、これがないと更新直後に古い版が出る）
  const fetchNet = () => {
    const req = sameOrigin
      ? fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin', redirect: isNav ? 'manual' : 'follow' })
      : fetch(e.request);
    return req.then((res) => {
      if ((res.ok || res.type === 'opaque') && cacheable) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    });
  };

  // 保存分でページを開いた直後：保存分を優先（無ければネットワーク）
  if (!isNav && Date.now() < cacheFirstUntil) {
    e.respondWith(fromCache(e.request).then((r) => r || fetchNet()));
    return;
  }

  if (!isNav) {
    e.respondWith(fetchNet().catch(() => fromCache(e.request)));
    return;
  }

  // ページ本体：ネットワークを待つのは NAV_TIMEOUT まで。間に合わなければ保存分で開く（ネットワークの取得は裏で続けて保存を更新する）
  const net = fetchNet();
  e.waitUntil(net.catch(() => {}));
  e.respondWith(new Promise((resolve) => {
    let done = false;
    const useCache = () => fromCache(e.request).then((r) => {
      if (done || !r) return false;
      done = true;
      cacheFirstUntil = Date.now() + CACHE_FIRST_FOR;
      resolve(r);
      return true;
    });
    const timer = setTimeout(useCache, NAV_TIMEOUT);
    net.then((res) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(res);
    }).catch(() => {
      clearTimeout(timer);
      useCache().then((ok) => { if (!ok && !done) { done = true; resolve(Response.error()); } });
    });
  }));
});
