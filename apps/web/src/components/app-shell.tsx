"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Utensils,
  Dumbbell,
  Flag,
  Settings,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Me } from "@168hours/contracts";
import { api } from "@/lib/api";
import { MeProvider } from "@/features/identity/me";
const links = [
  ["/", "Dashboard", LayoutDashboard],
  ["/week", "Week", CalendarDays],
  ["/food", "Food", Utensils],
  ["/exercise", "Exercise", Dumbbell],
  ["/goals", "Goals", Flag],
  ["/settings", "Settings", Settings],
] as const;
export function AppShell({
  me,
  children,
}: {
  me: Me;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <MeProvider me={me}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand">
          168<span>Hours</span>
        </Link>
        <p className="sidebar-note">
          A little intention.
          <br />A week of possibilities.
        </p>
        <nav aria-label="Main navigation">
          {links.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
            >
              <Icon size={19} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="account">
          <span className="avatar" aria-hidden="true">
            {me.user.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{me.user.name}</strong>
            <small>Your personal logbook</small>
          </div>
          <button
            aria-label="Sign out"
            className="icon-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.signOut();
                cache.clear();
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Clear the document and router cache across account changes.
                window.location.assign("/login");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Sign out failed");
                setBusy(false);
              }
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </aside>
      <main id="main" className="main-content">
        {children}
      </main>
    </MeProvider>
  );
}
