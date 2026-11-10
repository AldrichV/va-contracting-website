import {
  describeRuntimeSecret,
  getCurrentEmployee,
  getEstimateEmailConfig,
  toAuthError,
} from "../auth/_lib/employee-auth";

type LineItem = {
  description?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
};

type EstimateEmailPayload = {
  amountPaid?: number;
  clientEmail?: string;
  clientName?: string;
  chequingAccountNumber?: string;
  documentType?: "Estimate" | "Invoice";
  deposit?: number;
  dueDate?: string;
  employeeEmail?: string;
  employeeName?: string;
  datePrepared?: string;
  estimateNumber?: string;
  hstNumber?: string;
  items?: LineItem[];
  markup?: number;
  message?: string;
  notes?: string;
  paymentTerms?: string;
  projectAddress?: string;
  projectType?: string;
  taxRate?: number;
  totals?: {
    depositAmount?: number;
    balanceDue?: number;
    markupAmount?: number;
    subtotal?: number;
    tax?: number;
    total?: number;
  };
  validFor?: number;
};

type ResendResponseBody = {
  error?: { message?: string; name?: string } | string;
  id?: string;
  message?: string;
  name?: string;
};

export async function GET(request: Request) {
  try {
    const employee = await getCurrentEmployee(request);
    if (!employee) {
      return Response.json({ error: "Employee sign-in required." }, { status: 401 });
    }

    const config = await getEstimateEmailConfig();
    const fromEmail = formatSender(config.fromEmail);

    return Response.json({
      gmailConfigured: Boolean(config.gmail),
      provider: config.provider,
      resendApiKey: config.resend
        ? describeRuntimeSecret(config.resend.apiKey)
        : null,
      bccConfigured: Boolean(config.bccEmail),
      configured: true,
      fromEmail: maskEmail(extractEmailAddress(fromEmail)),
    });
  } catch (error) {
    const authError = toAuthError(error);
    const message = error instanceof Error ? error.message : authError.message;
    const status = message.includes("Estimate email sending") ? 503 : authError.status;
    return Response.json({ configured: false, error: message }, { status });
  }
}

export async function HEAD(request: Request) {
  try {
    const employee = await getCurrentEmployee(request);
    if (!employee) return new Response(null, { status: 401 });

    await getEstimateEmailConfig();
    return new Response(null, { status: 204 });
  } catch (error) {
    const authError = toAuthError(error);
    const message = error instanceof Error ? error.message : authError.message;
    const status = message.includes("Estimate email sending") ? 503 : authError.status;
    return new Response(null, { status });
  }
}

export async function OPTIONS() {
  return Response.json({
    requiredEnvironment: ["RESEND_API_KEY", "ESTIMATE_FROM_EMAIL"],
    optionalEnvironment: ["ESTIMATE_BCC_EMAIL"],
  });
}

