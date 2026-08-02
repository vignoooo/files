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
  barber: "salons de coiffure", salon: "salons", florist: "fleuristes",
  cafe: "cafés", plumber: "plombiers", butcher: "boucheries", bar: "bars",
  gym: "gyms", landscaping: "entreprises de paysagement",
  construction: "entrepreneurs en construction"
};

// One value line per vertical, lifted from the VIGNO industry pages
// (vigno.ca/industry/<type>). Falls back to the generic booking angle.
const ANGLES = {
  "auto repair": {
    fr: "Pendant que vous êtes sous le capot, un site prend les rendez-vous et répond aux clients.",
    en: "While you're under the hood, a site books the appointments and answers your clients."
  },
  restaurant: {
    fr: "Un site à vous : menu toujours à jour, réservations directes, zéro commission de plateforme.",
    en: "A site of your own: live menu, direct reservations, zero third-party commission."
  },
  construction: {
    fr: "Pendant que vous êtes sur le chantier, un site répond aux soumissions et gagne des mandats.",
    en: "While you're on site, a website answers leads and wins bids."
  },
  landscaping: {
    fr: "Les estimations rentrent 24/7, même en pleine saison.",
    en: "Estimates come in 24/7, even at the peak of the season."
  },
  barber: {
    fr: "Vos clients réservent en ligne, le jour comme le soir.",
    en: "Your clients book online, day or night."
  }
};
ANGLES.salon = ANGLES.barber;
ANGLES.bakery = ANGLES.cafe = ANGLES.bar = {
  fr: "On vous trouve sur Google, vos heures et votre menu toujours à jour.",
  en: "People find you on Google, with your hours and menu always current."
};

function baseCategory(category) {
  return category.replace(/\s*\(.*\)$/, "").toLowerCase();
}

function localizeCategory(category, fr) {
  if (!fr) return `${category} businesses`;
  return FR_CATEGORIES[baseCategory(category)] || `commerces (${category})`;
}

function angleFor(category, fr) {
  const angle = ANGLES[baseCategory(category)];
  if (angle) return angle[fr ? "fr" : "en"];
  return fr
    ? "Un site prend les demandes et les rendez-vous, même quand vous êtes occupé."
    : "A site takes requests and bookings, even while you're busy.";
}

export function draftPitch(cfg, lead, liveUrl) {
  const fr = cfg.language === "fr";
  const hook = fr
    ? (lead.rating ? `vos ${lead.ratingCount} avis à ${lead.rating}★` : lead.address ? `votre commerce sur ${lead.address.split(",")[0]}` : "votre commerce")
    : (lead.rating ? `your ${lead.ratingCount} reviews at ${lead.rating}★` : lead.address ? `your spot on ${lead.address.split(",")[0]}` : "your business");

  const subject = fr ? `un site web pour ${lead.name}` : `a website for ${lead.name}`;

  const body = fr ? `Bonjour,

Je cherchais des ${localizeCategory(lead.category, true)} dans la région et ${lead.name} n'a pas de site web — pourtant ${hook} méritent d'être trouvés en ligne. ${angleFor(lead.category, true)}

Alors j'en ai monté un. Il est en ligne ici :

    ${liveUrl}

C'est un aperçu, préparé à partir d'informations publiques. Si ça vous plaît, je le mets à votre nom de domaine en moins de 7 jours et vous êtes propriétaire de tout. Si ça ne vous intéresse pas, je le retire sur simple demande.

Ça vaut deux minutes de votre temps?

${signature(cfg)}` : `Hi,

I was looking up ${localizeCategory(lead.category, false)} in the area and ${lead.name} has no website — even though ${hook} deserve to be found online. ${angleFor(lead.category, false)}

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
