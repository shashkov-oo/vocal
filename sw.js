const CACHE_NAME = 'vocal-trainer-v23';

const ASSETS = [
  './',
  './index.html',
  './salamander/A0.mp3',
  './salamander/C1.mp3','./salamander/Ds1.mp3','./salamander/Fs1.mp3','./salamander/A1.mp3',
  './salamander/C2.mp3','./salamander/Ds2.mp3','./salamander/Fs2.mp3','./salamander/A2.mp3',
  './salamander/C3.mp3','./salamander/Ds3.mp3','./salamander/Fs3.mp3','./salamander/A3.mp3',
  './salamander/C4.mp3','./salamander/Ds4.mp3','./salamander/Fs4.mp3','./salamander/A4.mp3',
  './salamander/C5.mp3','./salamander/Ds5.mp3','./salamander/Fs5.mp3','./salamander/A5.mp3',
  './salamander/C6.mp3','./salamander/Ds6.mp3','./salamander/Fs6.mp3','./salamander/A6.mp3',
  './salamander/C7.mp3','./salamander/Ds7.mp3','./salamander/Fs7.mp3','./salamander/A7.mp3',
  './salamander/C8.mp3',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(res => res || fetch(event.request))
  );
});
