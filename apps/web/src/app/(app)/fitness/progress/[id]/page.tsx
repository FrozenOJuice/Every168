import { ExerciseProgressPage } from "@/features/fitness/exercise-progress";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ExerciseProgressPage key={id} id={id} />;
}
