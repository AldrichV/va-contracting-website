import handler from "./index.js";

const STATIC_ASSET_PATH =
  /\.(?:css|js|mjs|jpg|jpeg|png|svg|ico|webp|avif|woff2?|webmanifest|json|txt|xml)$/i;

const SECURITY_HEADERS = {
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "Strict-Transport-Security": "max-age=31536000",
};

/** Cache rules for public static files. Hashed build assets never change; photos rarely do. */
function cacheControlFor(pathname) {
  if (pathname.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  if (pathname.startsWith("/images/")) return "public, max-age=2592000, stale-while-revalidate=604800";
  if (pathname === "/sw.js") return "no-cache";
  if (/\.(?:jpg|jpeg|png|webp|avif|svg|ico|woff2?)$/i.test(pathname)) return "public, max-age=604800";
  return null;
}

function withHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  const cacheControl = response.ok ? cacheControlFor(pathname) : null;
  if (cacheControl) headers.set("Cache-Control", cacheControl);
  if (pathname.startsWith("/employee") || pathname.startsWith("/api/")) {
    headers.set("X-Robots-Tag", "noindex");
  }
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (
      (request.method === "GET" || request.method === "HEAD") &&
      (url.pathname.startsWith("/assets/") || STATIC_ASSET_PATH.test(url.pathname))
    ) {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) return withHeaders(assetResponse, url.pathname);
    }

    const response = await handler.fetch(request, env, ctx);
    return withHeaders(response, url.pathname);
  },
};

export default worker;
