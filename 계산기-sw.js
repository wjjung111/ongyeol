/* 계산 노트 전용 서비스워커 — 계산기.html만 캐시(오프라인용), 나머지 요청은 일절 건드리지 않음 */
'use strict';
const CACHE = 'ongyeol-calc-cache-v1';
const APP_PATH = '계산기.html';

function isCalcApp(url) {
  try { return decodeURIComponent(new URL(url).pathname).endsWith(APP_PATH); }
  catch (e) { console.error('계산노트 SW URL 해석 실패', e); return false; }
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.add(new Request(encodeURIComponent(APP_PATH), { cache: 'reload' })))
      .catch(e => console.error('계산노트 SW 사전캐시 실패', e))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// 네트워크 우선(항상 최신 코드), 실패 시(오프라인) 캐시로 폴백
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !isCalcApp(event.request.url)) return; // 다른 앱(집합건물 등)은 통과
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(event.request, copy))
            .catch(e => console.error('계산노트 SW 캐시 갱신 실패', e));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then(hit => hit || Response.error()))
  );
});
