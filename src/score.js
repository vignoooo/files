// Ranks a lead 0-100 by how likely the owner is to buy a website.
// Signals: social proof (ratings), reachability (phone), data richness
// (photos, hours), and — for outdated-site leads — how broken the old site is.
export function scoreLead(lead) {
  let score = 30;

  // Social proof: a business people already love has the most to gain online.
  if (lead.ratingCount >= 100) score += 25;
  else if (lead.ratingCount >= 25) score += 18;
  else if (lead.ratingCount >= 5) score += 10;
  if (lead.rating >= 4.5) score += 10;
  else if (lead.rating >= 4.0) score += 6;

  // Reachability: no phone means no way to close the deal.
  if (lead.phone) score += 15;
  else score -= 20;

  // Raw material: photos and hours make for a far stronger demo site.
  if ((lead.photoRefs || []).length >= 3) score += 10;
  else if ((lead.photoRefs || []).length >= 1) score += 5;
  if ((lead.hours || []).length) score += 5;
  if ((lead.reviews || []).length) score += 5;

  // Outdated-site leads: every defect on the old site is a talking point.
  if (lead.existingSite) score += Math.min(10, (lead.existingSite.issues || []).length * 3);

  return Math.max(0, Math.min(100, score));
}

export function rankLeads(leads) {
  return leads
    .map((l) => ({ ...l, score: scoreLead(l) }))
    .sort((a, b) => b.score - a.score);
}
