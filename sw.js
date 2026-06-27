const CACHE_VERSION = 'v172-sync-settings-cache-fix';
const PAGE_CACHE = 'cashtop-pages-' + CACHE_VERSION;
const ASSET_CACHE = 'cashtop-assets-' + CACHE_VERSION;
const FONT_CACHE = 'cashtop-fonts-' + CACHE_VERSION;
const LEGACY_PREFIXES = ['cashtop-pwa-', 'cashtop-local-pages-', 'cashtop-local-assets-', 'cashtop-font-cache-', 'cashtop-pages-', 'cashtop-assets-', 'cashtop-fonts-'];
const PRECACHE = ["./", "DATABASE_STRUCTURE.md", "README-MONGODB-DIRECT.txt", "README.md", "READ_ME_ADMIN_COMPANY_KEYS.txt", "READ_ME_AUTO_LOGIN_KEY_REFRESH.txt", "READ_ME_CASHIER_CUSTOMER_SEARCH.txt", "READ_ME_CLEAN_RECEIPT_SILENT_SYNC.txt", "READ_ME_EMPTY_SEARCH_DROPDOWNS.txt", "READ_ME_FAST_SYNC_QR_CAMERA.txt", "READ_ME_FULL_OFFLINE_LOCAL_FIRST.txt", "READ_ME_ISOLATED_COMPANY_LOCAL_STORE.txt", "READ_ME_KEYBOARD_SAFE_SYNC.txt", "READ_ME_LEGACY_DATA_MERGE_LOGIN_FIX.txt", "READ_ME_LOCAL_FIRST_DELETE_EDIT.txt", "READ_ME_OFFLINE_DELETE_CLEAR_COMPANY.txt", "READ_ME_OFFLINE_FIRST_SYNC.txt", "READ_ME_RETENTION_45_DAYS_SYNC_FIX.txt", "READ_ME_ROOT_ACCOUNTING_REPORTS_UNITS.txt", "READ_ME_STABLE_AUTO_LOGIN_NO_KEY_CHECK.txt", "READ_ME_SYNC_FIX.txt", "READ_ME_UNIT_STOCK_BIGCODE_MOBILE.txt", "accounts.html", "admin.html", "ai-analysis.html", "analytics.html", "app-version.json", "backup.html", "barcode-labels.html", "branches.html", "cashier.html", "categories.html", "coupons.html", "custom-reports.html", "customers.html", "dashboard.html", "database.rules.json", "digital-menu.html", "employees.html", "expenses.html", "finance.html", "icon-192.png", "icon-512.png", "icon-64.png", "index.html", "inventory.html", "invoice-payment-settings.html", "invoice-view.html", "invoices.html", "local-bridge.js", "login.html", "loyalty-points.html", "manifest.json", "manufacturing.html", "menu-settings.html", "mobile-scanner.html", "notifications.html", "offline-update.js", "oscar-logo.png", "print-settings.html", "product-offers.html", "products.html", "purchase-data.html", "purchase-entry.html", "purchase-reference.html", "purchase-returns.html", "purchases.html", "settings.html", "shortcuts.html", "suppliers.html", "sync-loading.html", "tax-settings.html", "units.html", "warehouse.html", "waste.html", "workers.html", "sw.js"];
const PAGE_RE = /(?:^|\/)[^/?#]*\.html?$/i;
const STATIC_RE = /\.(?:js|css|json|png|jpg|jpeg|svg|webp|ico|woff2?|ttf|map|md|txt)$/i;
function isPageUrl(u){ return u.pathname.endsWith('/') || PAGE_RE.test(u.pathname) || u.pathname.split('/').pop()===''; }
function isSameOrigin(u){ return u.origin === self.location.origin; }
function isExternalApi(u){
  const h = u.hostname;
  return !isSameOrigin(u) || /firebaseio\.com$|googleapis\.com$|gstatic\.com$|vercel\.app$|mongodb|cloudfunctions|firestore|googleusercontent/i.test(h + u.pathname);
}
async function cacheNameForUrl(u){ return isPageUrl(u) ? PAGE_CACHE : ASSET_CACHE; }
async function matchAny(req, opts={}){
  const page = await caches.open(PAGE_CACHE);
  const asset = await caches.open(ASSET_CACHE);
  const font = await caches.open(FONT_CACHE);
  const hit = await page.match(req, {ignoreSearch:true}) || await asset.match(req, {ignoreSearch:true}) || await font.match(req, {ignoreSearch:true});
  if(hit) return hit;
  if(opts.navigation){
    const u = new URL(req.url);
    const pageName = u.pathname.split('/').pop() || 'index.html';
    return await page.match(pageName, {ignoreSearch:true}) || await page.match('index.html', {ignoreSearch:true}) || null;
  }
  return null;
}
async function putCache(urlOrReq){
  try{
    const req = typeof urlOrReq === 'string' ? new Request(urlOrReq, {cache:'reload'}) : urlOrReq;
    const u = new URL(req.url);
    if(isExternalApi(u)) return false;
    const hit = await matchAny(req);
    if(hit) return true;
    const res = await fetch(req, {cache:'reload'});
    if(!res || !res.ok) return false;
    const cache = await caches.open(await cacheNameForUrl(u));
    await cache.put(req, res.clone());
    return true;
  }catch(e){ return false; }
}
async function warmCache(list){
  const queue = [...new Set(list || [])];
  let i = 0;
  const worker = async()=>{
    while(i < queue.length){
      const item = queue[i++];
      await putCache(item);
      await new Promise(r=>setTimeout(r, 20));
    }
  };
  await Promise.all([worker(), worker()]);
}
self.addEventListener('install', event=>{
  self.skipWaiting();
  event.waitUntil(warmCache(PRECACHE));
});
self.addEventListener('activate', event=>{
  event.waitUntil((async()=>{
    const keep = new Set([PAGE_CACHE, ASSET_CACHE, FONT_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.map(n => (LEGACY_PREFIXES.some(p=>n.startsWith(p)) && !keep.has(n)) ? caches.delete(n) : Promise.resolve(false)));
    if(self.registration.navigationPreload){ try{ await self.registration.navigationPreload.disable(); }catch(e){} }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event=>{
  const req = event.request;
  if(req.method !== 'GET') return;
  const u = new URL(req.url);
  if(u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com'){
    event.respondWith((async()=>{
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(req, {ignoreSearch:false});
      if(hit) return hit;
      const res = await fetch(req).catch(()=>null);
      if(res && res.ok) cache.put(req, res.clone()).catch(()=>{});
      return res || Response.error();
    })());
    return;
  }
  if(isExternalApi(u)) return;
  const isNav = req.mode === 'navigate' || (req.headers.get('accept')||'').includes('text/html');
  const cacheable = isNav || isPageUrl(u) || STATIC_RE.test(u.pathname);
  if(!cacheable) return;
  event.respondWith((async()=>{
    const hit = await matchAny(req, {navigation:isNav});
    if(hit) return hit;
    try{
      const res = await fetch(req, {cache:'reload'});
      if(res && res.ok){
        const cache = await caches.open(await cacheNameForUrl(u));
        cache.put(req, res.clone()).catch(()=>{});
      }
      return res;
    }catch(e){
      return (await matchAny(new Request('index.html'), {navigation:true})) || new Response('Offline', {status:503, headers:{'Content-Type':'text/plain;charset=utf-8'}});
    }
  })());
});
self.addEventListener('message', event=>{
  const data = event.data || {};
  if(data.type === 'SKIP_WAITING') self.skipWaiting();
  if(data.type === 'CACHE_URLS'){
    const urls = Array.isArray(data.urls) ? data.urls : [];
    event.waitUntil(warmCache(urls));
  }
  if(data.type === 'CACHE_ALL'){
    event.waitUntil(warmCache(PRECACHE));
  }
});
