import { ExercisePage } from "@/features/exercise/exercise-page";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  return <ExercisePage section={(await searchParams).tab} />;
}
