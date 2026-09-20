/* Cache the PUBLIC interface only. Never cache /api/, financial responses,
   authentication, JSON downloads, or user images. Offline edits use the ledger. */
const CACHE='assets-public-shell-v5-20260920';
const FILES=['./','./index.html','./app.js','./styles.css','./logo.svg','./tickmark.png','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('vault-public-shell-')||k.startsWith('assets-public-shell-'))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/api/'))return;
  const allowed=FILES.some(path=>new URL(path,self.registration.scope).pathname===url.pathname);
  if(!allowed)return;
  const isAppPage=['./','./index.html'].some(path=>new URL(path,self.registration.scope).pathname===url.pathname);
  const cacheKey=event.request.mode==='navigate'&&isAppPage?new Request(new URL('./index.html',self.registration.scope)):new Request(url.origin+url.pathname);
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok&&response.type==='basic'){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(cacheKey,copy));}
    return response;
  }).catch(async()=>{const hit=await caches.match(cacheKey);return hit||new Response('Open Assets online once to install the offline interface.',{status:503,headers:{'Content-Type':'text/plain'}});}));
});
