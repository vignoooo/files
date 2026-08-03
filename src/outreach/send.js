import { join } from "node:path";
import { sendEmail } from "./smtp.js";
import { pitchContent } from "../pitch.js";
import { followupContent, nextTouchDue, recordTouch, TOUCH_OFFSETS_DAYS } from "../crm.js";
import { pushStage, vignoEnabled } from "../sync/vigno.js";
import { readJson, writeJson, log, nowIso } from "../util.js";

// Automatic outreach. OFF by default; every gate below must be satisfied:
//   - outreach.autoSend true AND caslAcknowledged true in the config
//   - operator.address (a real mailing address, required by CASL/CAN-SPAM)
//   - SMTP_PASSWORD in .env (Gmail app password for the sender account)
//   - the lead has an email the business PUBLISHED itself (discoverContact)
//   - inside the send window (business hours, Mon-Fri) and under the daily cap
// Every message carries identification + an unsubscribe line; a "no" reply
// (recorded manually or via /check-replies) suppresses the lead permanently.
export function autoSendReady(cfg) {
  const missing = [];
  if (!cfg.outreach?.autoSend) missing.push('outreach.autoSend: true');
  if (!cfg.caslAcknowledged) missing.push("caslAcknowledged: true");
  if (!cfg.operator?.address) missing.push("operator.address (mailing address)");
  if (!cfg.operator?.email) missing.push("operator.email");
  if (!process.env.SMTP_PASSWORD) missing.push("SMTP_PASSWORD in .env");
  return { ready: missing.length === 0, missing };
}

export function inSendWindow(cfg, now = new Date()) {
  const day = now.getDay();
  const hour = now.getHours();
  const [start, end] = cfg.outreach?.windowHours || [9, 17];
  return day >= 1 && day <= 5 && hour >= start && hour < end;
}

export function caslFooter(cfg, fr) {
  const op = cfg.operator;
  return fr
    ? `--\n${op.name} · ${op.company || "VIGNO"} · ${op.address}\n${op.email}${op.url ? ` · ${op.url}` : ""}\nVous recevez ce courriel parce que l'adresse de votre entreprise est publiée publiquement. Pour ne plus rien recevoir, répondez simplement « désabonner ».`
    : `--\n${op.name} · ${op.company || "VIGNO"} · ${op.address}\n${op.email}${op.url ? ` · ${op.url}` : ""}\nYou're receiving this because your business address is publicly listed. To stop hearing from me, just reply "unsubscribe".`;
}

function sendLog(cfg) {
  return join(cfg.dataDir, "sendlog.json");
}

export function sentToday(cfg) {
  const logData = readJson(sendLog(cfg), {});
  return logData[new Date().toISOString().slice(0, 10)] || 0;
}

function recordSend(cfg, lead, touchN, subject) {
  const path = sendLog(cfg);
  const logData = readJson(path, {});
  const today = new Date().toISOString().slice(0, 10);
  logData[today] = (logData[today] || 0) + 1;
  logData.history = logData.history || [];
  logData.history.push({ at: nowIso(), slug: lead.slug, to: lead.email, touch: touchN, subject });
  writeJson(path, logData);
}

// Sends every due touch (1 = pitch, 2-5 = follow-ups) for leads with a
// published email, within the window and cap. Returns count sent.
export async function runOutreach(cfg, store) {
  const readiness = autoSendReady(cfg);
  if (!readiness.ready) return 0;
  if (!inSendWindow(cfg)) {
    log("outreach: outside send window (Mon-Fri business hours) — skipping");
    return 0;
  }
  const cap = cfg.outreach.dailyCap ?? 15;
  let sent = 0;

  for (const lead of store.leads) {
    if (sentToday(cfg) >= cap) { log(`outreach: daily cap (${cap}) reached`); break; }
    if (!["pitched", "later"].includes(lead.status)) continue;
    if (!lead.email || lead.emailSource == null) continue; // published addresses only
    if (lead.optOut) continue;
    const due = nextTouchDue(lead);
    if (!due || due.getTime() > Date.now()) continue;

    const touchN = (lead.touches || []).length + 1;
    const fr = cfg.language === "fr";
    const { subject, body } = touchN === 1
      ? pitchContent(cfg, lead, lead.liveUrl)
      : followupContent(cfg, lead, touchN);
    const fullBody = `${body}\n\n${caslFooter(cfg, fr)}`;

    try {
      await sendEmail({
        host: cfg.outreach.smtpHost || "smtp.gmail.com",
        port: cfg.outreach.smtpPort || 465,
        user: cfg.operator.email,
        password: process.env.SMTP_PASSWORD,
        from: `"${cfg.operator.name} · ${cfg.operator.company || "VIGNO"}" <${cfg.operator.email}>`,
        to: lead.email,
        subject,
        body: fullBody,
        headers: { "List-Unsubscribe": `<mailto:${cfg.operator.email}?subject=unsubscribe>` }
      });
      recordSend(cfg, lead, touchN, subject);
      recordTouch(store, lead, "email-auto");
      if (vignoEnabled()) await pushStage(lead).catch((e) => log(`outreach: stage sync failed — ${e.message}`));
      sent++;
      log(`outreach: sent touch ${touchN}/${TOUCH_OFFSETS_DAYS.length} to ${lead.name} <${lead.email}>`);
    } catch (err) {
      log(`outreach: send failed for ${lead.name} — ${err.message}`);
    }
  }
  return sent;
}
