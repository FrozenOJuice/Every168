"use client";

import { useId } from "react";
import {
  instantToLocalInput,
  localInputToInstant,
  workoutSeconds,
} from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { SessionStartField } from "./session-start-field";
import { formatRestDuration } from "./rest-duration";
import type { SessionDraft } from "./strength-draft";
import type { InvalidSessionTimes } from "./session-recovery";

export function WorkoutPauseCorrections({
  value,
  invalidTimes,
  errors,
  disabled,
  onChange,
}: {
  value: SessionDraft;
  invalidTimes: InvalidSessionTimes;
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (value: SessionDraft, invalidTimes: InvalidSessionTimes) => void;
}) {
  const id = useId();
  const {
    preferences: { timezone },
  } = useMe();
  const pauses = value.pauses ?? [];
  const valid =
    !Object.keys(invalidTimes).length &&
    !errors.startedAt &&
    !errors.endedAt &&
    !errors.pauses;
  const elapsed = value.endedAt
    ? (Date.parse(value.endedAt) - Date.parse(value.startedAt)) / 1000
    : 0;
  const active = valid ? workoutSeconds(value) : 0;
  function update(index: number, field: "startsAt" | "endsAt", local: string) {
    const key = `pauses.${index}.${field}` as const;
    const nextInvalid = { ...invalidTimes };
    try {
      const old = pauses[index]![field];
      const instant =
        old && instantToLocalInput(old, timezone) === local
          ? old
          : localInputToInstant(local, timezone);
      delete nextInvalid[key];
      onChange(
        {
          ...value,
          pauses: pauses.map((pause, i) =>
            i === index ? { ...pause, [field]: instant } : pause,
          ),
        },
        nextInvalid,
      );
    } catch {
      onChange(value, { ...nextInvalid, [key]: local });
    }
  }
  function remove(index: number) {
    const nextInvalid: InvalidSessionTimes = {};
    for (const [key, local] of Object.entries(invalidTimes)) {
      const match = /^pauses\.(\d+)\.(startsAt|endsAt)$/.exec(key);
      if (!match) nextInvalid[key as keyof InvalidSessionTimes] = local;
      else if (Number(match[1]) !== index) {
        const next =
          Number(match[1]) > index ? Number(match[1]) - 1 : Number(match[1]);
        nextInvalid[`pauses.${next}.${match[2] as "startsAt" | "endsAt"}`] =
          local;
      }
    }
    onChange(
      { ...value, pauses: pauses.filter((_, i) => i !== index) },
      nextInvalid,
    );
  }
  return (
    <div className="fitness-pause-corrections">
      <dl
        className="fitness-correction-time-preview"
        aria-label="Corrected workout time"
        aria-live="polite"
      >
        <div>
          <dt>Workout time</dt>
          <dd>{valid ? formatRestDuration(active) : "Check times"}</dd>
        </div>
        <div>
          <dt>Time paused</dt>
          <dd>
            {valid
              ? formatRestDuration(Math.max(0, elapsed - active))
              : "Check times"}
          </dd>
        </div>
        <div>
          <dt>Total elapsed time</dt>
          <dd>{valid ? formatRestDuration(elapsed) : "Check times"}</dd>
        </div>
      </dl>
      <p className="muted text-small">
        Workout time includes rest and excludes pauses.
      </p>
      {pauses.length > 0 && <h2>Pauses</h2>}
      {errors.pauses && (
        <p
          className="error"
          role="alert"
          tabIndex={-1}
          data-validation-error="true"
        >
          {errors.pauses}
        </p>
      )}
      {pauses.map((pause, index) => (
        <section
          key={index}
          aria-label={`Pause ${index + 1}`}
          className="fitness-pause-correction"
        >
          <header>
            <h3>Pause {index + 1}</h3>
            <button
              type="button"
              className="button"
              disabled={disabled}
              onClick={() => remove(index)}
              aria-label={`Remove pause ${index + 1}`}
            >
              Remove pause
            </button>
          </header>
          <div className="form-grid">
            {(["startsAt", "endsAt"] as const).map((field) => {
              const key = `pauses.${index}.${field}` as const;
              const fieldId = `${id}-${index}-${field}`;
              const raw = invalidTimes[key];
              const instant = pause[field];
              return (
                <div className="field" key={field}>
                  <label htmlFor={fieldId}>
                    {field === "startsAt" ? "Paused at" : "Resumed at"}
                  </label>
                  <SessionStartField
                    id={fieldId}
                    kind={field === "startsAt" ? "start" : "end"}
                    value={
                      raw ??
                      (instant ? instantToLocalInput(instant, timezone) : "")
                    }
                    onChange={(local) => update(index, field, local)}
                    invalid={raw !== undefined || !!errors.pauses}
                    describedBy={
                      raw !== undefined ? `${fieldId}-error` : undefined
                    }
                    disabled={disabled}
                  />
                  {raw !== undefined && (
                    <p id={`${fieldId}-error`} className="error" role="alert">
                      Choose a time that exists and is unambiguous in your
                      timezone.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
