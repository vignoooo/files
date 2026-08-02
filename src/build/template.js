import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Deterministic fallback builder: renders a clean one-page site from brief.json
// with a palette chosen per business, so every site still looks bespoke-ish
// even without an AI engine available.

const PALETTES = [
  { bg: "#faf7f2", ink: "#2b2118", accent: "#b4552d", soft: "#efe4d4" },
  { bg: "#f4f7f6", ink: "#15252b", accent: "#1f6f64", soft: "#dcebe7" },
  { bg: "#f7f5fa", ink: "#231b2e", accent: "#5b3fa8", soft: "#e7e0f4" },
  { bg: "#fbf6f4", ink: "#2e1a1a", accent: "#a8323e", soft: "#f3dfdc" },
  { bg: "#f5f7fb", ink: "#16233a", accent: "#2b5fad", soft: "#dfe7f4" }
];

function hash(str) {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildWithTemplate(cfg, lead, siteDir) {
  const brief = JSON.parse(readFileSync(join(siteDir, "brief.json"), "utf8"));
  const b = brief.business;
  const p = PALETTES[hash(b.name) % PALETTES.length];
  const fr = brief.language === "fr";
  const t = fr
    ? { about: "Bienvenue", hours: "Heures d'ouverture", reviews: "Ce que disent nos clients", contact: "Nous joindre", call: "Appelez-nous", map: "Voir sur la carte", gallery: "Galerie", preview: "Aperçu de site préparé pour" }
    : { about: "Welcome", hours: "Opening hours", reviews: "What customers say", contact: "Get in touch", call: "Call us", map: "View on the map", gallery: "Gallery", preview: "Site preview prepared for" };

  const stars = b.rating ? "★".repeat(Math.round(b.rating)) + "☆".repeat(5 - Math.round(b.rating)) : "";
  const hero = brief.photos[0]
    ? `background-image:linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)),url('${brief.photos[0]}');background-size:cover;background-position:center;color:#fff`
    : `background:linear-gradient(135deg,${p.accent},${p.ink});color:#fff`;

  const gallery = brief.photos.slice(1).map((ph) =>
    `<img src="${ph}" alt="${esc(b.name)}" loading="lazy">`).join("\n      ");

  const reviews = (b.reviews || []).map((r) => `
      <blockquote>
        <p>“${esc(r.text)}”</p>
        <footer>— ${esc(r.author)} <span aria-label="${r.rating} out of 5">${"★".repeat(r.rating || 5)}</span></footer>
      </blockquote>`).join("\n");

  const hours = (b.hours || []).map((h) => `<li>${esc(h)}</li>`).join("\n        ");

  const html = `<!doctype html>
<html lang="${brief.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(b.name)} — ${esc(b.category)}</title>
<meta name="description" content="${esc(b.name)}, ${esc(b.category)}${b.address ? " — " + esc(b.address) : ""}">
<style>
  :root{--bg:${p.bg};--ink:${p.ink};--accent:${p.accent};--soft:${p.soft}}
  *{box-sizing:border-box;margin:0}
  body{font-family:Georgia,'Times New Roman',serif;background:var(--bg);color:var(--ink);line-height:1.6}
  header.hero{${hero};min-height:62vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:4rem 1.5rem}
  .hero h1{font-size:clamp(2.2rem,6vw,4rem);letter-spacing:.02em}
  .hero p{font-size:1.15rem;opacity:.92;margin-top:.75rem;font-family:system-ui,sans-serif;text-transform:uppercase;letter-spacing:.2em}
  .stars{margin-top:1rem;color:#ffd76a;font-size:1.3rem}
  section{max-width:880px;margin:0 auto;padding:3.5rem 1.5rem}
  h2{font-size:1.9rem;margin-bottom:1.2rem;color:var(--accent)}
  .gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.75rem}
  .gallery img{width:100%;height:220px;object-fit:cover;border-radius:10px}
  blockquote{background:var(--soft);border-left:4px solid var(--accent);padding:1.2rem 1.4rem;border-radius:8px;margin-bottom:1rem}
  blockquote footer{margin-top:.6rem;font-family:system-ui,sans-serif;font-size:.9rem}
  ul.hours{list-style:none;font-family:system-ui,sans-serif}
  ul.hours li{padding:.35rem 0;border-bottom:1px solid var(--soft)}
  .contact a.btn{display:inline-block;background:var(--accent);color:#fff;text-decoration:none;padding:.8rem 1.6rem;border-radius:999px;font-family:system-ui,sans-serif;margin:.4rem .4rem 0 0}
  .contact a.btn:focus{outline:3px solid var(--ink);outline-offset:2px}
  footer.site{background:var(--ink);color:var(--bg);text-align:center;padding:2rem 1.5rem;font-family:system-ui,sans-serif;font-size:.85rem}
</style>
</head>
<body>
<header class="hero">
  <h1>${esc(b.name)}</h1>
  <p>${esc(b.category)}${b.address ? " · " + esc(b.address.split(",")[0]) : ""}</p>
  ${stars ? `<div class="stars" aria-label="${b.rating} out of 5 (${b.ratingCount})">${stars} <small>(${b.ratingCount})</small></div>` : ""}
</header>
<main>
<section>
  <h2>${t.about}</h2>
  <p>${esc(b.name)}${b.address ? ` — ${esc(b.address)}` : ""}.</p>
</section>
${gallery ? `<section><h2>${t.gallery}</h2><div class="gallery">\n      ${gallery}\n</div></section>` : ""}
${reviews ? `<section><h2>${t.reviews}</h2>${reviews}</section>` : ""}
${hours ? `<section><h2>${t.hours}</h2><ul class="hours">\n        ${hours}\n</ul></section>` : ""}
<section class="contact">
  <h2>${t.contact}</h2>
  ${b.address ? `<p>${esc(b.address)}</p>` : ""}
  ${b.phone ? `<a class="btn" href="tel:${esc(b.phone.replace(/[^+\d]/g, ""))}">${t.call}: ${esc(b.phone)}</a>` : ""}
  ${b.mapsUrl ? `<a class="btn" href="${esc(b.mapsUrl)}" rel="noopener">${t.map}</a>` : ""}
</section>
</main>
<footer class="site">${t.preview} ${esc(b.name)}</footer>
</body>
</html>
`;
  writeFileSync(join(siteDir, "index.html"), html);
}
