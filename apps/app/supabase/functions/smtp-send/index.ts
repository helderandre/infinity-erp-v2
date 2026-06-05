import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-edge-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hasNonAscii(str: string): boolean {
  return /[^\x00-\x7F]/.test(str);
}

/**
 * Encode a string using RFC 2047 Base64 for use in email headers.
 */
function rfc2047Encode(value: string): string {
  if (!hasNonAscii(value)) return value;
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const encoded = btoa(binary);
  return "=?UTF-8?B?" + encoded + "?=";
}

function encodeFromHeader(name: string, address: string): string {
  return rfc2047Encode(name) + " <" + address + ">";
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

interface Attachment {
  filename: string;
  content_type: string;
  data_base64: string;
  /** When true, attached as an inline MIME part with a Content-ID for <img src="cid:..."> refs. */
  inline?: boolean;
  /** Required when `inline` is true. */
  cid?: string;
}

interface Payload {
  smtp: SmtpConfig;
  imap?: ImapConfig;
  from: { name: string; address: string };
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  in_reply_to?: string;
  references?: string;
  attachments?: Attachment[];
}

function base64EncodeBody(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = btoa(binary);
  return (b64.match(/.{1,76}/g) || []).join("\r\n");
}

function foldBase64(b64: string): string {
  return (b64.match(/.{1,76}/g) || []).join("\r\n");
}

function appendHtmlPart(lines: string[], boundary: string, html: string): void {
  lines.push("--" + boundary);
  lines.push("Content-Type: text/html; charset=utf-8");
  lines.push("Content-Transfer-Encoding: base64");
  lines.push("");
  lines.push(base64EncodeBody(html));
}

function appendInlinePart(lines: string[], boundary: string, att: Attachment): void {
  lines.push("--" + boundary);
  lines.push("Content-Type: " + att.content_type);
  lines.push("Content-Transfer-Encoding: base64");
  lines.push("Content-ID: <" + att.cid + ">");
  lines.push("Content-Disposition: inline; filename=\"" + att.filename + "\"");
  lines.push("");
  lines.push(foldBase64(att.data_base64));
}

function appendAttachmentPart(lines: string[], boundary: string, att: Attachment): void {
  lines.push("--" + boundary);
  lines.push("Content-Type: " + att.content_type + "; name=\"" + att.filename + "\"");
  lines.push("Content-Disposition: attachment; filename=\"" + att.filename + "\"");
  lines.push("Content-Transfer-Encoding: base64");
  lines.push("");
  lines.push(foldBase64(att.data_base64));
}

function buildMimeMessage(payload: Payload, messageId: string): string {
  const lines: string[] = [];
  const date = new Date().toUTCString();

  lines.push("From: " + encodeFromHeader(payload.from.name, payload.from.address));
  lines.push("To: " + payload.to.join(", "));
  if (payload.cc && payload.cc.length > 0) lines.push("Cc: " + payload.cc.join(", "));
  lines.push("Subject: " + rfc2047Encode(payload.subject));
  lines.push("Date: " + date);
  lines.push("Message-ID: " + messageId);
  lines.push("MIME-Version: 1.0");
  if (payload.in_reply_to) {
    lines.push("In-Reply-To: " + payload.in_reply_to);
    lines.push("References: " + (payload.references || payload.in_reply_to));
  }

  const attachments = payload.attachments || [];
  const inlineAtts = attachments.filter((a) => a.inline && a.cid);
  const regularAtts = attachments.filter((a) => !a.inline);

  if (inlineAtts.length === 0 && regularAtts.length === 0) {
    // Case 1: plain HTML, no parts
    lines.push("Content-Type: text/html; charset=utf-8");
    lines.push("Content-Transfer-Encoding: base64");
    lines.push("");
    lines.push(base64EncodeBody(payload.html));
  } else if (inlineAtts.length > 0 && regularAtts.length === 0) {
    // Case 2: HTML + inline images → multipart/related
    const boundary = "----=_Related_" + crypto.randomUUID();
    lines.push("Content-Type: multipart/related; boundary=\"" + boundary + "\"");
    lines.push("");
    appendHtmlPart(lines, boundary, payload.html);
    for (const att of inlineAtts) appendInlinePart(lines, boundary, att);
    lines.push("--" + boundary + "--");
  } else if (inlineAtts.length === 0 && regularAtts.length > 0) {
    // Case 3: HTML + regular attachments → multipart/mixed
    const boundary = "----=_Mixed_" + crypto.randomUUID();
    lines.push("Content-Type: multipart/mixed; boundary=\"" + boundary + "\"");
    lines.push("");
    appendHtmlPart(lines, boundary, payload.html);
    for (const att of regularAtts) appendAttachmentPart(lines, boundary, att);
    lines.push("--" + boundary + "--");
  } else {
    // Case 4: HTML + inline images + regular attachments → multipart/mixed wrapping multipart/related
    const outerBoundary = "----=_Outer_" + crypto.randomUUID();
    const innerBoundary = "----=_Related_" + crypto.randomUUID();
    lines.push("Content-Type: multipart/mixed; boundary=\"" + outerBoundary + "\"");
    lines.push("");
    lines.push("--" + outerBoundary);
    lines.push("Content-Type: multipart/related; boundary=\"" + innerBoundary + "\"");
    lines.push("");
    appendHtmlPart(lines, innerBoundary, payload.html);
    for (const att of inlineAtts) appendInlinePart(lines, innerBoundary, att);
    lines.push("--" + innerBoundary + "--");
    for (const att of regularAtts) appendAttachmentPart(lines, outerBoundary, att);
    lines.push("--" + outerBoundary + "--");
  }

  return lines.join("\r\n") + "\r\n";
}

const textEnc = new TextEncoder();
const textDec = new TextDecoder();

async function readSmtpResponse(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  let buf = "";
  const start = Date.now();
  while (Date.now() - start < 15000) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += textDec.decode(value, { stream: true });
    const lines = buf.split("\r\n");
    for (const line of lines) {
      if (/^\d{3} /.test(line)) return buf;
    }
  }
  return buf;
}

