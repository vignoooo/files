import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/store.js";
import { scoreLead, rankLeads } from "../src/score.js";
import { recordTouch, recordReply, nextTouchDue, isLapsed, crmReport, draftFollowup, TOUCH_OFFSETS_DAYS } from "../src/crm.js";
import { runQa } from "../src/qa.js";

const DAY = 86400000;

function makeLead(over = {}) {
  return {
    id: `t:${Math.random()}`, source: "test", slug: over.slug || "test-biz", name: "Test Biz",
    category: "bakery", address: "1 Main St", phone: "+1 555 0100",
    rating: 4.7, ratingCount: 150, hours: ["Mo-Fr 9-5"],
    reviews: [{ rating: 5, text: "great", author: "A" }], photoRefs: [], mapsUrl: "",
    ...over
  };
}

test("scoring rewards proof and reachability, punishes no phone", () => {
  const strong = scoreLead(makeLead());
  const weak = scoreLead(makeLead({ phone: "", rating: null, ratingCount: 0, reviews: [], hours: [] }));
  assert.ok(strong > 70, `strong lead scored ${strong}`);
  assert.ok(weak < 20, `weak lead scored ${weak}`);
  const ranked = rankLeads([makeLead({ phone: "", slug: "b" }), makeLead({ slug: "a" })]);
  assert.equal(ranked[0].slug, "a");
});

test("five-touch sequence: due dates, cap, and lapse", () => {
  const dir = mkdtempSync(join(tmpdir(), "ws-crm-"));
  const store = new Store(dir);
  store.add(makeLead());
  const lead = store.get("test-biz");
  store.advance(lead, "pitched");

  // Touch 1 due immediately, touch 2 due +3 days.
  assert.ok(nextTouchDue(lead).getTime() <= Date.now());
  recordTouch(store, lead);
  const t0 = Date.parse(lead.touches[0].at);
  assert.equal(nextTouchDue(lead).getTime(), t0 + TOUCH_OFFSETS_DAYS[1] * DAY);

  for (let i = 1; i < TOUCH_OFFSETS_DAYS.length; i++) recordTouch(store, lead);
  assert.throws(() => recordTouch(store, lead), /already sent/);
  assert.equal(nextTouchDue(lead), null);

  // Not lapsed right away; lapsed after the quiet period.
  assert.equal(isLapsed(lead), false);
  assert.equal(isLapsed(lead, Date.now() + 20 * DAY), true);
  const report = crmReport(store, Date.now() + 20 * DAY);
  assert.equal(report.lapsed.length, 1);
  assert.equal(store.get("test-biz").status, "lapsed");
});

test("replies sort leads into warm / lost / later", () => {
  const dir = mkdtempSync(join(tmpdir(), "ws-reply-"));
  const store = new Store(dir);
  store.add(makeLead());
  const lead = store.get("test-biz");
  store.advance(lead, "pitched");
  assert.equal(recordReply(store, lead, "interested"), "warm");
  assert.throws(() => recordReply(store, lead, "maybe"), /disposition/);
});

test("follow-up drafts land in outbox and stay manual", () => {
  const outboxDir = mkdtempSync(join(tmpdir(), "ws-fu-"));
  const cfg = { language: "en", operator: { name: "G", email: "" }, outboxDir };
  const lead = makeLead({ liveUrl: "https://x.example" });
  const file = draftFollowup(cfg, lead, 2);
  assert.match(file, /test-biz-touch-2\.md/);
});

test("QA catches broken sites and passes good ones", async () => {
  const cfg = { chromePath: "/nonexistent" }; // force static-only
  const lead = makeLead();

  const bad = mkdtempSync(join(tmpdir(), "ws-qa-bad-"));
  writeFileSync(join(bad, "index.html"), "<html><body>hello</body></html>");
  const badReport = await runQa(cfg, lead, bad);
  assert.equal(badReport.passed, false);
  assert.ok(badReport.issues.some((i) => /viewport/.test(i)));
  assert.ok(badReport.issues.some((i) => /business name/.test(i)));

  const good = mkdtempSync(join(tmpdir(), "ws-qa-good-"));
  mkdirSync(join(good, "assets"));
  writeFileSync(join(good, "assets", "p.jpg"), "x");
  writeFileSync(join(good, "index.html"), `<!doctype html><html lang="en"><head><title>Test Biz</title>
<meta name="viewport" content="width=device-width"><meta name="description" content="Test Biz bakery">
</head><body>${"x".repeat(500)}<h1>Test Biz</h1><img src="assets/p.jpg" alt="shop"></body></html>`);
  const goodReport = await runQa(cfg, lead, good);
  assert.equal(goodReport.passed, true, JSON.stringify(goodReport.issues));

  const broken = mkdtempSync(join(tmpdir(), "ws-qa-ref-"));
  writeFileSync(join(broken, "index.html"), `<!doctype html><html lang="en"><head><title>Test Biz</title>
<meta name="viewport" content="w"><meta name="description" content="d"></head>
<body>${"x".repeat(500)}Test Biz<img src="assets/missing.jpg" alt="x"></body></html>`);
  const brokenReport = await runQa(cfg, lead, broken);
  assert.ok(brokenReport.issues.some((i) => /broken local reference/.test(i)));
});
