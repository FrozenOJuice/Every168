import { notFound } from "next/navigation";
import { features } from "@/lib/release";
import { GoalsPage } from "@/features/goals/goals-page";
export default function Page() {
  if (!features.goals) notFound();
  return <GoalsPage />;
}
