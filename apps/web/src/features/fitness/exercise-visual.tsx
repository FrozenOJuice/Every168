import { Dumbbell } from "lucide-react";
export function ExerciseVisual({
  large = false,
  compact = false,
}: {
  large?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`fitness-exercise-visual${large ? " is-large" : ""}${compact ? " is-compact" : ""}`}
      aria-hidden="true"
    >
      <Dumbbell size={compact ? 20 : large ? 64 : 36} strokeWidth={1.2} />
      {large && <span>Exercise visual coming soon</span>}
    </div>
  );
}
