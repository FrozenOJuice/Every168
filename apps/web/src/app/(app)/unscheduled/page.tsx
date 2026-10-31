import { notFound } from "next/navigation";
import { features } from "@/lib/release";
import { UnscheduledPlansPage } from "@/features/planning/unscheduled-plans-page";

export default function Page() {
  if (!features.unscheduled) notFound();
  return <UnscheduledPlansPage />;
}
