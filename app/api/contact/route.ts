import { business, fullAddress } from "../../_site/business";
import { escapeHtml, isEmail, sendSiteEmail } from "../_lib/mailer";
import {
  getCurrentEmployee,
  getDatabase,
  getMediaBucket,
  toAuthError,
} from "../auth/_lib/employee-auth";
import { ensureContactTable, toQuoteRequest } from "./_store";

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_PER_HOUR = 5;
/** Real people take longer than this to fill in the form; bots usually don't. */
const MIN_FILL_MS = 2500;

/** Employees: list quote requests, newest first. */
export async function GET(request: Request) {
  try {
    const employee = await getCurrentEmployee(request);
    if (!employee) {
      return Response.json({ error: "Employee sign-in required." }, { status: 401 });
    }
    await ensureContactTable();
    const rows = await (await getDatabase())
      .prepare("SELECT * FROM contact_requests ORDER BY created_at DESC, id DESC LIMIT 200")
      .all();
    return Response.json({ requests: rows.results.map(toQuoteRequest) });
  } catch (error) {
    const authError = toAuthError(error);
    return Response.json({ error: authError.message }, { status: authError.status });
  }
}

/** Public: a visitor submits the quote form. */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "The form could not be read. Refresh the page and try again." }, { status: 400 });
  }

  // Spam traps: a hidden field bots fill in, and a submit that came too fast.
  // Pretend success so bots get no signal.
  const elapsed = Number(form.get("elapsedMs") ?? 0);
  if (text(form, "website", 200) || (elapsed > 0 && elapsed < MIN_FILL_MS)) {
    return Response.json({ ok: true }, { status: 201 });
  }

  const name = text(form, "name", 100);
  const email = text(form, "email", 160).toLowerCase();
  const phone = text(form, "phone", 40);
  const projectType = text(form, "projectType", 80);
  const location = text(form, "location", 160);
  const details = longText(form, "details", 4000);

  if (!name) return Response.json({ error: "Add your name so we know who to reply to." }, { status: 400 });
  if (!email && !phone) return Response.json({ error: "Add an email or phone number so we can reply." }, { status: 400 });
  if (email && !isEmail(email)) return Response.json({ error: "That email address does not look right." }, { status: 400 });
  if (phone && phone.replace(/\D/g, "").length < 7) {
    return Response.json({ error: "That phone number looks too short." }, { status: 400 });
  }
  if (details.length < 10) {
    return Response.json({ error: "Add a sentence or two about the work you need done." }, { status: 400 });
  }

  const photos = form
    .getAll("photos")
    .filter((value): value is File => value instanceof File && value.size > 0)
    .slice(0, MAX_PHOTOS);
  for (const photo of photos) {
    if (!photo.type.startsWith("image/")) {
      return Response.json({ error: "Only image files can be attached." }, { status: 400 });
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      return Response.json({ error: "Each photo must be 8 MB or smaller." }, { status: 400 });
    }
  }

  const ipHash = await hashIp(request.headers.get("cf-connecting-ip") ?? "");
  let saved = false;
  let requestId = 0;
  const photoKeys: string[] = [];

  try {
    await ensureContactTable();
    const db = await getDatabase();

    if (ipHash) {
      const recent = await db
        .prepare(
          "SELECT COUNT(*) AS count FROM contact_requests WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')",
        )
        .bind(ipHash)
        .first<{ count: number }>();
      if ((recent?.count ?? 0) >= MAX_PER_HOUR) {
        return Response.json(
          { error: `Too many requests from this connection. Please call ${business.phoneDisplay} instead.` },
          { status: 429 },
        );
      }
    }

    if (photos.length) {
      const bucket = await getMediaBucket();
      for (const photo of photos) {
        const key = `quote-${crypto.randomUUID()}-${cleanFilename(photo.name)}`;
        await bucket.put(key, await photo.arrayBuffer(), {
          httpMetadata: { contentType: photo.type || "image/jpeg" },
        });
        photoKeys.push(key);
      }
    }

    const result = await db
      .prepare(
        `INSERT INTO contact_requests (name, email, phone, project_type, location, details, photo_keys, ip_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .bind(name, email, phone, projectType, location, details, JSON.stringify(photoKeys), ipHash)
      .first<{ id: number }>();
    requestId = result?.id ?? 0;
    saved = true;
  } catch (error) {
    console.error("contact: could not save request", error);
  }

  const origin = new URL(request.url).origin;
  const mail = await sendSiteEmail({
    to: await notifyAddress(),
    replyTo: email || undefined,
    subject: `New estimate request: ${projectType || "Project"}${location ? `, ${location}` : ""} (${name})`,
    text: [
      `New estimate request from the website${requestId ? ` (#${requestId})` : ""}.`,
      "",
      `Name: ${name}`,
      `Phone: ${phone || "Not provided"}`,
      `Email: ${email || "Not provided"}`,
      `Project: ${projectType || "Not specified"}`,
      `Location: ${location || "Not provided"}`,
      "",
      details,
      "",
      photoKeys.length ? `${photoKeys.length} photo(s) attached. View them in the employee portal: ${origin}/employee` : "No photos attached.",
    ].join("\n"),
    html: buildEmailHtml({ details, email, location, name, origin, phone, photoCount: photoKeys.length, projectType, requestId }),
  });

  if (saved && requestId) {
    try {
      await (await getDatabase())
        .prepare("UPDATE contact_requests SET email_status = ? WHERE id = ?")
        .bind(mail.ok ? `sent via ${mail.provider}` : `failed: ${mail.error}`.slice(0, 300), requestId)
        .run();
    } catch {
      // Non-critical bookkeeping.
    }
  }

  // Confirmation to the customer, sent from VA's own address. Only when the
  // provider is working, so a broken setup never produces half-sent mail.
  if (mail.ok && email) {
    await sendSiteEmail({
      to: email,
      replyTo: business.email,
      subject: "We received your estimate request | VA Contracting",
      text: [
        `Hi ${name.split(" ")[0]},`,
        "",
        `Thanks for contacting VA Contracting about your ${projectType ? projectType.toLowerCase() : "project"}. We have your request and will get back to you soon to talk it through or set up a site visit.`,
        "",
        "If you have more photos or details, just reply to this email.",
        `Prefer to talk? Call ${business.phoneDisplay}.`,
        "",
        "VA Contracting Inc.",
        fullAddress,
      ].join("\n"),
      html: buildConfirmationHtml(name.split(" ")[0], projectType),
    }).catch(() => undefined);
  }

  if (!saved && !mail.ok) {
    console.error("contact: request neither saved nor emailed", mail.error);
    return Response.json(
      { error: "Your request could not be delivered right now.", notified: false, requestId: 0 },
      { status: 503 },
    );
  }

  return Response.json(
    {
      message: `Thanks ${name.split(" ")[0]}, your request was sent. We will get back to you soon.`,
      // false tells the browser to relay the request to VA's inbox itself.
      notified: mail.ok,
      ok: true,
      requestId,
    },
    { status: 201 },
  );
}

async function notifyAddress() {
  const { env } = await import("cloudflare:workers");
  const configured = String((env as unknown as Record<string, unknown>).CONTACT_NOTIFY_EMAIL ?? "").trim();
  return isEmail(configured) ? configured : business.email;
}

function text(form: FormData, key: string, max: number) {
  return String(form.get(key) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function longText(form: FormData, key: string, max: number) {
  return String(form.get(key) ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function cleanFilename(name: string) {
  return name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "photo.jpg";
}

async function hashIp(ip: string) {
  if (!ip) return "";
  // Daily salt: enough to rate-limit, without keeping a stable identifier for visitors.
  const day = new Date().toISOString().slice(0, 10);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${day}:${ip}`));
  return Array.from(new Uint8Array(digest).slice(0, 12), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function buildConfirmationHtml(firstName: string, projectType: string) {
  return `<!doctype html><html><body style="margin:0;background:#e9e7e2;font-family:Arial,Helvetica,sans-serif;color:#14181f">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#0d2a54;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;font-size:20px;font-weight:700">VA Contracting</div>
    <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px;line-height:1.55;font-size:15px">
      <p style="margin:0 0 12px">Hi ${escapeHtml(firstName)},</p>
      <p style="margin:0 0 12px">Thanks for contacting VA Contracting about your ${escapeHtml(projectType ? projectType.toLowerCase() : "project")}. We have your request and will get back to you soon to talk it through or set up a site visit.</p>
      <p style="margin:0 0 12px">If you have more photos or details, just reply to this email. Prefer to talk? Call <a href="${business.phoneHref}">${business.phoneDisplay}</a>.</p>
      <p style="margin:18px 0 0;color:#545a63;font-size:13px">VA Contracting Inc. · ${escapeHtml(fullAddress)}</p>
    </div>
  </div></body></html>`;
}

function buildEmailHtml(input: {
  details: string;
  email: string;
  location: string;
  name: string;
  origin: string;
  phone: string;
  photoCount: number;
  projectType: string;
  requestId: number;
}) {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#545a63;white-space:nowrap">${label}</td><td style="padding:6px 0;font-weight:600">${value}</td></tr>`;
  const phoneLink = input.phone
    ? `<a href="tel:${escapeHtml(input.phone.replace(/[^\d+]/g, ""))}">${escapeHtml(input.phone)}</a>`
    : "Not provided";
  const emailLink = input.email ? `<a href="mailto:${escapeHtml(input.email)}">${escapeHtml(input.email)}</a>` : "Not provided";

  return `<!doctype html><html><body style="margin:0;background:#e9e7e2;font-family:Arial,Helvetica,sans-serif;color:#14181f">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#0d2a54;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
      <div style="font-size:13px;opacity:.8">VA Contracting website${input.requestId ? ` · request #${input.requestId}` : ""}</div>
      <div style="font-size:22px;font-weight:700;margin-top:4px">New estimate request</div>
    </div>
    <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px">
      <table style="border-collapse:collapse;font-size:15px">
        ${row("Name", escapeHtml(input.name))}
        ${row("Phone", phoneLink)}
        ${row("Email", emailLink)}
        ${row("Project", escapeHtml(input.projectType || "Not specified"))}
        ${row("Location", escapeHtml(input.location || "Not provided"))}
      </table>
      <div style="margin-top:18px;padding:16px;background:#f4f3f0;border-radius:6px;white-space:pre-wrap;line-height:1.5">${escapeHtml(input.details)}</div>
      <p style="margin:18px 0 0;font-size:14px;color:#545a63">${
        input.photoCount
          ? `${input.photoCount} photo${input.photoCount === 1 ? "" : "s"} attached. <a href="${input.origin}/employee">Open the employee portal</a> to view them.`
          : "No photos attached."
      }</p>
      <p style="margin:12px 0 0;font-size:13px;color:#7a7f87">Reply to this email to answer the customer directly${input.email ? "" : " (they left a phone number only)"}.</p>
    </div>
    <p style="font-size:12px;color:#7a7f87;text-align:center">${escapeHtml(fullAddress)}</p>
  </div></body></html>`;
}
