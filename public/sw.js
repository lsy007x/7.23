// 오프라인 지원: 한 번 열어 본 뒤에는 신호가 없어도 사전·도면이 열린다 (AI 기능 제외)
const CACHE = "tamsaek-v1";
const CORE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icon.svg",
  "css/style.css",
  "js/app.js",
  "js/brackets.js",
  "js/data.js",
  "js/definitions.js",
  "js/diagrams.js",
  "js/figures.js",
  "js/figview.js",
  "js/model3d.js",
  "js/rag.js",
  "js/regions.js",
  "js/regions_manual.js",
  "js/structures.js",
  "img/fig-buddha.webp",
  "img/fig-budo.webp",
  "img/fig-dapo-1.webp",
  "img/fig-dapo-2.webp",
  "img/fig-giwa.webp",
  "img/fig-jusimpo-1.webp",
  "img/fig-jusimpo-2.webp",
  "img/fig-lantern.webp",
  "img/fig-pagoda.webp",
  "img/fig-stele.webp"
];
// 3D 화면에 필요한 외부 라이브러리 (index.html의 importmap과 같은 주소)
const EXTRA = [
  "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
  "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    await c.addAll(CORE);
    await Promise.allSettled(EXTRA.map((u) => c.add(u))); // 외부 주소는 실패해도 설치를 막지 않는다
  }).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const put = (req, res) => { if (res.ok || res.type === "opaque") caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; };
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).pathname.includes("/api/")) return;
  const sameOrigin = new URL(req.url).origin === location.origin;
  const isImage = req.destination === "image";
  if (sameOrigin && !isImage) {
    // 화면·코드: 연결되면 항상 최신, 3초 안에 답이 없거나 끊기면 저장본
    e.respondWith(new Promise((resolve) => {
      let done = false;
      const fallback = () => caches.match(req, { ignoreSearch: true }).then((hit) => { if (!done && hit) { done = true; resolve(hit); } return hit; });
      const timer = setTimeout(fallback, 3000);
      fetch(req).then((res) => { clearTimeout(timer); if (!done) { done = true; resolve(put(req, res)); } })
        .catch(() => { clearTimeout(timer); fallback().then((hit) => { if (!done) { done = true; resolve(hit || Response.error()); } }); });
    }));
  } else {
    // 도면 이미지·글꼴·외부 라이브러리: 저장본 먼저
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))));
  }
});
