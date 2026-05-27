/* 今日清单 · 每日抽签待办 — Service Worker
 * 简单的"App Shell"缓存策略：
 *   - install: 把核心文件预缓存
 *   - fetch:   先返回缓存，没有就走网络；网络成功后顺便更新缓存
 *   - activate: 清理旧版缓存
 * 升级时改 CACHE 名字（如 v2 / v3）即可让所有客户端拿到新版本。
 */

const CACHE = "today-list-v8";

// 与首页一同部署的核心文件
const CORE_ASSETS = [
  "./",
  "./每日抽签待办.html",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      // 单独 add 每个，404 不阻塞安装
      Promise.allSettled(CORE_ASSETS.map(url => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  // 只缓存 GET
  if (req.method !== "GET") return;

  // 跨域字体（Google Fonts）走 stale-while-revalidate
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(req).then(cached => {
          const fetchPromise = fetch(req).then(resp => {
            if (resp && resp.status === 200) cache.put(req, resp.clone());
            return resp;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // 同源：先缓存后网络
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return resp;
      }).catch(() => caches.match("./每日抽签待办.html").then(r => r || caches.match("./index.html")));
    })
  );
});
