const CACHE_VERSION = 'cash-top-v188-1-expense-vouchers-warehouses-login';
const STATIC_CACHE = CACHE_VERSION + '-static';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';
const PRECACHE_URLS = [
  './','index.html','login.html','dashboard.html','cashier.html','branches.html','employees.html','accounts.html','customers.html','products.html','invoices.html', 'vouchers.html','purchase-entry.html','purchases.html','suppliers.html','settings.html','inventory.html','expenses.html','finance.html','analytics.html','notifications.html','print-settings.html','tax-settings.html','units.html','warehouse.html','waste.html','workers.html','representatives.html','representative-dashboard.html','oscar-logo.png','icon-64.png','icon-192.png','icon-512.png'
];
function isApi(url){ return /api\/rtdb|vercel\.app\/api\/rtdb|firebaseio\.com|googleapis\.com|gstatic\.com|mongodb|cloudfunctions|firestore|googleusercontent/i.test(url.href); }
self.addEventListener('install', event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(STATIC_CACHE).then(cache=>cache.addAll(PRECACHE_URLS.map(u=>new Request(u,{cache:'reload'}))).catch(()=>null)));
});
self.addEventListener('activate', event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>!k.startsWith(CACHE_VERSION)).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event=>{
  const data=event.data||{};
  if(data.type==='CACHE_URLS' && Array.isArray(data.urls)){
    event.waitUntil(caches.open(STATIC_CACHE).then(cache=>Promise.allSettled(data.urls.map(u=>cache.add(new Request(u,{cache:'reload'}))))));
  }
  if(data.type==='CACHE_CURRENT_PAGE' && data.url){
    event.waitUntil(caches.open(RUNTIME_CACHE).then(cache=>fetch(data.url,{cache:'reload'}).then(r=>{ if(r && r.ok) return cache.put(data.url,r.clone()); }).catch(()=>null)));
  }
});
self.addEventListener('fetch', event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(isApi(url)) return;
  const isPage = req.mode==='navigate' || /\.html($|\?)/i.test(url.pathname) || url.pathname.endsWith('/');
  if(isPage || url.origin===self.location.origin){
    event.respondWith((async()=>{
      const cached=await caches.match(req,{ignoreSearch:isPage});
      if(cached){
        event.waitUntil(fetch(req).then(res=>{ if(res&&res.ok) return caches.open(isPage?STATIC_CACHE:RUNTIME_CACHE).then(c=>c.put(req,res.clone())); }).catch(()=>null));
        return cached;
      }
      try{
        const res=await fetch(req);
        if(res && res.ok){ const cache=await caches.open(isPage?STATIC_CACHE:RUNTIME_CACHE); cache.put(req,res.clone()); }
        return res;
      }catch(e){
        return caches.match('index.html') || Response.error();
      }
    })());
  }
});
