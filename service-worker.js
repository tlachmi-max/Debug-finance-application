// Service Worker for Financial Planner PWA
const CACHE_NAME = 'financial-planner-v41'; // bumped: forces old stale cache to be dropped once
const ASSETS_TO_CACHE = [
    './index.html',
    './style.css',
    './script.js',
    './manifest.json'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing v41...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching files');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Listen for skipWaiting message
self.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating v41...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: Clearing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ============================================================
// Fetch strategy — NETWORK FIRST, cache as offline fallback only.
//
// WHY THIS CHANGED (v41): the previous "cache first" strategy served
// whatever was cached on a URL's FIRST visit, forever — with no
// expiry and no revalidation. Every time app.js/patch files were
// updated and re-uploaded to GitHub Pages, the phone kept silently
// serving the old cached copy of any file that happened to already
// be cached, while files fetched for the first time after an edit
// looked "fixed". This is exactly why one fix could appear to work
// while a nearly identical one (on a different, already-cached file)
// appeared to silently fail to update.
//
// Network-first means: whenever the phone is online (the normal
// case), it always requests the live file from GitHub Pages and
// updates the cache with whatever comes back. The cache is only
// used when there is truly no network (offline), so old cached
// content can never again mask a real deployment.
// ============================================================
self.addEventListener('fetch', (event) => {
    // NEVER cache POST requests (API calls to Supabase)
    if (event.request.method !== 'GET') {
        event.respondWith(fetch(event.request));
        return;
    }

    // Skip caching for Supabase API calls
    if (event.request.url.includes('supabase.co')) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // Offline (or request failed) — fall back to whatever
                // is cached, so the app still opens without a connection.
                return caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    if (event.request.destination === 'document') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});
