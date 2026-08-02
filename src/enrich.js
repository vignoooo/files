import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { downloadGooglePhoto } from "./prospect/google.js";
import { gatherWebPhotoUrls, downloadPhotos } from "./enrich/photos.js";
import { writeJson, log } from "./util.js";

// Prepares the per-lead workspace: sites/<slug>/ with brief.json and assets/.
// Downloads real photos when the source provides them (Google Places).
export async function enrich(cfg, lead) {
  const siteDir = join(cfg.sitesDir, lead.slug);
  const assetsDir = join(siteDir, "assets");
  mkdirSync(assetsDir, { recursive: true });

  // Photo sources, in order of quality: Google Places, then the business's
  // existing website, then the public og:image of linked Instagram/Facebook.
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

  let socials = { instagram: null, facebook: null };
  if (photos.length < cfg.maxPhotos) {
    const gathered = await gatherWebPhotoUrls(lead, cfg.maxPhotos - photos.length);
    socials = gathered.socials;
    if (gathered.urls.length) {
      const extra = await downloadPhotos(gathered.urls, assetsDir, {
        startIndex: photos.length,
        max: cfg.maxPhotos - photos.length
      });
      photos.push(...extra);
      if (extra.length) log(`enrich: ${extra.length} photo(s) from website/socials for ${lead.name}`);
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
      mapsUrl: lead.mapsUrl,
      existingSite: lead.existingSite || null,
      socials
    },
    photos,
    language: cfg.language,
    designNotes: cfg.designNotes,
    // Cross-run preferences the operator has taught the agent (memory.md).
    operatorPreferences: readMemory(cfg)
  };
  writeJson(join(siteDir, "brief.json"), brief);
  return { siteDir, photos: photos.length };
}

function readMemory(cfg) {
  const path = join(cfg.root || process.cwd(), "memory.md");
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}
