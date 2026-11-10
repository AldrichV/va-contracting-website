"use client";

import { useEffect, useState } from "react";
import { EstimateBuilder } from "./EstimateBuilder.tsx";
import { JobsiteDashboard } from "./JobsiteDashboard.tsx";
import { QuoteRequests } from "./QuoteRequests.tsx";
import { TestimonialModeration } from "./TestimonialModeration.tsx";

type Employee = {
  email: string;
  id: number;
  name: string;
};

type AuthMode = "login" | "register";
type Workspace = "requests" | "overview" | "estimates" | "invoices" | "testimonials";

const workspaceTabs: { id: Workspace; label: string }[] = [
  { id: "overview", label: "Jobsites" },
  { id: "requests", label: "Quote requests" },
  { id: "estimates", label: "Estimates" },
  { id: "invoices", label: "Invoices" },
  { id: "testimonials", label: "Testimonials" },
];

export function EmployeePortal() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AuthMode>("login");
  const [workspace, setWorkspace] = useState<Workspace>("overview");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data: { employee: Employee | null }) => {
        if (active) setEmployee(data.employee);
      })
      .catch(() => {
        if (active) setError("Unable to check the current employee session.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const response = await fetch(endpoint, {
      body: JSON.stringify({ email, name, password }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = (await response.json()) as {
      employee?: Employee;
      error?: string;
    };

    if (!response.ok || !data.employee) {
      setError(data.error ?? "Unable to sign in.");
      setLoading(false);
      return;
    }

    setEmployee(data.employee);
    setPassword("");
    setLoading(false);
  }

  async function signOut() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    setEmployee(null);
    setLoading(false);
  }

  if (employee) {
    return (
      <>
        <section className="employee-session">
          <div>
            <span>Signed in</span>
            <strong>{employee.name}</strong>
            <p>{employee.email}</p>
          </div>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </section>
        <nav className="employee-workspace-tabs" aria-label="Employee workspace">
          {workspaceTabs.map((tab) => (
            <button
              aria-pressed={workspace === tab.id}
              key={tab.id}
              type="button"
              onClick={() => setWorkspace(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        {workspace === "requests" ? <QuoteRequests /> : null}
        {workspace === "overview" ? <JobsiteDashboard /> : null}
        {workspace === "estimates" ? (
          <EstimateBuilder
            employeeName={employee.name}
            employeeEmail={employee.email}
            lockedDocumentType="Estimate"
          />
        ) : null}
        {workspace === "invoices" ? (
          <EstimateBuilder
            employeeName={employee.name}
            employeeEmail={employee.email}
            lockedDocumentType="Invoice"
          />
        ) : null}
        {workspace === "testimonials" ? <TestimonialModeration /> : null}
      </>
    );
  }

  return (
    <section className="employee-auth">
      <div className="auth-copy">
        <p className="eyebrow">Secure employee access</p>
        <h2>{mode === "login" ? "Sign in to continue." : "Create an employee account."}</h2>
        <p>
          Employee accounts unlock the in-house estimate and invoice builder.
          New accounts can be created here, then used to access the workspace
          from any device.
        </p>
      </div>

      <form className="auth-form" onSubmit={submitAuth}>
        <div className="auth-tabs" role="tablist" aria-label="Employee auth mode">
          <button
            aria-selected={mode === "login"}
            role="tab"
            type="button"
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            aria-selected={mode === "register"}
            role="tab"
            type="button"
            onClick={() => setMode("register")}
          >
            Create account
          </button>
        </div>

        {mode === "register" ? (
          <label>
            Employee name
            <input
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        ) : null}

        <label>
          Email
          <input
            autoComplete="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? <p className="auth-error">{error}</p> : null}

        <button className="auth-submit" disabled={loading} type="submit">
          {loading
            ? "Please wait..."
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>
    </section>
  );
}
