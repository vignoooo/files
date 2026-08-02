import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { slugify, writeJson } from "../src/util.js";
import { Store } from "../src/store.js";
import { buildWithTemplate } from "../src/build/template.js";
import { draftPitch } from "../src/pitch.js";

const LEAD = {
  id: "osm:node/1",
  source: "overpass",
  slug: "chez-marcel",
  name: "Chez Marcel",
  category: "restaurant",
  address: "12 Rue Principale, Sherbrooke, J1H 1A1",
  phone: "+1 819-555-0199",
  rating: 4.6,
  ratingCount: 87,
  hours: ["Mo-Fr 11:00-22:00"],
  reviews: [{ rating: 5, text: "Best poutine in town", author: "Alex" }],
  photoRefs: [],
  mapsUrl: "https://www.openstreetmap.org/node/1"
};

test("slugify normalises names", () => {
  assert.equal(slugify("Café Élan & Sons!!"), "cafe-elan-sons");
  assert.equal(slugify(""), "business");
});

test("store lifecycle: add, dedupe, advance", () => {
  const dir = mkdtempSync(join(tmpdir(), "ws-store-"));
  const store = new Store(dir);
  assert.equal(store.add(LEAD), true);
  assert.equal(store.add(LEAD), false);
  const lead = store.get("chez-marcel");
  store.advance(lead, "enriched", { siteDir: "/x" });
  const reloaded = new Store(dir);
  assert.equal(reloaded.get("chez-marcel").status, "enriched");
  assert.equal(reloaded.get("chez-marcel").history.length, 1);
});

test("template builder renders a self-contained site", () => {
  const siteDir = mkdtempSync(join(tmpdir(), "ws-site-"));
  writeJson(join(siteDir, "brief.json"), {
    business: LEAD, photos: [], language: "en", designNotes: ""
  });
  buildWithTemplate({}, LEAD, siteDir);
  const html = readFileSync(join(siteDir, "index.html"), "utf8");
  assert.match(html, /Chez Marcel/);
  assert.match(html, /Best poutine in town/);
  assert.match(html, /Site preview prepared for/);
  assert.doesNotMatch(html, /https?:\/\/(cdn|unpkg|fonts)/);
});

test("pitch draft lands in outbox, marked for manual review", () => {
  const outboxDir = mkdtempSync(join(tmpdir(), "ws-out-"));
  const cfg = { language: "en", operator: { name: "Gabriel", email: "g@example.com" }, outboxDir };
  const { file, subject } = draftPitch(cfg, LEAD, "https://example.com/site");
  assert.ok(existsSync(file));
  const draft = readFileSync(file, "utf8");
  assert.match(draft, /DRAFT — review and send manually/);
  assert.match(draft, /https:\/\/example.com\/site/);
  assert.match(subject, /Chez Marcel/);
});
