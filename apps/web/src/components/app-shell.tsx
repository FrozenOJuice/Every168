"use client";
import { features } from "@/lib/release";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Dumbbell, Utensils, CheckSquare } from "lucide-react";
import type { Me } from "@168hours/contracts";
import { MeProvider } from "@/features/identity/me";
import { AccountMenu } from "./account-menu";
import { DomainDayProvider } from "@/features/workspace/domain-day-context";
import {
  AssistantLauncher,
  AssistantNavigationLink,
} from "@/features/assistant/assistant-preview";
import { AssistantProvider } from "@/features/assistant/assistant-state";

const links = [
  ["/", "Calendar", CalendarDays],
  ["/fitness", "Fitness", Dumbbell],
  ["/food", "Food", Utensils],
  ["/tasks", "Tasks", CheckSquare],
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
        <ReleaseAssistant key={me.user.id}>
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
              {links
                .filter(
                  ([href]) =>
                    (href !== "/food" || features.food) &&
                    (href !== "/tasks" || features.tasks),
                )
                .map(([href, label, Icon]) => (
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
              {features.assistant && <AssistantNavigationLink />}
            </nav>
            <AccountMenu user={me.user} />
          </aside>
          <main id="main" className="main-content" tabIndex={-1}>
            {children}
          </main>
          {features.assistant && <AssistantLauncher />}
        </ReleaseAssistant>
      </DomainDayProvider>
    </MeProvider>
  );
}

function ReleaseAssistant({ children }: { children: React.ReactNode }) {
  return features.assistant ? (
    <AssistantProvider>{children}</AssistantProvider>
  ) : (
    children
  );
}
