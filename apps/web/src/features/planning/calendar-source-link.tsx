"use client";
import Link from "next/link";
import type { ComponentProps } from "react";
import { usePathname } from "next/navigation";
import { useCalendarVisit } from "./calendar-visit";
import { calendarWorkoutHref } from "./calendar-return";

// Retained activity remains visible while its old workspace UI is retired.
export function CalendarSourceLink({
  href,
  className,
  children,
  ...props
}: {
  href: string;
} & Omit<ComponentProps<typeof Link>, "href">) {
  const path = usePathname();
  const calendar = useCalendarVisit();
  if (/^\/exercise(?:[/?#]|$)/.test(href)) {
    return <span className={className}>{children}</span>;
  }
  return (
    <Link
      {...props}
      href={calendarWorkoutHref(href, path === "/" ? calendar.href : undefined)}
      className={className}
    >
      {children}
    </Link>
  );
}
