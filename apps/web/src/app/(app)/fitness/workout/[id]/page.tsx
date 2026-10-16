import { WorkoutBuilderPage } from "@/features/fitness/workout-builder";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ exercise?: string }>;
}) {
  const [{ id }, { exercise }] = await Promise.all([params, searchParams]);
  return <WorkoutBuilderPage id={id} exerciseId={exercise} />;
}