function getSmtpCode(response: string): number {
  const match = response.match(/^(\d{3})/m);
  return match ? parseInt(match[1], 10) : 0;
}

async function sendViaRawSmtp(
  config: SmtpConfig,
  payload: Payload,
  mimeMessage: string
): Promise<{ ok: boolean; error?: string }> {
  let conn: Deno.TlsConn | Deno.Conn;

  if (config.secure) {
    conn = await Deno.connectTls({
      hostname: config.host,
      port: config.port,
    });
  } else {
    conn = await Deno.connect({
      hostname: config.host,
      port: config.port,
    });
  }

  const writer = conn.writable.getWriter();
  const reader = conn.readable.getReader();

  try {
    const greeting = await readSmtpResponse(reader);
    console.log("[smtp-send] Greeting: " + greeting.trim());
    if (getSmtpCode(greeting) !== 220) {
      return { ok: false, error: "SMTP greeting failed: " + greeting.trim() };
    }

    await writer.write(textEnc.encode("EHLO " + config.host + "\r\n"));
    const ehloResp = await readSmtpResponse(reader);
    if (getSmtpCode(ehloResp) !== 250) {
      return { ok: false, error: "EHLO failed: " + ehloResp.trim() };
    }

    await writer.write(textEnc.encode("AUTH LOGIN\r\n"));
    const authResp = await readSmtpResponse(reader);
    if (getSmtpCode(authResp) !== 334) {
      return { ok: false, error: "AUTH LOGIN failed: " + authResp.trim() };
    }

    await writer.write(textEnc.encode(btoa(config.user) + "\r\n"));
    const userResp = await readSmtpResponse(reader);
    if (getSmtpCode(userResp) !== 334) {
      return { ok: false, error: "AUTH username failed: " + userResp.trim() };
    }

    await writer.write(textEnc.encode(btoa(config.pass) + "\r\n"));
    const passResp = await readSmtpResponse(reader);
    if (getSmtpCode(passResp) !== 235) {
      return { ok: false, error: "AUTH password failed: " + passResp.trim() };
    }
    console.log("[smtp-send] Authenticated as " + config.user);

    await writer.write(textEnc.encode("MAIL FROM:<" + payload.from.address + ">\r\n"));
    const fromResp = await readSmtpResponse(reader);
    if (getSmtpCode(fromResp) !== 250) {
      return { ok: false, error: "MAIL FROM failed: " + fromResp.trim() };
    }

    const allRecipients = [
      ...payload.to,
      ...(payload.cc || []),
      ...(payload.bcc || []),
    ];
    for (const rcpt of allRecipients) {
      await writer.write(textEnc.encode("RCPT TO:<" + rcpt + ">\r\n"));
      const rcptResp = await readSmtpResponse(reader);
      if (getSmtpCode(rcptResp) !== 250) {
        return { ok: false, error: "RCPT TO <" + rcpt + "> failed: " + rcptResp.trim() };
      }
    }

    await writer.write(textEnc.encode("DATA\r\n"));
    const dataResp = await readSmtpResponse(reader);
    if (getSmtpCode(dataResp) !== 354) {
      return { ok: false, error: "DATA failed: " + dataResp.trim() };
    }

    await writer.write(textEnc.encode(mimeMessage + "\r\n.\r\n"));
    const endResp = await readSmtpResponse(reader);
    if (getSmtpCode(endResp) !== 250) {
      return { ok: false, error: "Message delivery failed: " + endResp.trim() };
    }
    console.log("[smtp-send] Message accepted: " + endResp.trim());

    await writer.write(textEnc.encode("QUIT\r\n"));

    return { ok: true };
  } finally {
    try { writer.releaseLock(); } catch { /* */ }
    try { reader.releaseLock(); } catch { /* */ }
    try { conn.close(); } catch { /* */ }
  }
}