export async function POST(request: Request) {
  try {
    const employee = await getCurrentEmployee(request);
    if (!employee) {
      return Response.json({ error: "Employee sign-in required." }, { status: 401 });
    }

    const payload = (await request.json()) as EstimateEmailPayload;
    const clientEmail = payload.clientEmail?.trim() ?? "";
    const estimateNumber = payload.estimateNumber?.trim() ?? "";
    if (!isEmail(clientEmail) || !estimateNumber) {
      return Response.json(
        { error: "A valid client email and estimate number are required." },
        { status: 400 },
      );
    }

    const config = await getEstimateEmailConfig();
    const documentType = payload.documentType === "Invoice" ? "invoice" : "estimate";
    const subject = `VA Contracting ${documentType} ${estimateNumber}`;
    const html = buildEstimateHtml(payload, employee.name, employee.email);
    const text = buildEstimateText(payload, employee.name, employee.email);
    const from = formatSender(config.fromEmail);

    if (config.provider === "gmail" && config.gmail) {
      const result = await sendWithGmail({
        bccEmail: config.bccEmail,
        clientEmail,
        from,
        gmail: config.gmail,
        html,
        replyTo: employee.email,
        subject,
        text,
      });

      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status });
      }

      return Response.json({
        id: result.id,
        message: `${capitalize(documentType)} email sent through Gmail.`,
        fromEmail: maskEmail(extractEmailAddress(from)),
        provider: "gmail",
      });
    }

    if (!config.resend) {
      return Response.json(
        { error: "Direct email is not configured." },
        { status: 503 },
      );
    }

    const resendResult = await sendWithResend({
      apiKey: config.resend.apiKey,
      bccEmail: config.bccEmail,
      clientEmail,
      from,
      html,
      replyTo: employee.email,
      subject,
      text,
    });

    if (!resendResult.ok) {
      return Response.json(
        { error: resendResult.error },
        { status: resendResult.status },
      );
    }

    return Response.json({
      id: resendResult.id,
      message: `${capitalize(documentType)} email sent through Resend.`,
      fromEmail: maskEmail(extractEmailAddress(from)),
      provider: "resend",
    });
  } catch (error) {
    const authError = toAuthError(error);
    const message = error instanceof Error ? error.message : authError.message;
    const status = message.includes("Estimate email sending") ? 503 : authError.status;
    return Response.json({ configured: false, error: message }, { status });
  }
}

