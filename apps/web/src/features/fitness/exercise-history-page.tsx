"use client";
import { useFitnessNavigation } from "./fitness-navigation";
import type { ExerciseLoggingType } from "@168hours/contracts";
import { ExerciseHelp } from "./exercise-help";
export function ExerciseHistoryPage({
  id,
  mode,
}: {
  id: string;
  mode?: ExerciseLoggingType;
}) {
  const navigation = useFitnessNavigation();
  const backLabel =
    navigation.parent?.view === "summary"
      ? "Back to summary"
      : navigation.parent?.href === "/fitness/exercises"
        ? "Back to Exercises"
        : "Back to workout";
  return (
    <ExerciseHelp
      id={id}
      backLabel={backLabel}
      history
      mode={mode}
      onClose={() => void navigation.back()}
    />
  );
}
