import Link from "next/link";
import type { ReactNode } from "react";

// Retained activity remains visible while its old workspace UI is retired.
export function CalendarSourceLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  if (/^\/(food|exercise)(?:[/?#]|$)/.test(href)) {
    return <span className={className}>{children}</span>;
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
