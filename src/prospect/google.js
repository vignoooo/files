import { slugify, fetchJson, log } from "../util.js";
import { checkWebsite } from "./outdated.js";
import { rankLeads } from "../score.js";

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.regularOpeningHours",
  "places.primaryTypeDisplayName",
  "places.photos",
  "places.reviews",
  "places.googleMapsUri"
].join(",");

// Finds businesses in the region that have NO website listed on Google.
export async function prospectGoogle(cfg, { limit = 5 } = {}) {
  if (!cfg.googleApiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not set (required for prospector \"google\").");
  }
  const leads = [];
  for (const category of cfg.categories) {
    if (leads.length >= limit) break;
    const body = { textQuery: `${category} in ${cfg.region}`, pageSize: 20 };
    const data = await fetchJson(SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": cfg.googleApiKey,
        "X-Goog-FieldMask": FIELD_MASK
      },
      body: JSON.stringify(body)
    });
    for (const place of data.places || []) {
      if (leads.length >= limit) break;
      const lead = placeToLead(place, category);
      if (!place.websiteUri) {
        leads.push(lead); // no website at all — prime lead
      } else if (cfg.includeOutdated) {
        const check = await checkWebsite(place.websiteUri);
        if (check.outdated) leads.push({ ...lead, existingSite: check });
      }
    }
    log(`google: "${category} in ${cfg.region}" -> ${leads.length} candidates so far`);
  }
  return rankLeads(leads);
}

function placeToLead(place, category) {
  const name = place.displayName?.text || "Unknown business";
  return {
    id: `g:${place.id}`,
    source: "google",
    slug: slugify(name),
    name,
    category: place.primaryTypeDisplayName?.text || category,
    address: place.formattedAddress || "",
    phone: place.nationalPhoneNumber || "",
    rating: place.rating || null,
    ratingCount: place.userRatingCount || 0,
    hours: place.regularOpeningHours?.weekdayDescriptions || [],
    reviews: (place.reviews || []).slice(0, 5).map((r) => ({
      rating: r.rating,
      text: r.text?.text || "",
      author: r.authorAttribution?.displayName || "A customer"
    })),
    photoRefs: (place.photos || []).map((p) => p.name),
    mapsUrl: place.googleMapsUri || ""
  };
}

// Looks up a single business by name (+ address/region) — used to upgrade
// leads found by other prospectors with Google's photos, reviews and rating.
export async function lookupPlace(cfg, query) {
  if (!cfg.googleApiKey) return null;
  const data = await fetchJson(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": cfg.googleApiKey,
      "X-Goog-FieldMask": FIELD_MASK
    },
    body: JSON.stringify({ textQuery: query, pageSize: 1 })
  });
  const place = data.places?.[0];
  return place ? placeToLead(place, "") : null;
}

// Google Places photo media endpoint: returns the binary image.
export async function downloadGooglePhoto(cfg, photoRef, maxWidth = 1600) {
  const url = `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=${maxWidth}&key=${cfg.googleApiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`photo download failed: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
