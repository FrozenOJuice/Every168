"use client";
import { useRouter } from "next/navigation";
import type { ExerciseLoggingType } from "@168hours/contracts";
import { ExerciseHelp } from "./exercise-help";
export function ExerciseHistoryPage({
  id,
  mode,
}: {
  id: string;
  mode?: ExerciseLoggingType;
}) {
  const router = useRouter();
  return (
    <ExerciseHelp
      id={id}
      backLabel="Back to exercises"
      history
      mode={mode}
      onClose={() => router.push("/fitness#exercises")}
    />
  );
}
