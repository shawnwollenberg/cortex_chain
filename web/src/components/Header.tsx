"use client";

import Link from "next/link";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/overview", label: "Overview" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/docs", label: "Docs" },
  { href: "https://github.com/shawnwollenberg/cortex_chain", label: "GitHub" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span
            className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface shadow-sm"
            aria-hidden="true"
          >
            <svg viewBox="0 0 32 32" className="h-6 w-6" role="img">
              <defs>
                <linearGradient id="cortex-logo-gradient" x1="5" y1="6" x2="27" y2="27">
                  <stop stopColor="#8B5CF6" />
                  <stop offset="1" stopColor="#06B6D4" />
                </linearGradient>
              </defs>
              <path
                d="M10 12.5C10 8.9 12.7 6 16 6s6 2.9 6 6.5v7C22 23.1 19.3 26 16 26s-6-2.9-6-6.5v-7Z"
                fill="url(#cortex-logo-gradient)"
              />
              <path
                d="M8 15h4m8 0h4M12.5 10.5h7M12.5 21.5h7M16 10.5v11"
                fill="none"
                stroke="#0B1020"
                strokeLinecap="round"
                strokeWidth="1.6"
              />
              <circle cx="13.25" cy="15.5" r="1.2" fill="#0B1020" />
              <circle cx="18.75" cy="15.5" r="1.2" fill="#0B1020" />
            </svg>
          </span>
          <span className="bg-gradient-to-r from-accent-purple to-accent-blue bg-clip-text text-transparent text-lg">
            Cortex
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted hover:text-text transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden flex flex-col gap-1 p-2"
          aria-label="Toggle menu"
        >
          <span
            className={`block h-0.5 w-5 bg-muted transition-transform ${open ? "translate-y-1.5 rotate-45" : ""}`}
          />
          <span
            className={`block h-0.5 w-5 bg-muted transition-opacity ${open ? "opacity-0" : ""}`}
          />
          <span
            className={`block h-0.5 w-5 bg-muted transition-transform ${open ? "-translate-y-1.5 -rotate-45" : ""}`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="md:hidden border-t border-border bg-bg/95 backdrop-blur-md px-4 pb-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm text-muted hover:text-text"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
