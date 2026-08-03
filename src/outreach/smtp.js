import { connect } from "node:tls";

// Minimal SMTPS client (implicit TLS, port 465) — enough to send plain-text
// mail through smtp.gmail.com with an app password. Zero dependencies.

export function sendEmail({ host = "smtp.gmail.com", port = 465, user, password, from, to, subject, body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port, servername: host });
    let buffer = "";
    let step = 0;
    const fail = (msg) => { socket.destroy(); reject(new Error(`smtp: ${msg}`)); };
    socket.setTimeout(30000, () => fail("timeout"));
    socket.on("error", (e) => reject(new Error(`smtp: ${e.message}`)));

    const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
    const message = buildMessage({ from, to, subject, body, headers });
    const script = [
      { expect: 220, send: `EHLO vigno.ca` },
      { expect: 250, send: `AUTH LOGIN` },
      { expect: 334, send: b64(user) },
      { expect: 334, send: b64(password) },
      { expect: 235, send: `MAIL FROM:<${user}>` },
      { expect: 250, send: `RCPT TO:<${to}>` },
      { expect: 250, send: `DATA` },
      { expect: 354, send: message + "\r\n." },
      { expect: 250, send: `QUIT`, done: true }
    ];

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      // SMTP multi-line replies end with "NNN " (code + space).
      const lines = buffer.split("\r\n").filter(Boolean);
      const last = lines[lines.length - 1];
      if (!last || !/^\d{3} /.test(last)) return;
      const code = Number(last.slice(0, 3));
      buffer = "";
      const current = script[step];
      if (!current) return;
      if (code !== current.expect) return fail(`expected ${current.expect}, got: ${last}`);
      socket.write(current.send + "\r\n");
      if (current.done) { socket.end(); resolve(); }
      step++;
    });
  });
}

export function buildMessage({ from, to, subject, body, headers = {} }) {
  const encSubject = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
  const lines = [
    `From: ${from}`,
    `To: <${to}>`,
    `Subject: ${encSubject}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: 8bit`,
    ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`),
    ``,
    // Dot-stuffing per RFC 5321.
    body.replace(/\r?\n/g, "\r\n").replace(/(^|\r\n)\./g, "$1..")
  ];
  return lines.join("\r\n");
}
