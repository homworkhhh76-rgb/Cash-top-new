const CACHE_NAME = 'cashtop-pwa-v159-retention-45d-sync-fix';
const FONT_CACHE_NAME = 'cashtop-font-cache-v159-retention-45d-sync-fix';
const PAGE_CACHE_NAME = 'cashtop-local-pages-v159-retention-45d-sync-fix';
const ASSET_CACHE_NAME = 'cashtop-local-assets-v159-retention-45d-sync-fix';
const FONT_CSS_URL = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap';
const PRECACHE = [
  './',
  'accounts.html',
  'admin.html',
  'analytics.html',
  'backup.html',
  'barcode-labels.html',
  'branches.html',
  'cashier.html',
  'categories.html',
  'coupons.html',
  'customers.html',
  'dashboard.html',
  'employees.html',
  'expenses.html',
  'finance.html',
  'index.html',
  'loyalty-points.html',
  'custom-reports.html',
  'ai-analysis.html',
  'units.html',
  'inventory.html',
  'invoices.html',
  'invoice-payment-settings.html',
  'invoice-view.html',
  'login.html',
  'sync-loading.html',
  
  'mobile-scanner.html',
  'notifications.html',
  'print-settings.html',
  'product-offers.html',
  'products.html',
  'menu-settings.html',
  'digital-menu.html',
  'manufacturing.html',
  'purchases.html',
  'purchase-data.html',
  'purchase-reference.html',
  'waste.html',
  'purchase-returns.html',
  'purchase-entry.html',
  'settings.html',
  'shortcuts.html',
  'suppliers.html',
  'tax-settings.html',
  'warehouse.html',
  'workers.html',
  'manifest.json',
  'sw.js',
  'README.md',
  'DATABASE_STRUCTURE.md',
  'firestore.rules',
  'database.rules.json',
  'firestore.secure.rules',
  'icon-64.png',
  'icon-192.png',
  'icon-512.png',
  'oscar-logo.png',
  'app-version.json',
  'offline-update.js',
  'local-bridge.js'
];

async function cacheCairoFont() {
  try {
    const cache = await caches.open(FONT_CACHE_NAME);
    const cssReq = new Request(FONT_CSS_URL, {mode:'cors', cache:'force-cache'});
    const hit = await cache.match(cssReq, {ignoreSearch:false});
    if(hit) return;
    const cssRes = await fetch(cssReq);
    if(cssRes && cssRes.ok) {
      await cache.put(cssReq, cssRes.clone());
      const cssText = await cssRes.clone().text();
      const fontUrls = [...cssText.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1]);
      await Promise.allSettled(fontUrls.map(async src => {
        const req = new Request(src, {mode:'cors', cache:'force-cache'});
        const old = await cache.match(req, {ignoreSearch:false});
        if(old) return;
        const res = await fetch(req);
        if(res && res.ok) await cache.put(req, res.clone());
      }));
    }
  } catch(e) {}
}

async function fontCacheFirst(req) {
  const cache = await caches.open(FONT_CACHE_NAME);
  const hit = await cache.match(req, {ignoreSearch:false});
  if(hit) return hit;
  const res = await fetch(req);
  if(res && res.ok) await cache.put(req, res.clone());
  return res;
}

async function putIfMissing(cache, url) {
  try {
    const req = new Request(url, {cache:'force-cache'});
    const hit = await cache.match(req, {ignoreSearch:true});
    if(hit) return;
    const res = await fetch(req);
    if(res && res.ok) await cache.put(req, res.clone());
  } catch(e) {}
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async()=>{
    const cache = await caches.open(CACHE_NAME);
    const pages = await caches.open(PAGE_CACHE_NAME);
    await Promise.allSettled(PRECACHE.map(async u => {
      await putIfMissing(cache, u);
      if(u === './' || /\.html?$/.test(u)) await putIfMissing(pages, u);
    }));
    await cacheCairoFont();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async()=>{
    // v156: حذف كاش النسخ القديمة حتى لا تفتح نسخة مجمدة.
    const keep = new Set([CACHE_NAME, FONT_CACHE_NAME, PAGE_CACHE_NAME, ASSET_CACHE_NAME]);
    const names = await caches.keys();
    await Promise.all(names.map(name => {
      if(name.startsWith('cashtop') && !keep.has(name)) return caches.delete(name);
      return Promise.resolve(false);
    }));
    if(self.registration.navigationPreload) { try { await self.registration.navigationPreload.disable(); } catch(e) {} }
    await self.clients.claim();
  })());
});

