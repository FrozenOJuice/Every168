import { CalendarSourceLink as Link } from "./calendar-source-link";
import { ArrowRight, Dumbbell } from "lucide-react";
import type { TimeEntry } from "@168hours/contracts";
import {
  localDate,
  workoutSeconds,
  durationSeconds,
} from "@168hours/domain-utils";
import { formatDate, formatTime } from "@/lib/format";
import { formatRestDuration } from "@/features/fitness/rest-duration";

export function CalendarRecordedWorkout({
  entry,
  timezone,
}: {
  entry: TimeEntry;
  timezone: string;
}) {
  const seconds = workoutSeconds({
    startedAt: entry.startsAt,
    endedAt: entry.endsAt,
    pauses: entry.excludedIntervals,
  });
  const paused = durationSeconds(entry.startsAt, entry.endsAt) - seconds;
  const dateTime = (instant: string) =>
    `${formatDate(localDate(instant, timezone), { month: "short", day: "numeric", year: "numeric" })} · ${formatTime(instant, timezone)}`;

  return (
    <div className="calendar-workout-summary">
      <div className="calendar-workout-identity">
        <span className="calendar-workout-icon" aria-hidden="true">
          <Dumbbell size={21} />
        </span>
        <div>
          <p className="calendar-workout-source">Fitness</p>
          <h3>{entry.title}</h3>
        </div>
      </div>
      <dl className="calendar-workout-timing">
        <div>
          <dt>Started</dt>
          <dd>
            <time dateTime={entry.startsAt}>{dateTime(entry.startsAt)}</time>
          </dd>
        </div>
        <div>
          <dt>Finished</dt>
          <dd>
            <time dateTime={entry.endsAt}>{dateTime(entry.endsAt)}</time>
          </dd>
        </div>
      </dl>
      <dl className="calendar-workout-duration">
        <div>
          <dt>Workout time</dt>
          <dd>{formatRestDuration(seconds)}</dd>
        </div>
        {paused > 0 && (
          <div className="calendar-workout-paused">
            <dt>Time paused</dt>
            <dd>{formatRestDuration(paused)}</dd>
          </div>
        )}
      </dl>
      {entry.sourceId && (
        <Link
          className="button primary calendar-workout-open"
          href={`/fitness/session/${entry.sourceId}`}
        >
          View workout <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
