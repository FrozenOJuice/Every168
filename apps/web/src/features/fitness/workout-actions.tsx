"use client";
import { FitnessConfirm } from "./fitness-confirm";
import { useWorkoutStart } from "./active-workouts";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarPlus, Pencil, Play } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  instantToLocalInput,
  localInputToInstant,
} from "@168hours/domain-utils";
import {
  strengthScheduleInput,
  type StrengthPlan,
  type Block,
} from "@168hours/contracts";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { useCommand, CommandError } from "@/lib/use-command";
import { ErrorState } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/dialog";
import { invalidateFitness } from "./fitness-cache";
export function BeginWorkout({ plan }: { plan: StrengthPlan }) {
  const router = useRouter();
  const cache = useQueryClient();
  const start = useWorkoutStart();
  const begin = useCommand({
    mutationFn: (startedAt: string, key: string) =>
      api.beginStrengthPlan(plan.id, startedAt, plan.version, key),
    onSuccess: (w) => {
      invalidateFitness(cache);
      router.push(`/fitness/session/${w.id}`);
    },
  });
  return (
    <>
      <button
        className="button primary"
        disabled={begin.isPending || start.checking}
        onClick={() =>
          void start.request(
            () => begin.mutate(new Date().toISOString()),
            !!plan.sessionId,
          )
        }
      >
        <Play size={16} aria-hidden="true" />
        {plan.sessionId ? "Continue workout" : "Start workout"}
      </button>
      <CommandError command={begin} />
      {start.dialog}
    </>
  );
}
export function PlanCard({
  plan,
  scheduledBlock,
}: {
  plan: StrengthPlan;
  scheduledBlock?: Block;
}) {
  const { user, preferences } = useMe();
  const [scheduling, setScheduling] = useState(() => {
    try {
      return !!sessionStorage.getItem(
        `168hours:schedule:${user.id}:${plan.id}`,
      );
    } catch {
      return false;
    }
  });
  const timezone = preferences.timezone;
  const block = useQuery({
    queryKey: ["fitness", "block", plan.timeBlockId],
    queryFn: () => api.getTimeBlock(plan.timeBlockId!),
    enabled: !!plan.timeBlockId && !scheduledBlock,
  });
  const blockData = scheduledBlock ?? block.data;
  return (
    <section className="fitness-workout-card panel" data-draft={plan.isDraft}>
      {plan.isDraft && (
        <svg
          className="fitness-workout-draft-border"
          aria-hidden="true"
          focusable="false"
        >
          <rect
            x="0.5"
            y="0.5"
            rx="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="5 4"
          />
        </svg>
      )}
      <div className="fitness-workout-card-heading">
        <div className="fitness-workout-card-heading-copy">
          <div className="fitness-workout-card-title">
            <h3>{blockData?.title ?? plan.title}</h3>
          </div>
          <p className="fitness-workout-exercise-count">
            {plan.exercises.length}{" "}
            {plan.exercises.length === 1 ? "exercise" : "exercises"}
          </p>
        </div>
        {plan.isDraft && <p className="fitness-workout-draft-status">Draft</p>}
      </div>
      {plan.exercises.length ? (
        <div className="fitness-workout-card-preview">
          <ul
            className="fitness-workout-preview"
            aria-label="Workout exercises"
          >
            {plan.exercises.slice(0, 4).map((exercise, index) => (
              <li key={`${exercise.exerciseId}:${index}`}>
                <span>{exercise.name}</span>
              </li>
            ))}
          </ul>
          {plan.exercises.length > 4 && (
            <p className="muted">+{plan.exercises.length - 4} more</p>
          )}
        </div>
      ) : null}
      {blockData && (
        <p>
          <Link
            href={`/?date=${instantToLocalInput(blockData.startsAt, timezone).slice(0, 10)}&view=day`}
          >
            {new Intl.DateTimeFormat("en", {
              timeZone: timezone,
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(blockData.startsAt))}
          </Link>
        </p>
      )}
      {block.error && (
        <ErrorState error={block.error} retry={() => void block.refetch()} />
      )}
      {plan.kind === "scheduled" && !plan.timeBlockId && (
        <p className="muted">
          Calendar time was removed. You can still start this workout.
        </p>
      )}
      <div className="fitness-workout-card-actions">
        {plan.kind === "workout" && !plan.isDraft && (
          <>
            <Link className="button" href={`/fitness/workout/${plan.id}`}>
              <Pencil size={16} aria-hidden="true" />
              Edit
            </Link>
            <button className="button" onClick={() => setScheduling(true)}>
              <CalendarPlus size={16} aria-hidden="true" />
              Schedule
            </button>
          </>
        )}
        {plan.isDraft ? (
          <Link className="button primary" href={`/fitness/workout/${plan.id}`}>
            <Pencil size={16} aria-hidden="true" />
            Continue editing
          </Link>
        ) : (
          <BeginWorkout plan={plan} />
        )}
      </div>
      {scheduling && (
        <ScheduleWorkout plan={plan} onSaved={() => setScheduling(false)} />
      )}
    </section>
  );
}
function ScheduleWorkout({
  plan,
  onSaved,
}: {
  plan: StrengthPlan;
  onSaved: () => void;
}) {
  const { user, preferences } = useMe();
  const timezone = preferences.timezone;
  const cache = useQueryClient();
  const [start, setStart] = useState(() =>
    instantToLocalInput(new Date().toISOString(), timezone),
  );
  const [end, setEnd] = useState(() =>
    instantToLocalInput(new Date(Date.now() + 3600000).toISOString(), timezone),
  );
  const [error, setError] = useState("");
  const [defaults] = useState({ start, end });
  const [cancelling, setCancelling] = useState(false);
  const command = useCommand({
    persistence: {
      key: `168hours:schedule:${user.id}:${plan.id}`,
      parse: (value) =>
        strengthScheduleInput
          .safeExtend({ version: z.number().int().positive() })
          .parse(value),
    },
    mutationFn: (
      v: { startsAt: string; endsAt: string; version: number },
      key: string,
    ) =>
      api.scheduleStrengthPlan(
        plan.id,
        { startsAt: v.startsAt, endsAt: v.endsAt },
        v.version,
        key,
      ),
    onSuccess: () => {
      invalidateFitness(cache);
      onSaved();
    },
  });
  useUnsavedChanges(command.isPending, "Wait for scheduling to finish.", true);
  return (
    <Dialog
      title="Schedule workout"
      onClose={() => {
        if (command.isPending) return;
        if (start !== defaults.start || end !== defaults.end)
          setCancelling(true);
        else onSaved();
      }}
    >
      {cancelling && (
        <FitnessConfirm
          title="Discard schedule changes?"
          action="Discard changes"
          danger
          onCancel={() => setCancelling(false)}
          onConfirm={onSaved}
        />
      )}
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const v = strengthScheduleInput.parse({
              startsAt: localInputToInstant(start, timezone),
              endsAt: localInputToInstant(end, timezone),
            });
            setError("");
            command.mutate({ ...v, version: plan.version });
          } catch {
            setError(
              "Choose valid, unambiguous start and end times in your timezone.",
            );
          }
        }}
      >
        <p>
          This reserves Calendar time. It does not start or complete a workout.
        </p>
        <fieldset className="form-stack" disabled={command.isPending}>
          <label className="field">
            Start
            <input
              type="datetime-local"
              required
              value={
                command.needsRetry && command.recoveredVariables
                  ? instantToLocalInput(
                      command.recoveredVariables.startsAt,
                      timezone,
                    )
                  : start
              }
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="field">
            End
            <input
              type="datetime-local"
              required
              value={
                command.needsRetry && command.recoveredVariables
                  ? instantToLocalInput(
                      command.recoveredVariables.endsAt,
                      timezone,
                    )
                  : end
              }
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <button className="button primary">Schedule workout</button>
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <CommandError command={command} />
      </form>
    </Dialog>
  );
}
