import { slugify, fetchJson, log } from "../util.js";
import { rankLeads } from "../score.js";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "websmith/0.1 (autonomous website agency pipeline)";

// Maps friendly category names onto OSM tag filters.
const CATEGORY_TAGS = {
  restaurant: '["amenity"="restaurant"]',
  cafe: '["amenity"="cafe"]',
  bakery: '["shop"="bakery"]',
  barber: '["shop"="hairdresser"]',
  florist: '["shop"="florist"]',
  plumber: '["craft"="plumber"]',
  "auto repair": '["shop"="car_repair"]',
  butcher: '["shop"="butcher"]',
  bar: '["amenity"="bar"]',
  gym: '["leisure"="fitness_centre"]'
};

// Free prospector: OpenStreetMap businesses in the region with no website/contact tag.
export async function prospectOverpass(cfg, { limit = 5 } = {}) {
  const area = await geocodeArea(cfg.region);
  const leads = [];
  for (const category of cfg.categories) {
    if (leads.length >= limit) break;
    const tag = CATEGORY_TAGS[category.toLowerCase()];
    if (!tag) {
      log(`overpass: no OSM tag mapping for category "${category}", skipping`);
      continue;
    }
    const query = `
[out:json][timeout:30];
nwr${tag}["name"][!"website"][!"contact:website"](${area.bbox});
out tags center 40;`;
    const data = await fetchJson(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
      body: "data=" + encodeURIComponent(query)
    });
    for (const el of data.elements || []) {
      if (leads.length >= limit) break;
      leads.push(elementToLead(el, category));
    }
    log(`overpass: "${category}" in ${cfg.region} -> ${leads.length} website-less so far`);
  }
  return rankLeads(leads);
}

async function geocodeArea(region) {
  if (!region) throw new Error('Set "region" in websmith.config.json (e.g. "Sherbrooke, QC").');
  const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(region)}`;
  const results = await fetchJson(url, { headers: { "User-Agent": USER_AGENT } });
  if (!results.length) throw new Error(`Could not geocode region "${region}".`);
  const [south, north, west, east] = results[0].boundingbox.map(Number);
  return { bbox: `${south},${west},${north},${east}`, displayName: results[0].display_name };
}

function elementToLead(el, category) {
  const t = el.tags || {};
  const name = t.name || "Unknown business";
  const address = [
    [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "),
    t["addr:city"],
    t["addr:postcode"]
  ].filter(Boolean).join(", ");
  return {
    id: `osm:${el.type}/${el.id}`,
    source: "overpass",
    slug: slugify(name),
    name,
    category: t.cuisine ? `${category} (${t.cuisine})` : category,
    address,
    phone: t.phone || t["contact:phone"] || "",
    rating: null,
    ratingCount: 0,
    hours: t.opening_hours ? [t.opening_hours] : [],
    reviews: [],
    photoRefs: [],
    mapsUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`
  };
}
