import { ExerciseDetailPage } from "@/features/fitness/exercise-detail-page";
export default async function Page({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  return <ExerciseDetailPage key={key} catalogKey={key} />;
}
