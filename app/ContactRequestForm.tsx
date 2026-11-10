"use client";

import { useEffect, useRef, useState } from "react";
import { business, projectTypes } from "./_site/business";

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
/** Photos are shrunk in the browser before upload so phones on mobile data send ~300 KB, not 5 MB. */
const RESIZE_TO_PX = 1800;

type Status =
  | { tone: "idle" }
  | { tone: "sending" }
  | { tone: "success"; message: string }
  | { tone: "error"; message: string; mailto?: string };

type Photo = { file: File; preview: string };

export function ContactRequestForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [projectType, setProjectType] = useState<string>(projectTypes[0]);
  const [location, setLocation] = useState("");
  const [details, setDetails] = useState("");
  const [website, setWebsite] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [status, setStatus] = useState<Status>({ tone: "idle" });
  const [touched, setTouched] = useState(false);
  const startedAt = useRef(Date.now());
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    return () => photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
    // Only revoke on unmount; individual removals revoke themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status.tone === "success" || status.tone === "error") statusRef.current?.focus();
  }, [status]);

  const contactMissing = !email.trim() && !phone.trim();
  const invalid = !name.trim() || contactMissing || details.trim().length < 10;

  async function addPhotos(fileList: FileList | null) {
    if (!fileList) return;
    const incoming = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    const room = MAX_PHOTOS - photos.length;
    const accepted: Photo[] = [];

    for (const file of incoming.slice(0, room)) {
      const prepared = await shrinkImage(file);
      if (prepared.size > MAX_PHOTO_BYTES) continue;
      accepted.push({ file: prepared, preview: URL.createObjectURL(prepared) });
    }

    setPhotos((current) => [...current, ...accepted]);
    if (incoming.length > room) {
      setStatus({ tone: "error", message: `You can attach up to ${MAX_PHOTOS} photos.` });
    }
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      URL.revokeObjectURL(current[index].preview);
      return current.filter((_, i) => i !== index);
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);

    if (invalid) {
      setStatus({
        tone: "error",
        message: contactMissing
          ? "Add an email or phone number so we can reply."
          : "Add your name and a short description of the work.",
      });
      return;
    }

    setStatus({ tone: "sending" });

    const form = new FormData();
    form.append("name", name);
    form.append("email", email);
    form.append("phone", phone);
    form.append("projectType", projectType);
    form.append("location", location);
    form.append("details", details);
    form.append("website", website);
    form.append("elapsedMs", String(Date.now() - startedAt.current));
    photos.forEach((photo) => form.append("photos", photo.file, photo.file.name));

    let saved = false;
    let notified = false;
    let requestId = 0;
    let serverMessage = "";

    try {
      const response = await fetch("/api/contact", { body: form, method: "POST" });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        notified?: boolean;
        requestId?: number;
      };
      if (response.status === 400 || response.status === 429) {
        setStatus({ tone: "error", message: data.error ?? "Check the form and try again." });
        return;
      }
      saved = response.ok;
      notified = Boolean(data.notified);
      requestId = data.requestId ?? 0;
      serverMessage = data.message ?? "";
    } catch {
      // Server unreachable: fall through to the email relay below.
    }

    // If the server could not email VA itself, relay the request to VA's inbox from the browser.
    if (!notified) {
      notified = await relayByEmail({
        details,
        email,
        location,
        name,
        phone,
        photoCount: photos.length,
        projectType,
        requestId,
        saved,
      });
    }

    if (!saved && !notified) {
      setStatus({
        tone: "error",
        message: "Your request did not go through.",
        mailto: buildMailto(),
      });
      return;
    }

    photos.forEach((photo) => URL.revokeObjectURL(photo.preview));
    setPhotos([]);
    setDetails("");
    setLocation("");
    setTouched(false);
    setStatus({
      tone: "success",
      message:
        serverMessage ||
        `Thanks ${name.trim().split(" ")[0]}, your request was sent. We will get back to you soon.`,
    });
  }

  function buildMailto() {
    const subject = `Estimate request: ${projectType}${location.trim() ? ` in ${location.trim()}` : ""}`;
    const body = [
      `Name: ${name.trim()}`,
      `Email: ${email.trim() || "Not provided"}`,
      `Phone: ${phone.trim() || "Not provided"}`,
      `Project: ${projectType}`,
      `Location: ${location.trim() || "Not provided"}`,
      "",
      details.trim(),
    ].join("\n");
    return `mailto:${business.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  const sending = status.tone === "sending";

  return (
    <form className="va-form" noValidate onSubmit={submit}>
      <div className="va-form-row">
        <label className="va-field">
          Your name
          <input
            aria-invalid={touched && !name.trim()}
            autoComplete="name"
            name="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="va-field">
          Project type
          <select name="projectType" value={projectType} onChange={(event) => setProjectType(event.target.value)}>
            {projectTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="va-form-row">
        <label className="va-field">
          Phone
          <input
            aria-invalid={touched && contactMissing}
            autoComplete="tel"
            inputMode="tel"
            name="phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
        <label className="va-field">
          Email
          <input
            aria-invalid={touched && contactMissing}
            autoComplete="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
      </div>

      <label className="va-field">
        <span>
          Project address or area <small>(a street or neighbourhood is enough)</small>
        </span>
        <input
          autoComplete="street-address"
          name="location"
          placeholder="e.g. Maple, Vaughan"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
        />
      </label>

      <label className="va-field">
        What do you need done?
        <textarea
          aria-invalid={touched && details.trim().length < 10}
          name="details"
          placeholder="Size of the space, what you want changed, and roughly when you would like it done."
          required
          rows={5}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
        />
      </label>

      <div className="va-field">
        <span id="photo-label">
          Photos <small>(optional, up to {MAX_PHOTOS})</small>
        </span>
        <label className="va-file-drop">
          <input
            accept="image/*"
            aria-labelledby="photo-label"
            disabled={photos.length >= MAX_PHOTOS || sending}
            multiple
            type="file"
            onChange={(event) => {
              void addPhotos(event.target.files);
              event.target.value = "";
            }}
          />
          {photos.length >= MAX_PHOTOS ? "Photo limit reached" : "Add photos of the space"}
          <small>Taken on your phone is fine</small>
        </label>
        {photos.length ? (
          <ul className="va-thumbs">
            {photos.map((photo, index) => (
              <li key={photo.preview}>
                <img alt={`Attached photo ${index + 1}`} src={photo.preview} />
                <button aria-label={`Remove photo ${index + 1}`} type="button" onClick={() => removePhoto(index)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="va-honeypot" aria-hidden="true">
        <label>
          Leave this empty
          <input autoComplete="off" name="website" tabIndex={-1} value={website} onChange={(event) => setWebsite(event.target.value)} />
        </label>
      </div>

      {status.tone === "error" || status.tone === "success" ? (
        <p className="va-form-status" data-tone={status.tone} ref={statusRef} role="status" tabIndex={-1}>
          {status.message}
          {status.tone === "error" && status.mailto ? (
            <>
              {" "}
              <a href={status.mailto}>Send it by email instead</a> or call{" "}
              <a href={business.phoneHref}>{business.phoneDisplay}</a>.
            </>
          ) : null}
        </p>
      ) : null}

      <button className="va-button va-button-primary" disabled={sending} type="submit">
        {sending ? "Sending request…" : "Send request"}
      </button>
      <p className="va-form-note">
        We only use your details to reply about this project. Add an email or a phone number, whichever you prefer.
      </p>
    </form>
  );
}

/**
 * Sends the request to VA's inbox through FormSubmit (formsubmit.co), a free
 * form-to-email relay that needs no account or keys. The first request ever
 * sent triggers an "Activate Form" email to VA; after one click it delivers.
 */
async function relayByEmail(input: {
  details: string;
  email: string;
  location: string;
  name: string;
  phone: string;
  photoCount: number;
  projectType: string;
  requestId: number;
  saved: boolean;
}) {
  const origin = window.location.origin;
  try {
    const response = await fetch(`https://formsubmit.co/ajax/${business.formRelay}`, {
      body: JSON.stringify({
        _subject: `New estimate request: ${input.projectType}${input.location.trim() ? `, ${input.location.trim()}` : ""} (${input.name.trim()})`,
        _template: "table",
        _captcha: "false",
        ...(input.email.trim() ? { _replyto: input.email.trim() } : {}),
        Name: input.name.trim(),
        Phone: input.phone.trim() || "Not provided",
        Email: input.email.trim() || "Not provided",
        Project: input.projectType,
        Location: input.location.trim() || "Not provided",
        Details: input.details.trim(),
        Photos: input.photoCount
          ? `${input.photoCount} attached. View them in the employee portal: ${origin}/employee`
          : "None attached",
        Reference: input.saved && input.requestId ? `Request #${input.requestId} in the employee portal` : "Not saved in the portal",
      }),
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      method: "POST",
    });
    const data = (await response.json().catch(() => ({}))) as { success?: string | boolean };
    return response.ok && (data.success === true || data.success === "true");
  } catch {
    return false;
  }
}

/** Downscale large phone photos to a JPEG before upload. Falls back to the original file. */
async function shrinkImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, RESIZE_TO_PX / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