function buildEstimateHtml(
  payload: EstimateEmailPayload,
  employeeName: string,
  employeeEmail: string,
) {
  const totals = payload.totals ?? {};
  const documentType = payload.documentType === "Invoice" ? "Invoice" : "Estimate";
  const invoiceRows =
    documentType === "Invoice"
      ? `
          <tr><td style="padding:6px 0;color:#666">Due date</td><td style="padding:6px 0">${escapeHtml(formatDate(payload.dueDate || ""))}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Payment terms</td><td style="padding:6px 0">${escapeHtml(payload.paymentTerms || "")}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Chequing account</td><td style="padding:6px 0">${escapeHtml(payload.chequingAccountNumber || "")}</td></tr>
          <tr><td style="padding:6px 0;color:#666">HST number</td><td style="padding:6px 0">${escapeHtml(payload.hstNumber || "")}</td></tr>
        `
      : `<tr><td style="padding:6px 0;color:#666">Valid for</td><td style="padding:6px 0">${Number(payload.validFor ?? 0)} days</td></tr>`;
  const finalRows =
    documentType === "Invoice"
      ? `
          <tr><td style="padding:5px 12px;color:#666">Amount paid</td><td style="padding:5px 0;text-align:right"><strong>${currency(payload.amountPaid ?? 0)}</strong></td></tr>
          <tr><td style="border-top:2px solid #111;padding:8px 12px 5px;color:#666">Balance due</td><td style="border-top:2px solid #111;padding:8px 0 5px;text-align:right"><strong>${currency(totals.balanceDue ?? Math.max(0, (totals.total ?? 0) - (payload.amountPaid ?? 0)))}</strong></td></tr>
        `
      : `
          <tr><td style="padding:5px 12px;color:#666">Down payment</td><td style="padding:5px 0;text-align:right"><strong>${currency(totals.depositAmount ?? 0)}</strong></td></tr>
          <tr><td style="border-top:2px solid #111;padding:8px 12px 5px;color:#666">Balance after down payment</td><td style="border-top:2px solid #111;padding:8px 0 5px;text-align:right"><strong>${currency(totals.balanceDue ?? Math.max(0, (totals.total ?? 0) - (totals.depositAmount ?? 0)))}</strong></td></tr>
        `;
  const rows = (payload.items ?? [])
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.description || "")}</td>
          <td style="text-align:right">${formatNumber(item.quantity ?? 0)}</td>
          <td>${escapeHtml(item.unit || "")}</td>
          <td style="text-align:right">${currency(item.unitPrice ?? 0)}</td>
          <td style="text-align:right">${currency((item.quantity ?? 0) * (item.unitPrice ?? 0))}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5">
      <h1 style="margin:0 0 6px">VA Contracting ${documentType}</h1>
      <p style="margin:0 0 20px;color:#666">${escapeHtml(payload.estimateNumber || "")}</p>
      <p>${escapeHtml(payload.message || "Thank you for considering VA Contracting. Please review the details below.")}</p>
      <table style="border-collapse:collapse;margin:20px 0;width:100%">
        <tbody>
          <tr><td style="padding:6px 0;color:#666">Prepared for</td><td style="padding:6px 0"><strong>${escapeHtml(payload.clientName || "")}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666">Date prepared</td><td style="padding:6px 0">${escapeHtml(formatDate(payload.datePrepared || ""))}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Project</td><td style="padding:6px 0">${escapeHtml(payload.projectType || "")}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Address</td><td style="padding:6px 0">${escapeHtml(payload.projectAddress || "")}</td></tr>
          ${invoiceRows}
        </tbody>
      </table>
      <table style="border-collapse:collapse;width:100%">
        <thead>
          <tr style="background:#111;color:#fff">
            <th style="padding:9px;text-align:left">Description</th>
            <th style="padding:9px;text-align:right">Qty</th>
            <th style="padding:9px;text-align:left">Unit</th>
            <th style="padding:9px;text-align:right">Unit price</th>
            <th style="padding:9px;text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <table style="border-collapse:collapse;margin-left:auto;margin-top:18px;min-width:260px">
        <tbody>
          <tr><td style="padding:5px 12px;color:#666">Price before HST</td><td style="padding:5px 0;text-align:right"><strong>${currency((totals.subtotal ?? 0) + (totals.markupAmount ?? 0))}</strong></td></tr>
          <tr><td style="padding:5px 12px;color:#666">HST</td><td style="padding:5px 0;text-align:right"><strong>${currency(totals.tax ?? 0)}</strong></td></tr>
          <tr><td style="border-top:2px solid #111;padding:8px 12px 5px;color:#666">Total</td><td style="border-top:2px solid #111;padding:8px 0 5px;text-align:right"><strong>${currency(totals.total ?? 0)}</strong></td></tr>
          ${finalRows}
        </tbody>
      </table>
      <div style="background:#f5f3ef;margin-top:20px;padding:14px">
        <strong>Notes</strong>
        <p style="margin:8px 0 0">${escapeHtml(payload.notes || "")}</p>
      </div>
      <p style="margin-top:22px">Regards,<br />${escapeHtml(employeeName)}<br />${escapeHtml(employeeEmail)}<br />VA Contracting</p>
    </div>
  `;
}

function buildEstimateText(
  payload: EstimateEmailPayload,
  employeeName: string,
  employeeEmail: string,
) {
  const totals = payload.totals ?? {};
  const documentType = payload.documentType === "Invoice" ? "Invoice" : "Estimate";
  const lines = (payload.items ?? [])
    .map(
      (item) =>
        `- ${item.description || ""}: ${formatNumber(item.quantity ?? 0)} ${item.unit || ""} x ${currency(item.unitPrice ?? 0)} = ${currency((item.quantity ?? 0) * (item.unitPrice ?? 0))}`,
    )
    .join("\n");

  return [
    `VA Contracting ${documentType.toLowerCase()} ${payload.estimateNumber || ""}`,
    "",
    payload.message || "Thank you for considering VA Contracting. Please review the details below.",
    "",
    `Prepared for: ${payload.clientName || ""}`,
    `Date prepared: ${formatDate(payload.datePrepared || "")}`,
    `Project: ${payload.projectType || ""}`,
    `Address: ${payload.projectAddress || ""}`,
    documentType === "Invoice"
      ? `Due date: ${formatDate(payload.dueDate || "")}`
      : `Valid for: ${Number(payload.validFor ?? 0)} days`,
    documentType === "Invoice" ? `Payment terms: ${payload.paymentTerms || ""}` : "",
    documentType === "Invoice"
      ? `Chequing account number: ${payload.chequingAccountNumber || ""}`
      : "",
    documentType === "Invoice" ? `HST number: ${payload.hstNumber || ""}` : "",
    "",
    lines,
    "",
    `Price before HST: ${currency((totals.subtotal ?? 0) + (totals.markupAmount ?? 0))}`,
    `HST: ${currency(totals.tax ?? 0)}`,
    `Total: ${currency(totals.total ?? 0)}`,
    documentType === "Invoice"
      ? `Amount paid: ${currency(payload.amountPaid ?? 0)}`
      : `Down payment: ${currency(totals.depositAmount ?? 0)}`,
    documentType === "Invoice"
      ? `Balance due: ${currency(totals.balanceDue ?? Math.max(0, (totals.total ?? 0) - (payload.amountPaid ?? 0)))}`
      : `Balance after down payment: ${currency(totals.balanceDue ?? Math.max(0, (totals.total ?? 0) - (totals.depositAmount ?? 0)))}`,
    "",
    `Notes: ${payload.notes || ""}`,
    "",
    `Regards,`,
    employeeName,
    employeeEmail,
    "VA Contracting",
  ].filter((line) => line !== "").join("\n");
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatSender(value: string) {
  const trimmed = value.trim();
  if (!trimmed.includes("<") && isEmail(trimmed)) {
  return `VA Contracting <${trimmed}>`;
  }
  return trimmed;
}

async function sendWithGmail(input: {
  bccEmail: string;
  clientEmail: string;
  from: string;
  gmail: { clientId: string; clientSecret: string; refreshToken: string };
  html: string;
  replyTo: string;
  subject: string;
  text: string;
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

  const tokenBody = (await readJsonResponse(tokenResponse)) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenResponse.ok || !tokenBody.access_token) {
    return {
      error: getGmailTokenErrorMessage(tokenBody),
      id: "",
      ok: false,
      status: tokenResponse.status || 502,
    };
  }

  const messageResponse = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      body: JSON.stringify({
        raw: buildGmailRawMessage({
          bccEmail: input.bccEmail,
          from: input.from,
          html: input.html,
          replyTo: input.replyTo,
          subject: input.subject,
          text: input.text,
          to: input.clientEmail,
        }),
      }),
      headers: {
        Authorization: `Bearer ${tokenBody.access_token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  const messageBody = (await readJsonResponse(messageResponse)) as {
    error?: { message?: string; status?: string };
    id?: string;
  };

  if (!messageResponse.ok) {
    return {
      error: getGmailSendErrorMessage(messageBody),
      id: "",
      ok: false,
      status: messageResponse.status || 502,
    };
  }

  return {
    error: "",
    id: messageBody.id ?? "",
    ok: true,
    status: 200,
  };
}

