/* دلو ورغوة — عامل الخدمة (PWA) v1
   الصفحات: الشبكة أولاً ثم الكاش عند الانقطاع. الأصول المبنية (/assets/ بأسماء مُجزّأة): كاش أولاً.
   لا يُخزَّن أي طلب إلى Supabase أو أي نطاق خارجي. */
const VER="dw-v1";
const SHELL=["/","/index.html","/manifest.webmanifest","/brand-logo.png","/brand-mark.png","/icon-192.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(VER).then(c=>c.addAll(SHELL).catch(()=>{})).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VER).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  const req=e.request;if(req.method!=="GET")return;
  const url=new URL(req.url);if(url.origin!==self.location.origin)return;
  if(req.mode==="navigate"){
    e.respondWith(fetch(req).then(r=>{const cp=r.clone();caches.open(VER).then(c=>c.put("/index.html",cp));return r;}).catch(()=>caches.match("/index.html")));
    return;
  }
  if(url.pathname.startsWith("/assets/")||/\.(woff2|png|svg|webmanifest)$/.test(url.pathname)){
    e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{if(r.ok){const cp=r.clone();caches.open(VER).then(c=>c.put(req,cp));}return r;})));
  }
});
self.addEventListener("message",e=>{if(e.data==="skipWaiting")self.skipWaiting();});
