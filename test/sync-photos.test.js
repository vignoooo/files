import { test } from "node:test";
import assert from "node:assert/strict";
import { leadPayload, stageFor } from "../src/sync/vigno.js";
import { extractImageUrls, extractSocialLinks } from "../src/enrich/photos.js";

const LEAD = {
  slug: "garage-x", name: "Garage X", category: "auto repair",
  address: "12 Rue King O, Sherbrooke, J1H 1A1", phone: "+1 819 555 0100",
  rating: 4.5, ratingCount: 40, score: 82, mapsUrl: "https://maps.example/x",
  existingSite: { url: "https://old.example", issues: ["no HTTPS"] }
};

test("vigno lead payload maps fields for the CRM", () => {
  const p = leadPayload(LEAD, "https://vigno.ca/d/tok/");
  assert.equal(p.action, "lead");
  assert.equal(p.business_name, "Garage X");
  assert.equal(p.city, "Sherbrooke");
  assert.equal(p.industry, "auto repair");
  assert.equal(p.website, "https://old.example");
  assert.equal(p.source, "websmith");
  assert.equal(p.demo_url, "https://vigno.ca/d/tok/");
  assert.match(p.message, /82\/100/);
});

test("websmith statuses map to VIGNO CRM stages", () => {
  assert.equal(stageFor({ status: "pitched", touches: [] }), "a_contacter");
  assert.equal(stageFor({ status: "pitched", touches: [{}] }), "contacte");
  assert.equal(stageFor({ status: "pitched", touches: [{}, {}] }), "relance");
  assert.equal(stageFor({ status: "warm" }), "repondu");
  assert.equal(stageFor({ status: "won" }), "client");
  assert.equal(stageFor({ status: "lost" }), "perdu");
  assert.equal(stageFor({ status: "lapsed" }), "perdu");
  assert.equal(stageFor({ status: "built" }), null);
});

test("image extraction: og:image first, logos and tiny images skipped", () => {
  const html = `
    <meta property="og:image" content="/img/hero.jpg">
    <img src="/img/logo.png"><img src="pixel.gif">
    <img width="200" src="/img/small.jpg">
    <img width="800" src="https://cdn.example/shop.jpg">
    <img src="/img/team.webp">`;
  const urls = extractImageUrls(html, "https://biz.example/about/");
  assert.deepEqual(urls, [
    "https://biz.example/img/hero.jpg",
    "https://cdn.example/shop.jpg",
    "https://biz.example/img/team.webp"
  ]);
});

test("social link extraction finds profile URLs, skips share widgets", () => {
  const html = `
    <a href="https://www.facebook.com/sharer/sharer.php?u=x">share</a>
    <a href="https://instagram.com/garagex_qc">ig</a>
    <a href="https://www.facebook.com/GarageXQc">fb</a>`;
  const s = extractSocialLinks(html);
  assert.equal(s.instagram, "https://instagram.com/garagex_qc");
  assert.equal(s.facebook, "https://www.facebook.com/GarageXQc");
});

test("published-email extraction ranks business inboxes, drops junk", async () => {
  const { extractEmails } = await import("../src/enrich/contact.js");
  const html = `Contact: <a href="mailto:info@garagex.ca">info@garagex.ca</a>
    hero@2x.png logo.png sentry@wixpress.com
    owner.perso@gmail.com photo@3x.jpg`;
  const emails = extractEmails(html);
  assert.equal(emails[0], "info@garagex.ca");
  assert.ok(!emails.some((e) => e.includes("wixpress")));
  assert.ok(!emails.some((e) => e.endsWith(".png") || e.endsWith(".jpg")));
});

test("auto-send gates refuse until fully configured", async () => {
  const { autoSendReady, inSendWindow, caslFooter } = await import("../src/outreach/send.js");
  const bare = { outreach: { autoSend: true }, operator: {} };
  const r = autoSendReady(bare);
  assert.equal(r.ready, false);
  assert.ok(r.missing.some((m) => m.includes("casl")));
  assert.ok(r.missing.some((m) => m.includes("address")));
  assert.ok(r.missing.some((m) => m.includes("SMTP_PASSWORD")));

  const cfg = { outreach: { windowHours: [9, 17] } };
  assert.equal(inSendWindow(cfg, new Date("2026-08-03T10:00:00")), true);  // Monday 10h
  assert.equal(inSendWindow(cfg, new Date("2026-08-02T10:00:00")), false); // Sunday
  assert.equal(inSendWindow(cfg, new Date("2026-08-03T20:00:00")), false); // evening

  const footer = caslFooter({ operator: { name: "G", company: "VIGNO", address: "1 Rue X, Sherbrooke", email: "info@vigno.ca", url: "vigno.ca" } }, true);
  assert.match(footer, /désabonner/);
  assert.match(footer, /1 Rue X/);
});

test("smtp message building encodes subject and dot-stuffs body", async () => {
  const { buildMessage } = await import("../src/outreach/smtp.js");
  const msg = buildMessage({ from: "\"G\" <info@vigno.ca>", to: "x@y.ca", subject: "un site web pour Café Élan", body: "Bonjour.\n.hidden line\nFin." });
  assert.match(msg, /Subject: =\?UTF-8\?B\?/);
  assert.match(msg, /\r\n\.\.hidden line/);
  assert.match(msg, /List-Unsubscribe|Content-Type: text\/plain/);
});
