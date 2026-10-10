   const CACHE = 'hr-policy-qa-v1';
   const SHELL = ['/', '/icon-192.png', '/icon-512.png'];

   self.addEventListener('install', (event) => {
     event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
     self.skipWaiting();
   });

   self.addEventListener('activate', (event) => {
     event.waitUntil(
       caches.keys().then((keys) =>
         Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
       )
     );
     self.clients.claim();
   });

   self.addEventListener('fetch', (event) => {
     const req = event.request;
     const url = new URL(req.url);

     // Only handle same-origin GETs, and never touch the API
     if (req.method !== 'GET' || url.origin !== self.location.origin) return;
     if (url.pathname.startsWith('/api/')) return;

     // Network first, fall back to cache when offline
     event.respondWith(
       fetch(req)
         .then((res) => {
           const copy = res.clone();
           caches.open(CACHE).then((c) => c.put(req, copy));
           return res;
         })
         .catch(() => caches.match(req).then((hit) => hit || caches.match('/')))
     );
   });