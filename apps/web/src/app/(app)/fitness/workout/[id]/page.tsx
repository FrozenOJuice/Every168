import { WorkoutBuilderPage } from "@/features/fitness/workout-builder";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    exercise?: string;
    returnTo?: string;
    added?: string;
  }>;
}) {
  const [{ id }, { exercise, returnTo, added }] = await Promise.all([
    params,
    searchParams,
  ]);
  const source =
    returnTo &&
    /^\/fitness\/exercises\/(?:[0-9a-f-]{36}|catalog\/[a-zA-Z0-9_-]+)$/.test(
      returnTo,
    )
      ? returnTo
      : undefined;
  return (
    <WorkoutBuilderPage
      id={id}
      exerciseId={exercise}
      returnTo={source}
      addedOccurrence={added}
    />
  );
}
