"use client";

import type { CalendarScheduleContext } from "@/features/workspace/calendar-scheduling";
import { useId, useState } from "react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { instantToLocalInput } from "@168hours/domain-utils";
import {
  strengthScheduleInput,
  type StrengthPlan,
  type StrengthScheduleInput,
} from "@168hours/contracts";
import { Dialog } from "@/components/ui/dialog";
import { useMe } from "@/features/identity/me";
import { useDomainDay } from "@/features/workspace/domain-day-context";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { FitnessConfirm } from "./fitness-confirm";
import { SessionStartField } from "./session-start-field";
import { invalidateFitness } from "./fitness-cache";
import {
  initialWorkoutSchedule,
  formatWorkoutScheduleDuration,
  moveWorkoutScheduleStart,
  validateWorkoutSchedule,
  type ScheduleErrors,
} from "./workout-schedule";

export function ScheduleWorkout({
  plan,
  onClose,
  onScheduled,
  initialContext,
  onChooseAnother,
}: {
  plan: StrengthPlan;
  initialContext?: CalendarScheduleContext;
  onChooseAnother?: () => void;
  onClose: () => void;
  onScheduled: (schedule: StrengthScheduleInput) => void;
}) {
  const {
    user,
    preferences: { timezone: accountTimezone },
  } = useMe();
  const { date } = useDomainDay();
  const [timezone] = useState(
    () => initialContext?.timezone ?? accountTimezone,
  );
  const cache = useQueryClient();
  const id = useId();
  const [defaults] = useState(() =>
    initialWorkoutSchedule(
      initialContext?.date ?? date,
      new Date(),
      timezone,
      initialContext,
    ),
  );
  const [fields, setFields] = useState(defaults);
  const [errors, setErrors] = useState<ScheduleErrors>({});
  const [cancelling, setCancelling] = useState<(() => void) | null>(null);
  const command = useCommand({
    persistence: {
      key: `168hours:schedule:${user.id}:${plan.id}`,
      parse: (value) =>
        strengthScheduleInput
          .safeExtend({ version: z.number().int().positive() })
          .parse(value),
    },
    mutationFn: async (
      value: StrengthScheduleInput & { version: number },
      key: string,
    ) => {
      await api.scheduleStrengthPlan(
        plan.id,
        { startsAt: value.startsAt, endsAt: value.endsAt },
        value.version,
        key,
      );
      return { startsAt: value.startsAt, endsAt: value.endsAt };
    },
    onSuccess: (schedule) => {
      invalidateFitness(cache);
      onScheduled(schedule);
    },
  });
  const shown =
    command.needsRetry && command.recoveredVariables
      ? {
          start: instantToLocalInput(
            command.recoveredVariables.startsAt,
            timezone,
          ),
          end: instantToLocalInput(command.recoveredVariables.endsAt, timezone),
        }
      : fields;
  const duration = formatWorkoutScheduleDuration(shown, timezone);
  useUnsavedChanges(command.isPending, "Wait for scheduling to finish.", true);
  function requestClose(target: () => void) {
    if (command.isPending) return;
    if (fields.start !== defaults.start || fields.end !== defaults.end)
      setCancelling(() => target);
    else target();
  }
  const cancel = () => requestClose(onClose);
  return (
    <Dialog title="Schedule workout" onClose={cancel}>
      {cancelling && (
        <FitnessConfirm
          title="Discard schedule changes?"
          action="Discard changes"
          danger
          onCancel={() => setCancelling(null)}
          onConfirm={cancelling}
        />
      )}
      <form
        className="form-stack fitness-schedule-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (command.isPending) return;
          const result = validateWorkoutSchedule(fields, timezone);
          setErrors(result.errors);
          if (!result.input) {
            requestAnimationFrame(() =>
              document
                .getElementById(
                  `${id}-${result.errors.start ? "start" : "end"}`,
                )
                ?.focus(),
            );
            return;
          }
          command.mutate({ ...result.input, version: plan.version });
        }}
      >
        <div className="fitness-schedule-context">
          <strong>{plan.title}</strong>
          {onChooseAnother && (
            <button
              type="button"
              className="button"
              disabled={command.isPending}
              onClick={() => requestClose(onChooseAnother)}
            >
              Change workout
            </button>
          )}
        </div>
        {plan.notes && (
          <div className="calendar-schedule-notes">
            <strong>Workout notes</strong>
            <p>{plan.notes}</p>
          </div>
        )}
        {(["start", "end"] as const).map((kind) => (
          <fieldset
            className="fitness-schedule-field"
            key={kind}
            disabled={command.isPending}
          >
            <legend>{kind === "start" ? "Start" : "End"}</legend>
            <SessionStartField
              id={`${id}-${kind}`}
              kind={kind}
              timeLabel={`Choose ${kind} time`}
              value={shown[kind]}
              onChange={(value) => {
                setFields((current) =>
                  kind === "start"
                    ? moveWorkoutScheduleStart(current, value, timezone)
                    : { ...current, end: value },
                );
                setErrors((current) =>
                  kind === "start" ? {} : { ...current, end: undefined },
                );
              }}
              invalid={!!errors[kind]}
              describedBy={errors[kind] ? `${id}-${kind}-error` : undefined}
              disabled={command.isPending}
            />
            {errors[kind] && (
              <p id={`${id}-${kind}-error`} className="error" role="alert">
                {errors[kind]}
              </p>
            )}
          </fieldset>
        ))}
        {duration && (
          <p className="fitness-schedule-duration">
            Duration: <strong>{duration}</strong>
          </p>
        )}
        <CommandError command={command} />
        <div className="fitness-schedule-actions">
          <button
            type="button"
            className="button"
            disabled={command.isPending}
            onClick={cancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={command.isPending}
            aria-busy={command.isPending}
          >
            {command.retrying ? "Scheduling…" : "Schedule workout"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
