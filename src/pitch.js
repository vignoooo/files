import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nowIso } from "./util.js";

// Drafts the personalised first-touch email and drops it in the outbox for the
// OPERATOR to review and send. Websmith never contacts a business directly:
// unsolicited commercial email is regulated (CASL in Canada, CAN-SPAM in the
// US, GDPR/ePrivacy in the EU) and a human must own that decision.
//
// Style follows the cold-email skill: short, their world first, one specific
// real detail up top, one low-friction ask, no pricing in touch 1.
const FR_CATEGORIES = {
  "auto repair": "garages", restaurant: "restaurants", bakery: "boulangeries",
  barber: "salons de coiffure", florist: "fleuristes", cafe: "cafés",
  plumber: "plombiers", butcher: "boucheries", bar: "bars", gym: "gyms"
};

function localizeCategory(category, fr) {
  if (!fr) return `${category} businesses`;
  const base = category.replace(/\s*\(.*\)$/, "").toLowerCase();
  return FR_CATEGORIES[base] || `commerces (${category})`;
}

export function draftPitch(cfg, lead, liveUrl) {
  const fr = cfg.language === "fr";
  const hook = fr
    ? (lead.rating ? `vos ${lead.ratingCount} avis à ${lead.rating}★` : lead.address ? `votre commerce sur ${lead.address.split(",")[0]}` : "votre commerce")
    : (lead.rating ? `your ${lead.ratingCount} reviews at ${lead.rating}★` : lead.address ? `your spot on ${lead.address.split(",")[0]}` : "your business");

  const subject = fr ? `un site web pour ${lead.name}` : `a website for ${lead.name}`;

  const body = fr ? `Bonjour,

Je cherchais des ${localizeCategory(lead.category, true)} dans la région et ${lead.name} n'a pas de site web — pourtant ${hook} méritent d'être trouvés en ligne.

Alors j'en ai monté un. Il est en ligne ici :

    ${liveUrl}

C'est un aperçu, préparé à partir d'informations publiques. Si ça vous plaît, je le mets à votre nom de domaine en moins de 7 jours et vous êtes propriétaire de tout. Si ça ne vous intéresse pas, je le retire sur simple demande.

Ça vaut deux minutes de votre temps?

${signature(cfg)}` : `Hi,

I was looking up ${localizeCategory(lead.category, false)} in the area and ${lead.name} has no website — even though ${hook} deserve to be found online.

So I built one. It's live here:

    ${liveUrl}

It's a preview, put together from public information. If you like it, I'll have it on your own domain in under 7 days and you own everything. If it's not of interest, I'll take it down on request.

Worth two minutes of your time?

${signature(cfg)}`;

  mkdirSync(cfg.outboxDir, { recursive: true });
  const file = join(cfg.outboxDir, `${lead.slug}.md`);
  writeFileSync(file, `---
business: ${lead.name}
phone: ${lead.phone || "(none listed)"}
maps: ${lead.mapsUrl}
site: ${liveUrl}
drafted: ${nowIso()}
status: DRAFT — review and send manually
---

Subject: ${subject}

${body}
`);
  return { file, subject };
}

export function signature(cfg) {
  const { name = "", company = "", url = "", email = "" } = cfg.operator || {};
  const brand = [company, url].filter(Boolean).join(" · ");
  return [name, brand, email].filter(Boolean).join("\n");
}
