const CACHE_VERSION='v184-quantity-by-price-cache-first';
const CACHE_NAME='cashtop-pages-'+CACHE_VERSION;
const PRECACHE=["./", "DATABASE_STRUCTURE.md", "README.md", "accounts.html", "admin.html", "analytics.html", "app-version.json", "backup.html", "barcode-labels.html", "branches.html", "cashier.html", "categories.html", "coupons.html", "customers.html", "dashboard.html", "digital-menu.html", "employees.html", "expenses.html", "finance.html", "icon-192.png", "icon-512.png", "icon-64.png", "index.html", "inventory.html", "invoice-payment-settings.html", "invoice-view.html", "invoices.html", "login.html", "loyalty-points.html", "manifest.json", "manufacturing.html", "menu-settings.html", "mobile-scanner.html", "notifications.html", "oscar-logo.png", "print-settings.html", "product-offers.html", "products.html", "purchase-data.html", "purchase-entry.html", "purchase-reference.html", "purchase-returns.html", "purchases.html", "representative-dashboard.html", "representatives.html", "settings.html", "shortcuts.html", "suppliers.html", "sw.js", "sync-loading.html", "tax-settings.html", "units.html", "warehouse.html", "waste.html", "workers.html"];
const API_BLOCK=['/api/rtdb','vercel.app/api/rtdb','firebaseio.com','googleapis.com','gstatic.com','firestore.googleapis.com','googleusercontent.com','cloudfunctions.net'];
function isApi(url){const s=String(url||'');return API_BLOCK.some(x=>s.includes(x));}
function sameOrigin(req){try{return new URL(req.url).origin===self.location.origin;}catch(e){return false;}}
async function putSafe(cache,req,res){try{if(res&&res.ok) await cache.put(req,res.clone());}catch(e){}}
async function cacheFirst(req){
  const cache=await caches.open(CACHE_NAME);
  const url=new URL(req.url);
  const candidates=[req,url.pathname.slice(1)||'./','./'+(url.pathname.split('/').pop()||'index.html'),'index.html','./'];
  for(const c of candidates){
    const hit=await caches.match(c,{ignoreSearch:true}).catch(()=>null);
    if(hit){
      fetch(req).then(res=>putSafe(cache,req,res)).catch(()=>null);
      return hit;
    }
  }
  try{
    const fresh=await fetch(req);
    await putSafe(cache,req,fresh);
    return fresh;
  }catch(e){
    return (await caches.match('index.html')) || (await caches.match('./')) || new Response('Offline',{status:503,statusText:'Offline'});
  }
}
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.allSettled(PRECACHE.filter(Boolean).filter(u=>!isApi(u)).map(u=>cache.add(new Request(u,{cache:'no-cache'}))));
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const keys=await caches.keys();
    for(const k of keys.filter(k=>k.startsWith('cashtop-pages-')&&k!==CACHE_NAME)){
      try{
        const old=await caches.open(k);
        const reqs=await old.keys();
        for(const req of reqs){
          if(await cache.match(req)) continue;
          const res=await old.match(req);
          if(res) await cache.put(req,res.clone());
        }
      }catch(e){}
    }
    await Promise.allSettled(keys.filter(k=>k.startsWith('cashtop-pages-')&&k!==CACHE_NAME).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  const data=event.data||{};
  if(data.type==='CACHE_URLS'&&Array.isArray(data.urls)){
    event.waitUntil((async()=>{
      const cache=await caches.open(CACHE_NAME);
      await Promise.allSettled(data.urls.filter(Boolean).filter(u=>!isApi(u)).map(u=>cache.add(new Request(u,{cache:'no-cache'}))));
    })());
  }
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  if(isApi(req.url)){event.respondWith(fetch(req));return;}
  if(!sameOrigin(req)){event.respondWith(fetch(req).catch(()=>caches.match(req)));return;}
  event.respondWith(cacheFirst(req));
});
