// Client for the VIGNO app's websmith backend. All four actions (lead, demo,
// stage, retire) are implemented as a SECURITY DEFINER function
// (public.websmith_ingest) in the app's database, guarded by a shared secret
// and called through Supabase's public REST layer — no app route needed.
// Pitched leads land in the real CRM (public.leads); demos register in
// websmith_demos so the app can serve them at vigno.ca/d/<token>.
//
// Enabled when VIGNO_WEBSMITH_KEY is set (see .env.example). The URL and
// publishable key below are the app's public client values (they ship in the
// site's JS); only VIGNO_WEBSMITH_KEY is secret.

const SUPABASE_URL = () =>
  (process.env.VIGNO_SUPABASE_URL || "https://kbryqsascoyujxupdktq.supabase.co").replace(/\/$/, "");
const SUPABASE_ANON_KEY = () =>
  process.env.VIGNO_SUPABASE_ANON_KEY || "sb_publishable_E2Dirru6BSpl7HCkgcTSWQ_iAj19hdA";

export function vignoEnabled() {
  return Boolean(process.env.VIGNO_WEBSMITH_KEY);
}

async function call(body) {
  const { action, ...p } = body;
  const res = await fetch(`${SUPABASE_URL()}/rest/v1/rpc/websmith_ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY(),
      Authorization: `Bearer ${SUPABASE_ANON_KEY()}`
    },
    body: JSON.stringify({ p_action: action, p_key: process.env.VIGNO_WEBSMITH_KEY || "", p }),
    signal: AbortSignal.timeout(20000)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok !== true) {
    throw new Error(`vigno api ${action}: HTTP ${res.status} ${json.message || json.error || ""}`.trim());
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
