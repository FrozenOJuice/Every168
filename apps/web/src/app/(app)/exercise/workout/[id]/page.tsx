import { WorkoutPage } from "@/features/exercise/workout-page";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <WorkoutPage id={(await params).id} />;
}
