"use client";

import { useEffect, useState } from "react";

type JobsiteSummary = {
  address: string;
  clientName: string;
  estimateCount: number;
  estimateTotal: number;
  id: number;
  name: string;
  status: string;
};

type EstimateSummary = {
  clientName: string;
  createdAt: string;
  estimateNumber: string;
  id: number;
  jobsiteId: number | null;
  jobsiteName: string;
  projectType: string;
  status: string;
  total: number;
};

export function JobsiteDashboard() {
  const [jobsites, setJobsites] = useState<JobsiteSummary[]>([]);
  const [estimates, setEstimates] = useState<EstimateSummary[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingJobsite, setSavingJobsite] = useState(false);
  const [newJobsite, setNewJobsite] = useState({
    address: "",
    clientName: "",
    name: "",
    status: "Active",
  });

  async function loadDashboard(active = true) {
    try {
      const [jobsiteResponse, estimateResponse] = await Promise.all([
        fetch("/api/jobsites"),
        fetch("/api/estimates"),
      ]);
      const jobsiteData = (await jobsiteResponse.json()) as {
        error?: string;
        jobsites?: JobsiteSummary[];
      };
      const estimateData = (await estimateResponse.json()) as {
        error?: string;
        estimates?: EstimateSummary[];
      };
      if (!jobsiteResponse.ok) {
        throw new Error(jobsiteData.error ?? "Unable to load jobsites.");
      }
      if (!estimateResponse.ok) {
        throw new Error(estimateData.error ?? "Unable to load estimates.");
      }
      if (active) {
        setJobsites(jobsiteData.jobsites ?? []);
        setEstimates(estimateData.estimates ?? []);
        setError("");
      }
    } catch (err) {
      if (active) {
        setError(err instanceof Error ? err.message : "Unable to load dashboard.");
      }
    }
  }

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => loadDashboard(active));

    const refresh = () => loadDashboard(active);
    window.addEventListener("va-employee-data-updated", refresh);

    return () => {
      active = false;
      window.removeEventListener("va-employee-data-updated", refresh);
    };
  }, []);

  async function createJobsite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const name = newJobsite.name.trim();
    if (!name) {
      setError("Add a jobsite name before saving.");
      return;
    }

    setSavingJobsite(true);
    try {
      const response = await fetch("/api/jobsites", {
        body: JSON.stringify({
          address: newJobsite.address,
          clientName: newJobsite.clientName,
          name,
          status: newJobsite.status,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as {
        error?: string;
        jobsite?: JobsiteSummary;
      };

      if (!response.ok || !data.jobsite) {
        throw new Error(data.error ?? "Unable to create jobsite.");
      }

      setJobsites((current) => [
        { ...data.jobsite!, estimateCount: 0, estimateTotal: 0 },
        ...current,
      ]);
      setNewJobsite({
        address: "",
        clientName: "",
        name: "",
        status: "Active",
      });
      setMessage(`${data.jobsite.name} was added as a jobsite.`);
      window.dispatchEvent(new Event("va-employee-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create jobsite.");
    } finally {
      setSavingJobsite(false);
    }
  }

  const activeJobsites = jobsites.filter((jobsite) => jobsite.status !== "Complete");
  const recentEstimates = estimates.slice(0, 4);

  return (
    <section className="job-dashboard">
      <div className="job-dashboard-heading">
        <div>
          <p className="eyebrow">Jobsite dashboard</p>
          <h2>Track each job from estimate to invoice.</h2>
        </div>
        <div className="job-dashboard-stat">
          <span>Active jobsites</span>
          <strong>{activeJobsites.length}</strong>
        </div>
      </div>

      {error ? <p className="auth-error">{error}</p> : null}
      {message ? <p className="testimonial-message">{message}</p> : null}

      <form className="jobsite-form" onSubmit={createJobsite}>
        <h3>Create a jobsite tag</h3>
        <div className="jobsite-form-grid">
          <label>
            Jobsite name
            <input
              placeholder="1257 Eglinton"
              value={newJobsite.name}
              onChange={(event) =>
                setNewJobsite((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Client
            <input
              placeholder="Client name"
              value={newJobsite.clientName}
              onChange={(event) =>
                setNewJobsite((current) => ({
                  ...current,
                  clientName: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Address
            <input
              placeholder="Project address"
              value={newJobsite.address}
              onChange={(event) =>
                setNewJobsite((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Status
            <select
              value={newJobsite.status}
              onChange={(event) =>
                setNewJobsite((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
            >
              <option>Active</option>
              <option>Quoted</option>
              <option>In progress</option>
              <option>Complete</option>
            </select>
          </label>
        </div>
        <button disabled={savingJobsite} type="submit">
          {savingJobsite ? "Saving..." : "Save jobsite"}
        </button>
      </form>

      <div className="jobsite-grid">
        {jobsites.length === 0 ? (
          <p className="portal-empty">Create a jobsite tag below to start tracking work.</p>
        ) : null}
        {jobsites.map((jobsite) => (
          <article className="jobsite-card" key={jobsite.id}>
            <div>
              <span>{jobsite.status}</span>
              <h3>{jobsite.name}</h3>
              <p>{jobsite.clientName || "No client added yet"}</p>
              {jobsite.address ? <p>{jobsite.address}</p> : null}
            </div>
            <dl>
              <div>
                <dt>Quoted</dt>
                <dd>
                  {jobsite.estimateCount} saved / {currency(jobsite.estimateTotal)}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      {recentEstimates.length > 0 ? (
        <div className="estimate-history">
          <h3>Recent saved estimates</h3>
          {recentEstimates.map((estimate) => (
            <article key={estimate.id}>
              <div>
                <strong>{estimate.estimateNumber}</strong>
                <p>
                  {estimate.jobsiteName || estimate.clientName || "Unassigned jobsite"} -{" "}
                  {estimate.projectType}
                </p>
              </div>
              <div>
                <span>{estimate.status}</span>
                <strong>{currency(estimate.total)}</strong>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function currency(value: number) {
  return new Intl.NumberFormat("en-CA", {
    currency: "CAD",
    style: "currency",
  }).format(Number.isFinite(value) ? value : 0);
}
