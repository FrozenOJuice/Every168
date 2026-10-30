import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { features } from "@/lib/release";

export default function ProgramsLayout({ children }: { children: ReactNode }) {
  if (!features.trainingPrograms) notFound();
  return children;
}
