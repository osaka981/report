// 日報アプリ Service Worker (オフライン起動対応) 2026/05/23
// 方針: アプリ本体(HTML/アイコン)はキャッシュしてオフラインでも開けるようにする。
//       データ通信(Firebase)はキャッシュせず常にネットワークへ。
const CACHE_NAME = 'nikki-app-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest-app.json',
  './icon-app-192.png',
  './icon-app-512.png'
];

// インストール時にアプリ本体をキャッシュ
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)).catch(()=>{})
  );
  self.skipWaiting();
});

// 古いキャッシュを削除
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// fetch戦略
self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Firebase/Google等の通信はキャッシュせず常にネットワーク(データは最新を取る)
  if (url.includes('firebasedatabase.app') ||
      url.includes('gstatic.com') ||
      url.includes('googleapis.com') ||
      e.request.method !== 'GET') {
    return; // ブラウザのデフォルト(ネットワーク)に任せる
  }
  // 管理画面(report_admin_v3.html)は日報アプリSWの管理対象外(常にネットワーク)
  if (url.includes('report_admin') || url.includes('manifest-admin') || url.includes('icon-admin')) {
    return;
  }
  // アプリ本体: network-first(最新を取りに行き、失敗時のみキャッシュ)
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // 取得成功 → キャッシュも更新
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, copy)).catch(()=>{});
        return res;
      })
      .catch(() => caches.match(e.request)) // オフライン → キャッシュから
  );
});
