"use client";

import { useEffect, useState } from "react";
import { business } from "./business";

const links = [
  { href: "#services", label: "Services" },
  { href: "#work", label: "Our crew" },
  { href: "#process", label: "How it works" },
  { href: "#area", label: "Service area" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <header className="va-header" data-open={open || undefined}>
      <div className="va-header-inner">
        <a className="va-logo" href="#top" aria-label={`${business.shortName} home`}>
          <img src="/images/va-logo.png" alt="" width={187} height={160} />
          <span>VA Contracting</span>
        </a>

        <nav className="va-nav" id="va-nav" aria-label="Main">
          {links.map((link) => (
            <a href={link.href} key={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <a className="va-nav-quote" href="#quote" onClick={() => setOpen(false)}>
            Get a quote
          </a>
        </nav>

        <a className="va-header-phone" href={business.phoneHref}>
          <PhoneIcon />
          <span>{business.phoneDisplay}</span>
        </a>

        <button
          aria-controls="va-nav"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="va-menu-button"
          type="button"
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}

export function PhoneIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <path
        d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"
        fill="currentColor"
      />
    </svg>
  );
}
