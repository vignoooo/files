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
