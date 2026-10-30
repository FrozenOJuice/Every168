import { SessionPage } from "@/features/fitness/session-editor";
import { parseExerciseWorkoutReturn } from "@/features/fitness/exercise-workout-return";
import { parseHistoryReturn } from "@/features/fitness/workout-history-return";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    returnExercise?: string;
    returnTo?: string;
    returnHistory?: string;
  }>;
}) {
  const [{ id }, source] = await Promise.all([params, searchParams]);
  return (
    <SessionPage
      id={id}
      historyReturn={parseHistoryReturn(source.returnHistory)}
      exerciseReturn={parseExerciseWorkoutReturn(
        source.returnExercise,
        source.returnTo,
      )}
    />
  );
}
