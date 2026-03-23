// Service Worker — 業務記録・点呼記録簿 PWA
var CACHE_NAME = 'mkt-check-v13';
var URLS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './guide.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// インストール時にキャッシュ
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 古いキャッシュ削除
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (name) { return name !== CACHE_NAME; })
          .map(function (name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

// ネットワーク優先、オフライン時はキャッシュを使用
self.addEventListener('fetch', function (e) {
  e.respondWith(
    fetch(e.request).then(function (response) {
      // 成功したらキャッシュを更新
      if (response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(e.request, clone);
        });
      }
      return response;
    }).catch(function () {
      // オフライン時はキャッシュから返す
      return caches.match(e.request).then(function (cached) {
        if (cached) return cached;
        if (e.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
