/**
 * Shared email sending for site notifications (quote requests).
 * Uses the same runtime secrets as the estimate emails: Gmail API when
 * GMAIL_* secrets are present, otherwise Resend.
 */
import { getEstimateEmailConfig } from "../auth/_lib/employee-auth";

export type OutgoingEmail = {
  html: string;
  replyTo?: string;
  subject: string;
  text: string;
  to: string;
};

export type SendResult = { error: string; ok: boolean; provider: string };

export async function sendSiteEmail(message: OutgoingEmail): Promise<SendResult> {
  let config: Awaited<ReturnType<typeof getEstimateEmailConfig>>;
  try {
    config = await getEstimateEmailConfig();
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Email sending is not configured.",
      ok: false,
      provider: "none",
    };
  }

  const from = formatSender(config.fromEmail);
  const replyTo = message.replyTo || extractEmailAddress(from);

  try {
    if (config.gmail) {
      const result = await sendWithGmail({ ...message, from, gmail: config.gmail, replyTo });
      if (result.ok || !config.resend) return { ...result, provider: "gmail" };
    }

    if (config.resend) {
      const result = await sendWithResend({ ...message, apiKey: config.resend.apiKey, from, replyTo });
      return { ...result, provider: "resend" };
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "The email provider could not be reached.",
      ok: false,
      provider: config.gmail ? "gmail" : "resend",
    };
  }

  return { error: "Email sending is not configured.", ok: false, provider: "none" };
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatSender(value: string) {
  const trimmed = value.trim();
  if (!trimmed.includes("<") && isEmail(trimmed)) return `VA Contracting <${trimmed}>`;
  return trimmed;
}

function extractEmailAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim();
}

async function sendWithGmail(input: OutgoingEmail & {
  from: string;
  gmail: { clientId: string; clientSecret: string; refreshToken: string };
  replyTo: string;
}) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      client_id: input.gmail.clientId,
      client_secret: input.gmail.clientSecret,
      grant_type: "refresh_token",
      refresh_token: input.gmail.refreshToken,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const token = (await readJson(tokenResponse)) as { access_token?: string; error?: string; error_description?: string };
  if (!tokenResponse.ok || !token.access_token) {
    return { error: [token.error, token.error_description].filter(Boolean).join(": ") || "Gmail authorization failed.", ok: false };
  }

  const boundary = `va-boundary-${crypto.randomUUID()}`;
  const raw = [
    `From: ${encodeHeaderAddress(input.from)}`,
    `To: ${input.to}`,
    `Reply-To: ${input.replyTo}`,
    `Subject: ${encodeMimeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const sendResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    body: JSON.stringify({ raw: base64UrlEncode(raw) }),
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
    method: "POST",
  });
  if (!sendResponse.ok) {
    const body = (await readJson(sendResponse)) as { error?: { message?: string } };
    return { error: body.error?.message ?? "Gmail rejected the message.", ok: false };
  }
  return { error: "", ok: true };
}

async function sendWithResend(input: OutgoingEmail & { apiKey: string; from: string; replyTo: string }) {
  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: input.from,
      html: input.html,
      reply_to: input.replyTo,
      subject: input.subject,
      text: input.text,
      to: [input.to],
    }),
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `va-site-email/${crypto.randomUUID()}`,
    },
    method: "POST",
  });
  if (!response.ok) {
    const body = (await readJson(response)) as { message?: string; error?: { message?: string } | string };
    const nested = typeof body.error === "string" ? body.error : body.error?.message;
    return { error: nested || body.message || "Resend rejected the message.", ok: false };
  }
  return { error: "", ok: true };
}

function encodeHeaderAddress(value: string) {
  const match = value.match(/^(.*)<([^>]+)>$/);
  if (!match) return value;
  return `${encodeMimeHeader(match[1].trim())} <${match[2].trim()}>`;
}

function encodeMimeHeader(value: string) {
  return /^[\x20-\x7E]*$/.test(value) ? value : `=?UTF-8?B?${base64Encode(value)}?=`;
}

function base64UrlEncode(value: string) {
  return base64Encode(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64Encode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
