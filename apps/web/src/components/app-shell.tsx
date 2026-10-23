"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Dumbbell, Utensils } from "lucide-react";
import type { Me } from "@168hours/contracts";
import { MeProvider } from "@/features/identity/me";
import { AccountMenu } from "./account-menu";
import { DomainDayProvider } from "@/features/workspace/domain-day-context";

const links = [
  ["/", "Calendar", CalendarDays],
  ["/fitness", "Fitness", Dumbbell],
  ["/food", "Food", Utensils],
] as const;

export function AppShell({
  me,
  children,
}: {
  me: Me;
  children: React.ReactNode;
}) {
  const path = usePathname();
  return (
    <MeProvider me={me}>
      <DomainDayProvider>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <aside className="sidebar">
          <Link href="/" className="brand" aria-label="168Hours home">
            168<span>Hours</span>
            <span className="brand-dot" aria-hidden="true" />
          </Link>
          <p className="nav-caption">Your week, your way</p>
          <nav aria-label="Main navigation">
            {links.map(([href, label, Icon]) => (
              <Link
                key={href}
                href={href}
                aria-current={
                  (
                    href === "/"
                      ? path === "/"
                      : path === href || path.startsWith(href + "/")
                  )
                    ? "page"
                    : undefined
                }
              >
                <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          <AccountMenu user={me.user} />
        </aside>
        <main id="main" className="main-content" tabIndex={-1}>
          {children}
        </main>
      </DomainDayProvider>
    </MeProvider>
  );
}
