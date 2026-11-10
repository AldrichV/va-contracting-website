"use client";

import { useEffect, useMemo, useState } from "react";

type QuoteRequest = {
  createdAt: string;
  details: string;
  email: string;
  emailStatus: string;
  id: number;
  location: string;
  name: string;
  notes: string;
  phone: string;
  photoUrls: string[];
  projectType: string;
  status: string;
};

const statuses = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "quoted", label: "Quoted" },
  { id: "won", label: "Won" },
  { id: "closed", label: "Closed" },
] as const;

type Filter = "open" | "all" | (typeof statuses)[number]["id"];

export function QuoteRequests() {
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("open");
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/contact");
      const data = (await response.json().catch(() => ({}))) as { error?: string; requests?: QuoteRequest[] };
      if (!response.ok) throw new Error(data.error ?? "Unable to load quote requests.");
      setRequests(data.requests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load quote requests.");
    } finally {
      setLoading(false);
    }
  }

  async function update(id: number, patch: { notes?: string; status?: string }) {
    setError("");
    const response = await fetch(`/api/contact/${id}`, {
      body: JSON.stringify(patch),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; request?: QuoteRequest };
    if (!response.ok || !data.request) {
      setError(data.error ?? "Unable to update the request.");
      return;
    }
    setRequests((current) => current.map((item) => (item.id === id ? data.request! : item)));
    setDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  const newCount = useMemo(() => requests.filter((item) => item.status === "new").length, [requests]);
  const visible = useMemo(() => {
    if (filter === "all") return requests;
    if (filter === "open") return requests.filter((item) => !["won", "closed"].includes(item.status));
    return requests.filter((item) => item.status === filter);
  }, [filter, requests]);

  return (
    <section className="moderation-workspace">
      <div className="moderation-heading">
        <div>
          <p className="eyebrow">Quote requests</p>
          <h2>Requests from the website.</h2>
          <p>Every form submission lands here, including photos. Update the status as you follow up.</p>
        </div>
        <button type="button" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      <div className="moderation-summary">
        <strong>{newCount}</strong>
        <span>New, not yet contacted</span>
      </div>

      <div className="quote-filters" role="group" aria-label="Filter requests">
        {(["open", "all", ...statuses.map((s) => s.id)] as Filter[]).map((option) => (
          <button aria-pressed={filter === option} key={option} type="button" onClick={() => setFilter(option)}>
            {option === "open" ? "Open" : option === "all" ? "All" : statuses.find((s) => s.id === option)?.label}
          </button>
        ))}
      </div>

      {error ? <p className="auth-error">{error}</p> : null}
      {loading ? <p className="portal-empty">Loading requests...</p> : null}
      {!loading && visible.length === 0 ? (
        <p className="portal-empty">
          {requests.length === 0 ? "No requests yet. New website submissions will show up here." : "Nothing in this view."}
        </p>
      ) : null}

      <div className="moderation-list">
        {visible.map((item) => (
          <article className="moderation-card quote-card" key={item.id}>
            <div>
              <span className={`review-status quote-status-${item.status}`}>{item.status}</span>
              <h3>
                {item.name} <small>#{item.id}</small>
              </h3>
              <p className="moderation-meta">
                {[item.projectType, item.location, formatDate(item.createdAt)].filter(Boolean).join(" · ")}
              </p>
              <p className="quote-contact">
                {item.phone ? <a href={`tel:${item.phone.replace(/[^\d+]/g, "")}`}>{item.phone}</a> : null}
                {item.email ? (
                  <a href={`mailto:${item.email}?subject=${encodeURIComponent(`Your ${item.projectType || "project"} estimate request`)}`}>
                    {item.email}
                  </a>
                ) : null}
              </p>
              <p className="quote-details">{item.details}</p>
              {item.photoUrls.length ? (
                <div className="quote-photos">
                  {item.photoUrls.map((url, index) => (
                    <a href={url} key={url} rel="noreferrer" target="_blank">
                      <img alt={`Photo ${index + 1} from ${item.name}`} loading="lazy" src={url} />
                    </a>
                  ))}
                </div>
              ) : null}
              {item.emailStatus.startsWith("failed") ? (
                <p className="quote-warning">Email notification failed for this one, so it only appears here.</p>
              ) : null}
              <label className="quote-notes">
                Internal notes
                <textarea
                  rows={2}
                  value={drafts[item.id] ?? item.notes}
                  onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                />
              </label>
            </div>
            <div className="moderation-actions">
              {statuses.map((status) => (
                <button
                  aria-pressed={item.status === status.id}
                  disabled={item.status === status.id}
                  key={status.id}
                  type="button"
                  onClick={() => void update(item.id, { status: status.id })}
                >
                  {status.label}
                </button>
              ))}
              {drafts[item.id] !== undefined && drafts[item.id] !== item.notes ? (
                <button type="button" onClick={() => void update(item.id, { notes: drafts[item.id] })}>
                  Save notes
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
