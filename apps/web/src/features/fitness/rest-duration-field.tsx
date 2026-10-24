"use client";
import { useId, useState } from "react";

const splitDuration = (value: number | null) => ({
  value,
  minutes:
    value === null || Math.floor(value / 60) === 0
      ? ""
      : String(Math.floor(value / 60)).padStart(2, "0"),
  seconds:
    value === 0
      ? "0"
      : value === null || value % 60 === 0
        ? ""
        : String(value % 60).padStart(2, "0"),
});

export function RestDurationField({
  value,
  disabled,
  onChange,
  error,
  compact = false,
}: {
  value: number | null;
  disabled: boolean;
  onChange: (value: number | null) => void;
  error?: string;
  compact?: boolean;
}) {
  const errorId = useId();
  const [draft, setDraft] = useState(() => splitDuration(value));
  if (draft.value !== value) setDraft(splitDuration(value));

  const change = (part: "minutes" | "seconds", text: string) => {
    if (!/^\d{0,2}$/.test(text)) return;
    const next = { ...draft, [part]: text };
    const total =
      next.minutes === "" && next.seconds === ""
        ? null
        : Math.min(3600, Number(next.minutes) * 60 + Number(next.seconds));
    setDraft({ ...next, value: total });
    onChange(total);
  };

  return (
    <div
      className="fitness-rest-duration"
      role="group"
      aria-label="Rest duration"
    >
      {(["minutes", "seconds"] as const).map((part, index) => (
        <label key={part}>
          {index === 1 && !compact && (
            <span className="fitness-duration-separator" aria-hidden="true">
              :
            </span>
          )}
          <input
            type="text"
            inputMode="numeric"
            maxLength={2}
            aria-label={`Rest ${part}`}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            placeholder="—"
            disabled={disabled}
            value={draft[part]}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => change(part, event.target.value)}
            onBlur={() => {
              const normalized = splitDuration(value);
              setDraft(
                value === 0
                  ? {
                      value,
                      minutes: draft.minutes === "" ? "" : "0",
                      seconds: draft.seconds === "" ? "" : "0",
                    }
                  : normalized,
              );
            }}
          />
          <span>
            {compact
              ? part === "minutes"
                ? "min"
                : "sec"
              : part === "minutes"
                ? "Minutes"
                : "Seconds"}
          </span>
        </label>
      ))}
      {error && (
        <p id={errorId} className="error fitness-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
