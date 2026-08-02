import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nowIso } from "./util.js";

// Drafts a personalised outreach email and drops it in the outbox for the
// OPERATOR to review and send. Websmith never contacts a business directly:
// unsolicited commercial email is regulated (CASL in Canada, CAN-SPAM in the
// US, GDPR/ePrivacy in the EU) and a human must own that decision.
export function draftPitch(cfg, lead, liveUrl) {
  const fr = cfg.language === "fr";
  const op = cfg.operator.name || "—";
  const opEmail = cfg.operator.email || "";
  const firstLineFacts = [
    lead.rating ? (fr ? `vos ${lead.ratingCount} avis (${lead.rating}★)` : `your ${lead.ratingCount} reviews (${lead.rating}★)`) : null,
    lead.address ? (fr ? `votre adresse sur ${lead.address.split(",")[0]}` : `your spot on ${lead.address.split(",")[0]}`) : null
  ].filter(Boolean).join(fr ? " et " : " and ");

  const subject = fr
    ? `Un site web déjà en ligne pour ${lead.name}`
    : `A website for ${lead.name} — already built and live`;

  const body = fr ? `Bonjour,

Je cherchais ${lead.category} dans la région et j'ai remarqué que ${lead.name} n'a pas de site web — pourtant ${firstLineFacts || "votre commerce"} mérite d'être trouvé en ligne.

Alors j'en ai construit un. Il est déjà en ligne, vous pouvez le voir ici :

    ${liveUrl}

C'est une version de démonstration préparée à partir d'informations publiques. Si elle vous plaît, je peux la mettre à votre nom de domaine, ajuster les textes et photos avec vous, et vous montrer comment la mettre à jour vous-même. Si elle ne vous intéresse pas, aucune obligation — et je la retirerai sur simple demande.

Au plaisir,
${op}${opEmail ? `\n${opEmail}` : ""}` : `Hi,

I was looking up ${lead.category} businesses in the area and noticed ${lead.name} doesn't have a website — even though ${firstLineFacts || "your business"} deserves to be found online.

So I built one. It's already live — you can see it here:

    ${liveUrl}

It's a preview put together from public information. If you like it, I can move it to your own domain, fine-tune the words and photos with you, and show you how to update it yourself. If it's not for you, no obligation at all — and I'll take it down on request.

Best,
${op}${opEmail ? `\n${opEmail}` : ""}`;

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
