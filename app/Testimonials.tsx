"use client";

import { useEffect, useRef, useState } from "react";

type Testimonial = {
  comment: string;
  customerName: string;
  id: number;
  imageUrl: string;
  location: string;
  projectType: string;
  rating: number;
};

type Draft = {
  comment: string;
  customerName: string;
  location: string;
  projectType: string;
  rating: number;
  website: string;
};

const emptyDraft: Draft = { comment: "", customerName: "", location: "", projectType: "", rating: 5, website: "" };
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export function Testimonials() {
  const [reviews, setReviews] = useState<Testimonial[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/testimonials")
      .then((response) => (response.ok ? response.json() : { testimonials: [] }))
      .then((data: { testimonials?: Testimonial[] }) => {
        if (active) setReviews(data.testimonials ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    if (status) statusRef.current?.focus();
  }, [status]);

  function chooseImage(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    if (file && file.size > MAX_IMAGE_BYTES) {
      setStatus({ tone: "error", message: "That photo is larger than 6 MB. Choose a smaller one." });
      setImage(null);
      setPreview("");
      return;
    }
    setImage(file);
    setPreview(file ? URL.createObjectURL(file) : "");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    if (!draft.customerName.trim() || draft.comment.trim().length < 20) {
      setStatus({ tone: "error", message: "Add your name and at least a couple of sentences about the job." });
      return;
    }

    setSending(true);
    const form = new FormData();
    Object.entries(draft).forEach(([key, value]) => form.append(key, String(value)));
    if (image) form.append("image", image);

    try {
      const response = await fetch("/api/testimonials", { body: form, method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) {
        setStatus({ tone: "error", message: data.error ?? "Your review was not sent. Try again in a moment." });
        return;
      }
      setDraft(emptyDraft);
      chooseImage(null);
      setStatus({
        tone: "success",
        message: data.message ?? "Thanks. Your review was sent and will appear here once it has been checked.",
      });
    } catch {
      setStatus({ tone: "error", message: "We could not reach the server. Check your connection and try again." });
    } finally {
      setSending(false);
    }
  }

  const hasReviews = reviews.length > 0;
  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  return (
    <section className="va-reviews" id="reviews" aria-labelledby="reviews-title">
      <div className="va-section">
        {hasReviews ? (
          <>
            <header className="va-section-head">
              <h2 id="reviews-title">What customers say</h2>
            </header>
            <div className="va-review-grid">
              {reviews.slice(0, 6).map((review) => (
                <figure className="va-review" key={review.id}>
                  {review.imageUrl ? (
                    <img
                      alt={`${review.projectType || "Project"} for ${review.customerName}`}
                      loading="lazy"
                      src={review.imageUrl}
                    />
                  ) : null}
                  <div className="va-review-body">
                    <div className="va-stars" aria-label={`${review.rating} out of 5 stars`}>
                      {"★".repeat(review.rating)}
                      <span aria-hidden="true" style={{ opacity: 0.25 }}>
                        {"★".repeat(5 - review.rating)}
                      </span>
                    </div>
                    <blockquote>
                      <p>{review.comment}</p>
                    </blockquote>
                    <figcaption>
                      <strong>{review.customerName}</strong>
                      {[review.projectType, review.location].filter(Boolean).join(", ")}
                    </figcaption>
                  </div>
                </figure>
              ))}
            </div>
          </>
        ) : null}

        <div className="va-review-cta" style={hasReviews ? undefined : { borderTop: 0, marginTop: 0, paddingTop: 0 }}>
          <div>
            {hasReviews ? null : (
              <h2 id="reviews-title" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: 8 }}>
                Worked with us before?
              </h2>
            )}
            <p>
              {hasReviews || !loaded
                ? "Had work done by VA Contracting? A short review helps other homeowners decide."
                : "Tell other homeowners how the job went. Reviews appear here once we have checked them."}
            </p>
          </div>
          <button
            aria-controls="review-form"
            aria-expanded={formOpen}
            className="va-review-toggle"
            type="button"
            onClick={() => setFormOpen((value) => !value)}
          >
            {formOpen ? "Close review form" : "Leave a review"}
          </button>
        </div>

        {formOpen ? (
          <form className="va-form va-review-form" id="review-form" noValidate onSubmit={submit}>
            <div className="va-honeypot" aria-hidden="true">
              <label>
                Leave this empty
                <input autoComplete="off" tabIndex={-1} value={draft.website} onChange={(e) => update({ website: e.target.value })} />
              </label>
            </div>
            <div className="va-form-row">
              <label className="va-field">
                Your name
                <input autoComplete="name" required value={draft.customerName} onChange={(e) => update({ customerName: e.target.value })} />
              </label>
              <label className="va-field">
                Rating
                <select value={draft.rating} onChange={(e) => update({ rating: Number(e.target.value) })}>
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} star{value === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="va-form-row">
              <label className="va-field">
                What did we do?
                <input placeholder="Kitchen, deck, interlock..." value={draft.projectType} onChange={(e) => update({ projectType: e.target.value })} />
              </label>
              <label className="va-field">
                City or area
                <input placeholder="Vaughan, Toronto..." value={draft.location} onChange={(e) => update({ location: e.target.value })} />
              </label>
            </div>
            <label className="va-field">
              Your review
              <textarea minLength={20} required rows={5} value={draft.comment} onChange={(e) => update({ comment: e.target.value })} />
            </label>
            <div className="va-field">
              <span id="review-photo-label">
                Photo of the finished work <small>(optional, up to 6 MB)</small>
              </span>
              <label className="va-file-drop">
                <input
                  accept="image/*"
                  aria-labelledby="review-photo-label"
                  type="file"
                  onChange={(e) => {
                    chooseImage(e.target.files?.item(0) ?? null);
                    e.target.value = "";
                  }}
                />
                {image ? "Replace photo" : "Add a photo"}
              </label>
              {preview ? (
                <ul className="va-thumbs">
                  <li>
                    <img alt="Selected photo" src={preview} />
                    <button aria-label="Remove photo" type="button" onClick={() => chooseImage(null)}>
                      ×
                    </button>
                  </li>
                </ul>
              ) : null}
            </div>
            {status ? (
              <p className="va-form-status" data-tone={status.tone} ref={statusRef} role="status" tabIndex={-1}>
                {status.message}
              </p>
            ) : null}
            <button className="va-button va-button-primary" disabled={sending} type="submit">
              {sending ? "Sending review…" : "Send review"}
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
