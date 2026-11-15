const CACHE_NAME = 'app-v6';

self.addEventListener('install', (event) => {
  console.log("SW instalado 000");
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      cache.addAll([
        './',
        './index.html',
        './styles.css',
        './app.js',
        './db-helper.js',
        './manifest.json',
        './icons/icon-192.png',
        './icons/icon-512.png',
        './icons/icon-maskable-512.png',
        './pages/caches.html'
      ]);
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log("SW activado");
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all([
        keys.map(key => {
          if(key != CACHE_NAME) return caches.delete(key)
        })
      ])
    })
  )
});

self.addEventListener('fetch', (event) => {
  console.log("SW ha interceptado peticion");
  console.log(event.request);
  caches.match(event.request).then(response => {
    return response || fetch(event.request)
  })
});