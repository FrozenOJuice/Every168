"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
        disabled={begin.isPending}
        onClick={() => begin.mutate(new Date().toISOString())}
      >
        {plan.sessionId ? "Continue workout" : "Start workout"}
      </button>
      <CommandError command={begin} />
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
  const [scheduling, setScheduling] = useState(false);
  const setCount = plan.exercises.reduce(
    (count, exercise) => count + exercise.sets.length,
    0,
  );
  const timezone = useMe().preferences.timezone;
  const block = useQuery({
    queryKey: ["fitness", "block", plan.timeBlockId],
    queryFn: () => api.getTimeBlock(plan.timeBlockId!),
    enabled: !!plan.timeBlockId && !scheduledBlock,
  });
  const blockData = scheduledBlock ?? block.data;
  return (
    <section className="fitness-workout-card panel">
      <div className="fitness-workout-card-heading">
        <h3>{blockData?.title ?? plan.title}</h3>
        {plan.isDraft && <span className="fitness-state">Draft</span>}
      </div>
      <p className="text-small">
        {plan.exercises.length}{" "}
        {plan.exercises.length === 1 ? "exercise" : "exercises"} · {setCount}{" "}
        {setCount === 1 ? "set" : "sets"}
      </p>
      <p className="fitness-workout-preview">
        {plan.exercises
          .map((exercise) => exercise.name)
          .slice(0, 3)
          .join(", ")}
        {plan.exercises.length > 3
          ? `, +${plan.exercises.length - 3} more`
          : ""}
      </p>
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
        {plan.isDraft ? (
          <Link className="button" href={`/fitness/workout/${plan.id}`}>
            Continue editing
          </Link>
        ) : (
          <BeginWorkout plan={plan} />
        )}
        {plan.kind === "workout" && !plan.isDraft && (
          <div className="fitness-workout-secondary-actions">
            <Link
              className="fitness-text-action"
              href={`/fitness/workout/${plan.id}`}
            >
              Edit
            </Link>
            <button
              className="fitness-text-action"
              onClick={() => setScheduling(true)}
            >
              Schedule
            </button>
          </div>
        )}
      </div>
      {scheduling && (
        <Dialog title="Schedule workout" onClose={() => setScheduling(false)}>
          <ScheduleWorkout plan={plan} onSaved={() => setScheduling(false)} />
        </Dialog>
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
  const timezone = useMe().preferences.timezone;
  const cache = useQueryClient();
  const [start, setStart] = useState(() =>
    instantToLocalInput(new Date().toISOString(), timezone),
  );
  const [end, setEnd] = useState(() =>
    instantToLocalInput(new Date(Date.now() + 3600000).toISOString(), timezone),
  );
  const [error, setError] = useState("");
  const command = useCommand({
    mutationFn: (v: { startsAt: string; endsAt: string }, key: string) =>
      api.scheduleStrengthPlan(plan.id, v, plan.version, key),
    onSuccess: () => {
      invalidateFitness(cache);
      onSaved();
    },
  });
  return (
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
          command.mutate(v);
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
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="field">
          End
          <input
            type="datetime-local"
            required
            value={end}
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
  );
}
