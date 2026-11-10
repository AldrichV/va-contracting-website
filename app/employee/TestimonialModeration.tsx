"use client";

import { useEffect, useMemo, useState } from "react";

type Testimonial = {
  comment: string;
  createdAt: string;
  customerName: string;
  id: number;
  imageUrl: string;
  location: string;
  moderationReason: string;
  projectType: string;
  rating: number;
  status: string;
};

const moderationReasons = {
  approved: "",
  flagged: "Needs review: possible spam or inappropriate language",
  hidden: "Hidden from public testimonials",
  pending: "",
};

export function TestimonialModeration() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const pendingCount = useMemo(
    () => testimonials.filter((testimonial) => testimonial.status === "pending").length,
    [testimonials],
  );

  useEffect(() => {
    loadTestimonials();
  }, []);

  async function loadTestimonials() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/testimonials?all=1");
      const data = (await response.json()) as {
        error?: string;
        testimonials?: Testimonial[];
      };
      if (!response.ok) throw new Error(data.error ?? "Unable to load testimonials.");
      setTestimonials(data.testimonials ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load testimonials.");
    } finally {
      setLoading(false);
    }
  }

  async function moderate(testimonialId: number, status: keyof typeof moderationReasons) {
    setError("");
    setMessage("");
    const response = await fetch(`/api/testimonials/${testimonialId}`, {
      body: JSON.stringify({
        moderationReason: moderationReasons[status],
        status,
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Unable to update testimonial.");
      return;
    }
    setTestimonials((current) =>
      current.map((testimonial) =>
        testimonial.id === testimonialId
          ? {
              ...testimonial,
              moderationReason: moderationReasons[status],
              status,
            }
          : testimonial,
      ),
    );
    setMessage("Review updated.");
  }

  async function deleteTestimonial(testimonialId: number) {
    setError("");
    setMessage("");
    const response = await fetch(`/api/testimonials/${testimonialId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("Unable to delete testimonial.");
      return;
    }
    setTestimonials((current) =>
      current.filter((testimonial) => testimonial.id !== testimonialId),
    );
    setMessage("Review deleted.");
  }

  return (
    <section className="moderation-workspace">
      <div className="moderation-heading">
        <div>
          <p className="eyebrow">Testimonials</p>
          <h2>Review customer submissions.</h2>
          <p>Approve strong testimonials or remove anything spammy, hateful, or not ideal.</p>
        </div>
        <button type="button" onClick={loadTestimonials}>
          Refresh
        </button>
      </div>

      <div className="moderation-summary">
        <strong>{pendingCount}</strong>
        <span>Pending review</span>
      </div>

      {message ? <p className="testimonial-message">{message}</p> : null}
      {error ? <p className="auth-error">{error}</p> : null}
      {loading ? <p className="portal-empty">Loading testimonials...</p> : null}
      {!loading && testimonials.length === 0 ? (
        <p className="portal-empty">No customer testimonials submitted yet.</p>
      ) : null}

      <div className="moderation-list">
        {testimonials.map((testimonial) => (
          <article className="moderation-card" key={testimonial.id}>
            <div>
              <span className={`review-status ${testimonial.status}`}>
                {testimonial.status}
              </span>
              <h3>{testimonial.customerName}</h3>
              <p className="moderation-meta">
                {"★".repeat(testimonial.rating)}
                {"☆".repeat(5 - testimonial.rating)}
                {[testimonial.projectType, testimonial.location].filter(Boolean).join(" · ")}
              </p>
              {testimonial.imageUrl ? (
                <img
                  className="moderation-photo"
                  src={testimonial.imageUrl}
                  alt={`${testimonial.projectType || "Project"} uploaded with testimonial`}
                />
              ) : null}
              <p>“{testimonial.comment}”</p>
              {testimonial.moderationReason ? (
                <small>{testimonial.moderationReason}</small>
              ) : null}
            </div>
            <div className="moderation-actions">
              <button type="button" onClick={() => moderate(testimonial.id, "approved")}>
                Approve
              </button>
              <button type="button" onClick={() => moderate(testimonial.id, "flagged")}>
                Flag
              </button>
              <button type="button" onClick={() => moderate(testimonial.id, "hidden")}>
                Hide
              </button>
              <button type="button" onClick={() => deleteTestimonial(testimonial.id)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
