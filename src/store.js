import { join } from "node:path";
import { readJson, writeJson, nowIso } from "./util.js";

// Build lifecycle: new -> enriched -> built -> qa -> deployed -> pitched
// CRM lifecycle (after pitched): warm / later / won / lost / lapsed
// Terminal mishaps: failed / skipped
export const STATUSES = [
  "new", "enriched", "built", "qa", "deployed", "pitched",
  "warm", "later", "won", "lost", "lapsed",
  "failed", "skipped"
];

export class Store {
  constructor(dataDir) {
    this.path = join(dataDir, "leads.json");
    this.leads = readJson(this.path, []);
  }

  save() {
    writeJson(this.path, this.leads);
  }

  has(id) {
    return this.leads.some((l) => l.id === id);
  }

  add(lead) {
    if (this.has(lead.id)) return false;
    this.leads.push({ ...lead, status: "new", createdAt: nowIso(), history: [] });
    this.save();
    return true;
  }

  get(idOrSlug) {
    return this.leads.find((l) => l.id === idOrSlug || l.slug === idOrSlug) || null;
  }

  nextWithStatus(status) {
    return this.leads.find((l) => l.status === status) || null;
  }

  advance(lead, status, patch = {}) {
    lead.history.push({ from: lead.status, to: status, at: nowIso() });
    lead.status = status;
    Object.assign(lead, patch);
    this.save();
  }

  summary() {
    const counts = {};
    for (const l of this.leads) counts[l.status] = (counts[l.status] || 0) + 1;
    return { total: this.leads.length, counts };
  }
}
