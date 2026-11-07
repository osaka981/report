// 日報アプリ Service Worker (オフライン起動対応) 2026/05/23
// 方針: アプリ本体(HTML/アイコン)はキャッシュしてオフラインでも開けるようにする。
//       データ通信(Firebase)はキャッシュせず常にネットワークへ。
//
// ★ 2026-11-07: 差し替えても古い版が出る問題の対策。
//   この SW は network-first なので本来は新しいものが出るが、
//   fetch(e.request) はブラウザ自身のHTTPキャッシュを通るため、
//   GitHub Pages が付ける有効期限（通常10分）が切れるまで
//   古いファイルが返り続けていた。
//   HTML と sw.js だけは no-store で取りに行き、必ず最新にする。
//
//   CACHE_NAME は差し替えるたびに日付を上げること。
//   名前が変われば古いキャッシュが activate で消える。
const CACHE_NAME = 'nikki-app-2026-11-07a';
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
  /* ★ 2026-11-07: HTML と sw.js はブラウザのキャッシュを使わずに取る。
     同じオリジンなので URL を渡し直すだけでよい。
     画像・アイコンは今までどおり（容量が大きく、変わらないため）。 */
  const _isShell = (e.request.mode === 'navigate')
                || /\.html(\?|$)/.test(url)
                || /\/sw\.js(\?|$)/.test(url)
                || /\/$/.test(url.split('?')[0]);

  // アプリ本体: network-first(最新を取りに行き、失敗時のみキャッシュ)
  e.respondWith(
    fetch(_isShell ? new Request(url, {cache:'no-store', credentials:'same-origin'}) : e.request)
      .then(res => {
        // 取得成功 → キャッシュも更新
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, copy)).catch(()=>{});
        return res;
      })
      .catch(() => caches.match(e.request)) // オフライン → キャッシュから
  );
});