async function matchFromCaches(req, isNavigation=false, url=null) {
  const current = await caches.open(CACHE_NAME);
  const pages = await caches.open(PAGE_CACHE_NAME);
  const assets = await caches.open(ASSET_CACHE_NAME);
  const pageName = url ? (url.pathname.split('/').pop() || 'index.html') : 'index.html';
  return await current.match(req, {ignoreSearch:true}) ||
         await pages.match(req, {ignoreSearch:true}) ||
         await assets.match(req, {ignoreSearch:true}) ||
         (isNavigation ? await current.match(pageName, {ignoreSearch:true}) : null) ||
         (isNavigation ? await pages.match(pageName, {ignoreSearch:true}) : null) ||
         (isNavigation ? await current.match('index.html', {ignoreSearch:true}) : null) ||
         (isNavigation ? await pages.match('index.html', {ignoreSearch:true}) : null) ||
         null;
}

async function cacheResponse(req, res, isNavigation=false) {
  if(!res || !res.ok) return;
  const u = new URL(req.url);
  const cache = isNavigation || /\.html?$/.test(u.pathname) || u.pathname.endsWith('/') ? await caches.open(PAGE_CACHE_NAME) : await caches.open(ASSET_CACHE_NAME);
  await cache.put(req, res.clone());
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  if(url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(fontCacheFirst(req));
    return;
  }

  // Firebase والطلبات الخارجية لا نلمسها حتى تبقى المزامنة كما هي.
  if(url.origin !== self.location.origin) return;

  const isNavigation = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  // v150 Local Pages Cache First: الصفحات المحلية من الكاش أولاً دائماً؛ الإنترنت فقط عند عدم وجود الملف في الكاش.
  // v135 Cache First Permanent: أي صفحة أو ملف محلي يرجع من Cache Storage أولاً دائماً؛ الإنترنت أول مرة فقط.

  event.respondWith((async()=>{
    const hit = await matchFromCaches(req, isNavigation, url);
    if(hit) return hit;
    try {
      const fresh = await fetch(req, {cache:'force-cache'});
      await cacheResponse(req, fresh, isNavigation);
      return fresh;
    } catch(e) {
      return await matchFromCaches(new Request('index.html'), true, new URL('index.html', self.location.href)) || Response.error();
    }
  })());
});

self.addEventListener('message', event => {
  if(event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if(event.data && event.data.type === 'CACHE_URLS') {
    const urls = Array.isArray(event.data.urls) ? event.data.urls : [];
    event.waitUntil((async()=>{
      const pages = await caches.open(PAGE_CACHE_NAME);
      const assets = await caches.open(ASSET_CACHE_NAME);
      await Promise.allSettled(urls.map(async href => {
        try {
          const req = new Request(href, {cache:'force-cache'});
          const u = new URL(href);
          const cache = /\.html?$/.test(u.pathname) || u.pathname.endsWith('/') ? pages : assets;
          const hit = await cache.match(req, {ignoreSearch:true});
          if(hit) return;
          const res = await fetch(req);
          if(res && res.ok) await cache.put(req, res.clone());
        } catch(e) {}
      }));
    })());
  }
});

// v101NavigationLocalFirst: الصفحات الجديدة مضافة للكاش وتعمل من التخزين المحلي بعد أول تحميل.
