import { exerciseLoggingTypeSchema } from "@168hours/contracts";
import { ExerciseDetailPage } from "@/features/fitness/exercise-detail-page";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { key } = await params;
  const mode = exerciseLoggingTypeSchema.safeParse((await searchParams).mode);
  return (
    <ExerciseDetailPage
      key={key}
      catalogKey={key}
      mode={mode.success ? mode.data : undefined}
    />
  );
}