async function readLine(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += textDec.decode(value, { stream: true });
    if (buf.includes("\r\n")) break;
  }
  return buf;
}

async function readImapResponse(reader: ReadableStreamDefaultReader<Uint8Array>, tag: string): Promise<string> {
  let full = "";
  const start = Date.now();
  while (Date.now() - start < 10000) {
    const { value, done } = await reader.read();
    if (done) break;
    full += textDec.decode(value, { stream: true });
    if (full.includes(tag + " OK") || full.includes(tag + " NO") || full.includes(tag + " BAD")) break;
    if (full.includes("+ ")) break;
  }
  return full;
}

async function imapAppendToSent(imap: ImapConfig, rawMessage: string): Promise<void> {
  console.log("[smtp-send] IMAP: connecting to " + imap.host + ":" + imap.port);

  const conn = await Deno.connectTls({ hostname: imap.host, port: imap.port });
  const writer = conn.writable.getWriter();
  const reader = conn.readable.getReader();

  try {
    const greeting = await readLine(reader);
    console.log("[smtp-send] IMAP greeting: " + greeting.trim());

    await writer.write(textEnc.encode("A001 LOGIN " + imap.user + " " + imap.pass + "\r\n"));
    const loginResp = await readImapResponse(reader, "A001");
    if (!loginResp.includes("A001 OK")) {
      console.error("[smtp-send] IMAP LOGIN failed: " + loginResp.trim());
      return;
    }

    const sentFolders = ["Sent", "INBOX.Sent", "Sent Items", "Sent Messages", "Enviados"];
    const msgBytes = textEnc.encode(rawMessage);
    let appended = false;

    for (const folder of sentFolders) {
      const appendCmd = "A002 APPEND \"" + folder + "\" (\\Seen) {" + msgBytes.length + "}\r\n";
      await writer.write(textEnc.encode(appendCmd));
      const contResp = await readImapResponse(reader, "A002");

      if (contResp.includes("+ ")) {
        await writer.write(msgBytes);
        await writer.write(textEnc.encode("\r\n"));
        const appendResp = await readImapResponse(reader, "A002");
        if (appendResp.includes("A002 OK")) {
          console.log("[smtp-send] IMAP: appended to '" + folder + "'");
          appended = true;
          break;
        }
      }
      if (contResp.includes("A002 NO") || contResp.includes("A002 BAD")) {
        continue;
      }
    }

    if (!appended) console.warn("[smtp-send] IMAP: could not append to any Sent folder");
    await writer.write(textEnc.encode("A003 LOGOUT\r\n"));
  } catch (err) {
    console.error("[smtp-send] IMAP error: " + err);
  } finally {
    try { writer.releaseLock(); } catch { /* */ }
    try { reader.releaseLock(); } catch { /* */ }
    try { conn.close(); } catch { /* */ }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo nao permitido" }, 405);
  }

  const edgeSecret = Deno.env.get("EDGE_SMTP_SECRET");
  if (edgeSecret) {
    const provided = req.headers.get("x-edge-secret");
    if (provided !== edgeSecret) {
      return jsonResponse({ error: "Nao autorizado" }, 401);
    }
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "JSON invalido" }, 400);
  }

  if (!payload.smtp || !payload.smtp.host || !payload.smtp.user || !payload.smtp.pass) {
    return jsonResponse({ error: "Configuracao SMTP em falta" }, 400);
  }
  if (!payload.to || payload.to.length === 0 || !payload.subject || !payload.html) {
    return jsonResponse({ error: "Campos obrigatorios: to, subject, html" }, 400);
  }

  console.log("[smtp-send] Sending to " + payload.to.join(", ") + " via " + payload.smtp.host + ":" + payload.smtp.port);

  try {
    const messageId = "<" + crypto.randomUUID() + "@" + payload.smtp.host + ">";
    const mimeMessage = buildMimeMessage(payload, messageId);
    const result = await sendViaRawSmtp(payload.smtp, payload, mimeMessage);

    if (!result.ok) {
      console.error("[smtp-send] SMTP error: " + result.error);
      return jsonResponse({ ok: false, error: result.error }, 502);
    }

    console.log("[smtp-send] Email sent successfully, messageId: " + messageId);

    if (payload.imap && payload.imap.host) {
      try {
        await imapAppendToSent(payload.imap, mimeMessage);
      } catch (imapErr) {
        console.warn("[smtp-send] IMAP append failed (non-fatal): " + imapErr);
      }
    }

    return jsonResponse({ ok: true, messageId: messageId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[smtp-send] Exception: " + message);
    return jsonResponse({ ok: false, error: message }, 502);
  }
});
