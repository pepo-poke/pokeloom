const CACHE_TTL = 3600;
const UPSTREAM = "https://silph-scope.com";
function jsonError(message,status=400){return new Response(JSON.stringify({error:message}),{status,headers:{"Content-Type":"application/json; charset=utf-8"}});}
function corsHeaders(origin){return {"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"};}
export default {async fetch(request,env,ctx){
 const url=new URL(request.url); if(url.pathname==="/health")return new Response("PokéLoom Worker is running");
 let path=null;
 if(url.pathname==="/api/leaderboard"||url.pathname==="/api/dexindex"){const f=url.searchParams.get("format")||"double";if(!["double","singles"].includes(f))return jsonError("Invalid format");path=url.pathname+"?format="+f;}
 else if(url.pathname==="/api/items"||url.pathname==="/api/moves")path=url.pathname;
 else {const m=url.pathname.match(/^\/api\/pokemon\/(\d+)$/);if(m){const form=url.searchParams.get("form")||"0",f=url.searchParams.get("format")||"double";if(!/^\d+$/.test(form)||!["double","singles"].includes(f))return jsonError("Invalid form or format");path=url.pathname+"?form="+form+"&format="+f;}
 else if(["/api/ladder","/api/ladder-trajectories","/api/ladder-series","/api/player-movers"].includes(url.pathname)){const f=url.searchParams.get("format")||"double";if(!["double","singles"].includes(f))return jsonError("Invalid format");if(url.pathname==="/api/ladder-trajectories"||url.pathname==="/api/ladder-series"){const s=url.searchParams.get("season")||"8";if(!/^\\d+$/.test(s))return jsonError("Invalid season");path=url.pathname+"?format="+f+"&season="+s;}else path=url.pathname+"?format="+f;}}
 if(!path)return env.ASSETS.fetch(request);
 if(request.method!=="GET"&&request.method!=="OPTIONS")return new Response("Method not allowed",{status:405});
 const origin=request.headers.get("Origin");if(origin&&origin!==url.origin)return new Response("Forbidden origin",{status:403});
 const headers=corsHeaders(origin||url.origin);if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
 const target=UPSTREAM+path, key=new Request(target,{method:"GET"}),cache=caches.default,cached=await cache.match(key);
 if(cached){const h=new Headers(cached.headers);Object.entries(headers).forEach(([k,v])=>h.set(k,v));h.set("X-PokeLoom-Cache","HIT");return new Response(cached.body,{status:cached.status,statusText:cached.statusText,headers:h});}
 try{const upstream=await fetch(target,{headers:{Accept:"application/json"}}),h=new Headers(upstream.headers);Object.entries(headers).forEach(([k,v])=>h.set(k,v));h.set("X-PokeLoom-Cache","MISS");h.set("Cache-Control",`public, max-age=${CACHE_TTL}`);const response=new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:h});if(upstream.ok){const copy=response.clone();copy.headers.set("Cache-Control",`public, max-age=${CACHE_TTL}`);ctx.waitUntil(cache.put(key,copy));}return response;}
 catch(e){return new Response(JSON.stringify({error:"Silph Scope API request failed",detail:e instanceof Error?e.message:String(e)}),{status:502,headers:{...headers,"Content-Type":"application/json; charset=utf-8"}});}
}};
