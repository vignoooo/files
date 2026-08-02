// Client for the VIGNO app's websmith API (vigno.ca/api/public/websmith).
// Pushes pipeline leads into the real CRM (public.leads), registers demos so
// they serve from vigno.ca/d/<token>, and mirrors stage changes.
//
// Enabled when VIGNO_WEBSMITH_KEY is set (see .env.example). Every call is
// best-effort from the pipeline's point of view: callers decide whether a
// failure is fatal.

const APP_URL = () => (process.env.VIGNO_APP_URL || "https://vigno.ca").replace(/\/$/, "");

export function vignoEnabled() {
  return Boolean(process.env.VIGNO_WEBSMITH_KEY);
}

async function call(body) {
  const res = await fetch(`${APP_URL()}/api/public/websmith`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-websmith-key": process.env.VIGNO_WEBSMITH_KEY || ""
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(`vigno api ${body.action}: HTTP ${res.status} ${json.error || ""}`.trim());
  }
  return json;
}

// Maps a websmith lead to a CRM lead row. City comes from the address's
// second component ("12 Rue King O, Sherbrooke, J1H..." -> "Sherbrooke").
export function leadPayload(lead, demoUrl) {
  const city = (lead.address || "").split(",")[1]?.trim() || null;
  return {
    action: "lead",
    business_name: lead.name,
    phone: lead.phone || null,
    city,
    industry: lead.category || null,
    website: lead.existingSite?.url || null,
    message: [
      `Score ${lead.score ?? "?"}/100 — ${lead.ratingCount || 0} avis${lead.rating ? ` à ${lead.rating}★` : ""}.`,
      lead.mapsUrl ? `Fiche: ${lead.mapsUrl}` : null
    ].filter(Boolean).join("\n"),
    source: "websmith",
    demo_url: demoUrl || null
  };
}

export async function pushLead(lead, demoUrl) {
  const { lead_id } = await call(leadPayload(lead, demoUrl));
  return lead_id;
}

export async function registerDemo(lead, upstreamUrl) {
  const city = (lead.address || "").split(",")[1]?.trim() || null;
  const { token, url } = await call({
    action: "demo",
    slug: lead.slug,
    business_name: lead.name,
    upstream_url: upstreamUrl,
    industry: lead.category || null,
    city,
    lead_id: lead.vignoLeadId || null
  });
  return { token, url };
}

// websmith status -> VIGNO CRM stage (LeadStage on the app side).
// pitched with 1 touch sent = contacte; further touches = relance.
export function stageFor(lead) {
  switch (lead.status) {
    case "pitched":
      if (!lead.touches?.length) return "a_contacter";
      return lead.touches.length === 1 ? "contacte" : "relance";
    case "later": return "relance";
    case "warm": return "repondu";
    case "won": return "client";
    case "lost": return "perdu";
    case "lapsed": return "perdu";
    default: return null;
  }
}

export async function pushStage(lead) {
  const stage = stageFor(lead);
  if (!stage || !lead.vignoLeadId) return null;
  await call({ action: "stage", lead_id: lead.vignoLeadId, stage });
  return stage;
}

export async function retireDemo(slug) {
  await call({ action: "retire", slug });
}
