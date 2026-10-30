"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  exerciseReturnPath,
  type ExerciseWorkoutOrigin,
} from "./exercise-workout-return";
import { saveExerciseWorkoutPosition } from "./exercise-workout-position";
import { ArrowRight } from "lucide-react";
import { useMe } from "@/features/identity/me";
import { sessionDate } from "./progress-shared";
import { useFitnessNavigation } from "./fitness-navigation";

export function WorkoutReference({
  id,
  title,
  startedAt,
  summary,
  origin,
  showTime = false,
  label,
}: {
  id: string;
  title: string;
  startedAt: string;
  summary?: string;
  origin?: ExerciseWorkoutOrigin;
  showTime?: boolean;
  label?: string;
}) {
  const {
    user,
    preferences: { timezone },
  } = useMe();
  const pathname = usePathname();
  const navigation = useFitnessNavigation();
  const date = sessionDate(startedAt, timezone);
  const when = showTime
    ? `${date} · ${new Intl.DateTimeFormat("en", { timeZone: timezone, timeStyle: "short" }).format(new Date(startedAt))}`
    : date;
  const returnTo = origin ? exerciseReturnPath(pathname, origin) : undefined;
  const params =
    origin && returnTo
      ? new URLSearchParams({ returnExercise: origin.exerciseId, returnTo })
      : undefined;
  const href = navigation.destination(
    `/fitness/session/${id}${params ? `?${params}` : ""}`,
  );
  return (
    <div className="fitness-workout-reference" data-workout-reference={id}>
      {label && (
        <span className="fitness-workout-reference-label">{label}</span>
      )}
      <Link
        className="fitness-workout-reference-link"
        href={href}
        onNavigate={(event) => {
          event.preventDefault();
          navigation.openWorkout(href, origin);
        }}
        onClick={(event) => {
          if (
            origin &&
            event.button === 0 &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.shiftKey &&
            !event.altKey
          )
            saveExerciseWorkoutPosition(
              user.id,
              origin.exerciseId,
              id,
              event.currentTarget,
              returnTo!.split("?")[0]!,
            );
        }}
        aria-label={`Open workout: ${title}, ${when}${label ? `, ${label}` : ""}${summary ? `, ${summary}` : ""}`}
      >
        <span className="fitness-workout-reference-copy">
          <span>{title}</span>
          {summary && (
            <span className="fitness-workout-reference-summary">{summary}</span>
          )}
          <time className="muted" dateTime={startedAt}>
            {when}
          </time>
        </span>
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}
