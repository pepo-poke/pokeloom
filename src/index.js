const ALLOWED_ORIGIN = "https://pokeloom.pages.dev";
const UPSTREAM_BASE = "https://silph-scope.com/api/ladder";
const CACHE_TTL = 3600;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API endpoint: /api/ladder?format=double (or singles)
    if (url.pathname === "/api/ladder") {
      const origin = request.headers.get("Origin");
      if (origin && origin !== url.origin && origin !== ALLOWED_ORIGIN) {
        return new Response("Forbidden origin", { status: 403 });
      }

      const corsOrigin = origin || url.origin;
      const headers = corsHeaders(corsOrigin);

      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers });
      }
      if (request.method !== "GET") {
        return new Response("Method not allowed", { status: 405, headers });
      }

      const format = url.searchParams.get("format") || "double";
      if (!["double", "singles"].includes(format)) {
        return new Response("Invalid format", { status: 400, headers });
      }

      const upstreamUrl = `${UPSTREAM_BASE}?format=${format}`;
      const cacheKey = new Request(upstreamUrl, { method: "GET" });
      const cache = caches.default;

      let cached = await cache.match(cacheKey);
      if (cached) {
        const responseHeaders = new Headers(cached.headers);
        for (const [key, value] of Object.entries(headers)) responseHeaders.set(key, value);
        responseHeaders.set("X-PokeLoom-Cache", "HIT");
        return new Response(cached.body, { status: cached.status, headers: responseHeaders });
      }

      try {
        const upstream = await fetch(upstreamUrl, {
          headers: { "Accept": "application/json" }
        });
        const responseHeaders = new Headers(upstream.headers);
        for (const [key, value] of Object.entries(headers)) responseHeaders.set(key, value);
        responseHeaders.set("Cache-Control", `public, max-age=${CACHE_TTL}`);
        responseHeaders.set("X-PokeLoom-Cache", "MISS");

        const response = new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers: responseHeaders
        });

        if (upstream.ok) {
          const cacheResponse = response.clone();
          cacheResponse.headers.set("Cache-Control", `public, max-age=${CACHE_TTL}`);
          ctx.waitUntil(cache.put(cacheKey, cacheResponse));
        }
        return response;
      } catch (error) {
        return new Response(JSON.stringify({
          error: "Upstream API request failed",
          detail: error instanceof Error ? error.message : String(error)
        }), {
          status: 502,
          headers: { ...headers, "Content-Type": "application/json; charset=utf-8" }
        });
      }
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response("PokéLoom Worker is running", {
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }

    // Static website
    return env.ASSETS.fetch(request);
  }
};
