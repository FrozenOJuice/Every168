import { WorkoutBuilderPage } from "@/features/fitness/workout-builder";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <WorkoutBuilderPage id={(await params).id} />;
}
