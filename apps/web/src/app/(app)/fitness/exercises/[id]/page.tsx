import { exerciseLoggingTypeSchema } from "@168hours/contracts";
import { ExerciseHistoryPage } from "@/features/fitness/exercise-history-page";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { id } = await params;
  const mode = exerciseLoggingTypeSchema.safeParse((await searchParams).mode);
  return (
    <ExerciseHistoryPage
      key={id}
      id={id}
      mode={mode.success ? mode.data : undefined}
    />
  );
}
