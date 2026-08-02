import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { downloadGooglePhoto } from "./prospect/google.js";
import { writeJson, log } from "./util.js";

// Prepares the per-lead workspace: sites/<slug>/ with brief.json and assets/.
// Downloads real photos when the source provides them (Google Places).
export async function enrich(cfg, lead) {
  const siteDir = join(cfg.sitesDir, lead.slug);
  const assetsDir = join(siteDir, "assets");
  mkdirSync(assetsDir, { recursive: true });

  const photos = [];
  if (lead.source === "google" && lead.photoRefs.length && cfg.googleApiKey) {
    for (const ref of lead.photoRefs.slice(0, cfg.maxPhotos)) {
      try {
        const buf = await downloadGooglePhoto(cfg, ref);
        const file = `photo-${photos.length + 1}.jpg`;
        writeFileSync(join(assetsDir, file), buf);
        photos.push(`assets/${file}`);
      } catch (err) {
        log(`enrich: photo skipped for ${lead.name}: ${err.message}`);
      }
    }
  }

  const brief = {
    business: {
      name: lead.name,
      category: lead.category,
      address: lead.address,
      phone: lead.phone,
      hours: lead.hours,
      rating: lead.rating,
      ratingCount: lead.ratingCount,
      reviews: lead.reviews,
      mapsUrl: lead.mapsUrl
    },
    photos,
    language: cfg.language,
    designNotes: cfg.designNotes
  };
  writeJson(join(siteDir, "brief.json"), brief);
  return { siteDir, photos: photos.length };
}
