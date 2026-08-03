import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nowIso } from "./util.js";
import { signature } from "./pitch.js";

// Lightweight CRM over the lead store. A lead enters the CRM when its first
// pitch is drafted ("pitched"). From there:
//   touches:  the five-touch sequence, offsets in days from the first touch
//   reply:    operator records the outcome -> warm / lost / later
//   lapsed:   sequence exhausted + quiet period -> stop chasing
export const TOUCH_OFFSETS_DAYS = [0, 3, 7, 14, 30];
const LAPSE_QUIET_DAYS = 14;

const DAY_MS = 86400000;

export function recordTouch(store, lead, channel = "email") {
  lead.touches = lead.touches || [];
  if (lead.touches.length >= TOUCH_OFFSETS_DAYS.length) {
    throw new Error(`${lead.name}: all ${TOUCH_OFFSETS_DAYS.length} touches already sent`);
  }
  lead.touches.push({ n: lead.touches.length + 1, channel, at: nowIso() });
  store.save();
  return lead.touches.length;
}

export function recordReply(store, lead, disposition) {
  const map = { interested: "warm", no: "lost", later: "later" };
  const status = map[disposition];
  if (!status) throw new Error(`disposition must be one of: ${Object.keys(map).join(", ")}`);
  lead.reply = { disposition, at: nowIso() };
  store.advance(lead, status);
  return status;
}

export function markWon(store, lead) {
  store.advance(lead, "won");
}

// Next follow-up due date, or null if the lead shouldn't be chased.
export function nextTouchDue(lead, now = Date.now()) {
  if (!["pitched", "later"].includes(lead.status)) return null;
  const touches = lead.touches || [];
  if (touches.length >= TOUCH_OFFSETS_DAYS.length) return null;
  if (touches.length === 0) return new Date(now);
  const first = Date.parse(touches[0].at);
  return new Date(first + TOUCH_OFFSETS_DAYS[touches.length] * DAY_MS);
}

export function isLapsed(lead, now = Date.now()) {
  if (lead.status !== "pitched") return false;
  const touches = lead.touches || [];
  if (touches.length < TOUCH_OFFSETS_DAYS.length) return false;
  return now - Date.parse(touches.at(-1).at) > LAPSE_QUIET_DAYS * DAY_MS;
}

export function crmReport(store, now = Date.now()) {
  const inCrm = store.leads.filter((l) => ["pitched", "warm", "later", "lost", "won", "lapsed"].includes(l.status));
  const due = [];
  for (const lead of inCrm) {
    if (isLapsed(lead, now)) store.advance(lead, "lapsed");
    const dueAt = nextTouchDue(lead, now);
    if (dueAt && dueAt.getTime() <= now) due.push({ lead, touchN: (lead.touches || []).length + 1 });
  }
  return {
    due,
    warm: inCrm.filter((l) => l.status === "warm"),
    won: inCrm.filter((l) => l.status === "won"),
    lost: inCrm.filter((l) => l.status === "lost"),
    lapsed: inCrm.filter((l) => l.status === "lapsed"),
    active: inCrm.filter((l) => ["pitched", "later"].includes(l.status))
  };
}

// Short follow-up drafts. Touch 1 is the full pitch (src/pitch.js); touches 2-5
// rotate angles per the cold-email skill: nudge -> proof + price -> ownership ->
// breakup. Written to the outbox for the operator to send.
export function followupContent(cfg, lead, touchN) {
  const fr = cfg.language === "fr";
  const url = lead.liveUrl || "";
  const bodies = fr ? [
    null,
    `Bonjour — je voulais m'assurer que mon courriel s'est bien rendu. Le site que j'ai monté pour ${lead.name} est toujours en ligne ici : ${url}. Deux minutes suffisent pour y jeter un œil.`,
    `Bonjour — un de mes clients a vu ses réservations grimper de 38 % le mois où son nouveau site est entré en ligne; le site s'est payé en six semaines. Celui de ${lead.name} est prêt : ${url}. Un site comme ça part à 999 $, en ligne en moins de 7 jours. Ça vous parle?`,
    `Bonjour — une chose qui distingue mon offre : vous êtes propriétaire de tout. Pas de plateforme qui vous retient, réservations et formulaires inclus sans frais de modules, et les modifications se font en moins de 24 h. Le site de ${lead.name} vous attend : ${url}.`,
    `Bonjour — je fais le ménage de mes projets et le site de ${lead.name} sera bientôt retiré. Si vous voulez le garder, répondez à ce courriel et je m'occupe de tout.`
  ] : [
    null,
    `Hi — just making sure my note reached you. The site I put together for ${lead.name} is still live here: ${url}. It takes two minutes to look over.`,
    `Hi — one of my clients saw bookings jump 38% the month their new site went live; it paid for itself in six weeks. The ${lead.name} site is ready to go: ${url}. A site like this starts at $999, live in under 7 days. Worth a look?`,
    `Hi — one thing that sets my offer apart: you own everything. No platform lock-in, bookings and forms built in with no plugin fees, and edits go live in under 24h. The ${lead.name} site is waiting: ${url}.`,
    `Hi — I'm tidying up my projects and the ${lead.name} site will come down soon. If you'd like to keep it, just reply and I'll handle everything.`
  ];
  const body = bodies[touchN - 1];
  if (!body) throw new Error(`no follow-up template for touch ${touchN}`);
  const subject = fr ? `Re: un site web pour ${lead.name}` : `Re: a website for ${lead.name}`;
  return { subject, body };
}

export function draftFollowup(cfg, lead, touchN) {
  const { subject, body } = followupContent(cfg, lead, touchN);
  mkdirSync(cfg.outboxDir, { recursive: true });
  const file = join(cfg.outboxDir, `${lead.slug}-touch-${touchN}.md`);
  writeFileSync(file, `---
business: ${lead.name}
touch: ${touchN} of ${TOUCH_OFFSETS_DAYS.length}
site: ${lead.liveUrl || ""}
drafted: ${nowIso()}
status: DRAFT — review and send manually
---

Subject: ${subject}

${body}

${signature(cfg)}
`);
  return file;
}
