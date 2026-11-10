import { EmployeePortal } from "./EmployeePortal.tsx";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Employee Portal | VA Contracting",
  description:
    "Employee estimate, invoice, and job tracking tools for VA Contracting.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/employee" },
};

export default function EmployeePage() {
  return (
    <main className="employee-shell">
      <header className="employee-header">
        <Link className="employee-brand" href="/">
          <img src="/images/va-logo.png" alt="" width={61} height={52} />
          <span>VA Contracting</span>
        </Link>
        <nav className="employee-nav" aria-label="Employee navigation">
          <Link href="/">Public site</Link>
        </nav>
      </header>

      <section className="employee-hero">
        <div>
          <p className="eyebrow">Employee portal</p>
          <h1>Estimate and invoice tools for VA Contracting jobs.</h1>
          <p>
            Sign in or create an employee account to build line-item estimates,
            turn accepted quotes into invoices, calculate tax and markup, email
            clients, and print VA-branded documents that can be saved as PDFs.
          </p>
        </div>
      </section>

      <EmployeePortal />
    </main>
  );
}
