import { createFileRoute } from "@tanstack/react-router";

// Public demo proxy for websmith demos.
// URL shape: /d/{token}/{...path}
// Mirrors src/routes/api/public/preview-proxy.$token.$.ts, with two differences:
// - looks up public.websmith_demos by token (instead of projects)
// - no comment-pin bridge injection (plain public demos, not portal previews)
//
// INSTALL: copy this file to src/routes/d.$token.$.ts in the vigno app repo
// (github.com/vignoooo/vigno). No migration needed — websmith_demos is live.

export const Route = createFileRoute("/d/$token/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => handle(request, params as any),
      POST: async ({ request, params }) => handle(request, params as any),
    },
  },
});

async function handle(request: Request, params: { token: string; _splat?: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: demo } = await supabaseAdmin
    .from("websmith_demos")
    .select("id, upstream_url, ready, retired_at")
    .eq("token", params.token)
    .maybeSingle();

  if (!demo || !demo.ready || demo.retired_at || !demo.upstream_url) {
    return new Response("Démo indisponible", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  }

  let upstreamBase: URL;
  try { upstreamBase = new URL(demo.upstream_url); } catch { return new Response("Bad upstream", { status: 500 }); }

  const splat = params._splat ?? "";
  const incoming = new URL(request.url);
  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(splat, upstreamBase.origin + (upstreamBase.pathname.endsWith("/") ? upstreamBase.pathname : upstreamBase.pathname + "/"));
  } catch {
    return new Response("Bad path", { status: 400 });
  }
  // SSRF guard: the resolved upstream MUST stay on the same origin as the demo's upstream_url.
  if (upstreamUrl.origin !== upstreamBase.origin) {
    return new Response("Forbidden upstream", { status: 400, headers: { "X-Robots-Tag": "noindex" } });
  }
  upstreamUrl.search = incoming.search;

  const reqHeaders = new Headers(request.headers);
  reqHeaders.delete("host");
  reqHeaders.delete("cookie"); // don't forward vigno cookies to upstream
  reqHeaders.set("accept-encoding", "identity");

  // Follow redirects SERVER-SIDE (https only, max 5 hops) so the visitor's
  // address bar never leaves vigno.ca — hosting providers love to bounce
  // between deployment aliases.
  let upstream: Response;
  let finalUrl = upstreamUrl;
  try {
    const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
    for (let hop = 0; ; hop++) {
      upstream = await fetch(finalUrl.toString(), {
        method: request.method,
        headers: reqHeaders,
        body,
        redirect: "manual",
      });
      if (upstream.status < 300 || upstream.status >= 400) break;
      const loc = upstream.headers.get("location");
      if (!loc || hop >= 5) break;
      const next = new URL(loc, finalUrl);
      if (next.protocol !== "https:") break;
      finalUrl = next;
    }
  } catch (e: any) {
    return new Response(`Upstream fetch failed: ${e?.message ?? "error"}`, { status: 502 });
  }
  // Everything below rewrites against the origin that actually served the page.
  const servedBase = new URL(finalUrl.origin + "/");
  upstreamBase = servedBase;
  upstreamUrl = finalUrl;

  const proxyPrefix = `/d/${params.token}/`;
  const outHeaders = new Headers();
  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  outHeaders.set("content-type", contentType);
  outHeaders.set("cache-control", "no-store");
  outHeaders.set("x-robots-tag", "noindex, nofollow");
  // frame-blocking headers intentionally not copied

  if (upstream.status >= 300 && upstream.status < 400) {
    const loc = upstream.headers.get("location");
    if (loc) {
      const abs = new URL(loc, upstreamUrl);
      if (abs.origin === upstreamBase.origin) {
        const rel = abs.pathname.replace(/^\//, "") + abs.search + abs.hash;
        outHeaders.set("location", proxyPrefix + rel);
      } else {
        outHeaders.set("location", abs.toString());
      }
    }
    return new Response(null, { status: upstream.status, headers: outHeaders });
  }

  const isHtml = contentType.includes("text/html");
  const isCss = contentType.includes("text/css");

  if (!isHtml && !isCss) {
    return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
  }

  let body = await upstream.text();
  const upstreamOrigin = upstreamBase.origin;

  const rewriteUrl = (raw: string): string => {
    if (!raw) return raw;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:") || trimmed.startsWith("mailto:") || trimmed.startsWith("tel:") || trimmed.startsWith("javascript:") || trimmed.startsWith("#")) return raw;
    try {
      const abs = new URL(trimmed, upstreamUrl);
      if (abs.origin !== upstreamOrigin) return abs.toString(); // leave cross-origin as-is
      const rel = abs.pathname.replace(/^\//, "") + abs.search + abs.hash;
      return proxyPrefix + rel;
    } catch { return raw; }
  };

  if (isHtml) {
    body = body.replace(/\b(href|src|action|poster|data)\s*=\s*(["'])([^"']*)\2/gi, (_m, attr, q, val) => {
      return `${attr}=${q}${rewriteUrl(val)}${q}`;
    });
    body = body.replace(/\bsrcset\s*=\s*(["'])([^"']*)\1/gi, (_m, q, val) => {
      const rewritten = val.split(",").map((part: string) => {
        const [u, ...rest] = part.trim().split(/\s+/);
        return [rewriteUrl(u), ...rest].join(" ");
      }).join(", ");
      return `srcset=${q}${rewritten}${q}`;
    });
    body = body.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (_m, q, val) => `url(${q}${rewriteUrl(val)}${q})`);
  } else if (isCss) {
    body = body.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (_m, q, val) => `url(${q}${rewriteUrl(val)}${q})`);
  }

  return new Response(body, { status: upstream.status, headers: outHeaders });
}
