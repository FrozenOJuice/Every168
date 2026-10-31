import { notFound } from "next/navigation";
import { features } from "@/lib/release";
import { RoutinesPage } from "@/features/routines/routines-page";
export default function Page() {
  if (!features.routines) notFound();
  return <RoutinesPage />;
}
