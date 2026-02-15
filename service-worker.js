/* BenchMark Pro - offline cache (v3.2.1) */
const CACHE_NAME = "benchmark-pro-cache-v321";
const CORE = ["./","./index.html","./manifest.json","./service-worker.js","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install",(e)=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",(e)=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE_NAME?caches.delete(k):Promise.resolve()))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",(e)=>{
  const req=e.request; const url=new URL(req.url);
  const accept=req.headers.get("accept")||"";
  const isHtml=accept.includes("text/html")||url.pathname.endsWith("/")||url.pathname.endsWith("/index.html");
  if(url.origin===self.location.origin){
    if(isHtml){
      e.respondWith(fetch(req).then(resp=>{const copy=resp.clone(); caches.open(CACHE_NAME).then(c=>c.put(req,copy)); return resp;}).catch(()=>caches.match(req)));
      return;
    }
    e.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
    return;
  }
  e.respondWith(fetch(req).catch(()=>caches.match(req)));
});