async function sendWithResend(input: {
  apiKey: string;
  bccEmail: string;
  clientEmail: string;
  from: string;
  html: string;
  replyTo: string;
  subject: string;
  text: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      bcc: input.bccEmail ? [input.bccEmail] : undefined,
      from: input.from,
      html: input.html,
      reply_to: input.replyTo,
      subject: input.subject,
      text: input.text,
      to: [input.clientEmail],
    }),
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `va-document-email/${crypto.randomUUID()}`,
      "User-Agent": "VA Contracting Website",
    },
    method: "POST",
  });

  const body = (await readJsonResponse(response)) as ResendResponseBody;
  if (!response.ok) {
    return {
      error: getResendErrorMessage(body, {
        from: input.from,
        status: response.status,
      }),
      id: "",
      ok: false,
      status: response.status,
    };
  }

  return {
    error: "",
    id: body.id ?? "",
    ok: true,
    status: 200,
  };
}

function buildGmailRawMessage(input: {
  bccEmail: string;
  from: string;
  html: string;
  replyTo: string;
  subject: string;
  text: string;
  to: string;
}) {
  const boundary = `va-boundary-${crypto.randomUUID()}`;
  const headers = [
    `From: ${encodeHeaderAddress(input.from)}`,
    `To: ${input.to}`,
    input.bccEmail ? `Bcc: ${input.bccEmail}` : "",
    `Reply-To: ${input.replyTo}`,
    `Subject: ${encodeMimeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);
  const body = [
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
  ];

  return base64UrlEncode([...headers, "", ...body].join("\r\n"));
}

function encodeHeaderAddress(value: string) {
  const match = value.match(/^(.*)<([^>]+)>$/);
  if (!match) return value;
  return `${encodeMimeHeader(match[1].trim())} <${match[2].trim()}>`;
}

function encodeMimeHeader(value: string) {
  return /^[\x20-\x7E]*$/.test(value)
    ? value
    : `=?UTF-8?B?${base64Encode(value)}?=`;
}

function base64UrlEncode(value: string) {
  return base64Encode(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64Encode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function extractEmailAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim();
}

async function readJsonResponse(response: Response) {
  let body: unknown = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  return body;
}

function getGmailTokenErrorMessage(body: {
  error?: string;
  error_description?: string;
}) {
  const message = [body.error, body.error_description].filter(Boolean).join(": ");
  if (
    message.includes("invalid_grant") ||
    message.includes("refresh token") ||
    message.includes("Token has been expired")
  ) {
    return "Gmail authorization expired or was rejected. Reconnect the VA Gmail account and replace GMAIL_REFRESH_TOKEN.";
  }
  if (message.includes("invalid_client")) {
    return "Gmail client credentials were rejected. Check GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET.";
  }
  return message || "Unable to authorize Gmail sending.";
}

function getGmailSendErrorMessage(body: {
  error?: { message?: string; status?: string };
}) {
  const message = body.error?.message ?? "Gmail rejected the email send request.";
  if (message.toLowerCase().includes("precondition")) {
    return "Gmail is not enabled for this account or the Gmail API has not been enabled in Google Cloud.";
  }
  if (message.toLowerCase().includes("delegation")) {
    return "Gmail rejected the sender address. Use the authorized Gmail address as ESTIMATE_FROM_EMAIL.";
  }
  return message;
}

function getResendErrorMessage(
  body: ResendResponseBody,
  context: { from: string; status: number },
) {
  const nestedError =
    typeof body.error === "string" ? body.error : body.error?.message;
  const message = nestedError || body.message || "Unable to send document email.";
  const name =
    typeof body.error === "string" ? body.name : body.error?.name || body.name;
  const normalized = `${name ?? ""} ${message}`.toLowerCase();

  if (context.status === 401 || normalized.includes("api key")) {
    return "The Resend API key is invalid or missing. Replace RESEND_API_KEY in Cloudflare Pages with the full key from Resend, then redeploy.";
  }

  if (
    normalized.includes("domain") ||
    normalized.includes("sender") ||
    normalized.includes("from")
  ) {
    return `Resend rejected the sender ${context.from}. Use a verified Resend sender or domain for ESTIMATE_FROM_EMAIL.`;
  }

  if (normalized.includes("recipient") || normalized.includes("to")) {
    return "Resend rejected the client email address. Check the recipient address and try again.";
  }

  if (name === "invalid_idempotent_request") {
    return "Resend blocked this retry because the previous request used the same sending key. Try sending again now.";
  }

  return message;
}

function maskEmail(value: string) {
  const [name = "", domain = ""] = value.split("@");
  if (!name || !domain) return "configured sender";
  const visibleName = name.length <= 2 ? name : `${name.slice(0, 2)}...`;
  return `${visibleName}@${domain}`;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-CA", {
    currency: "CAD",
    style: "currency",
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-CA", {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string) {
  if (!value) return "";
  const normalized = /^\d{4}-\d{2}-\d{2}/.test(value) ? `${value.slice(0, 10)}T00:00:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
