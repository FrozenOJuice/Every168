"use client";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { number } from "@/lib/format";

export function RestBetweenSets({
  value,
  onChange,
  index,
  disabled,
  error,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  index: number;
  disabled: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const editor = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  if (error && !open) setOpen(true);
  useLayoutEffect(() => {
    if (open) editor.current?.focus();
    if (open) editor.current?.select();
  }, [open]);
  const label =
    value === null
      ? "Add rest"
      : value === 0
        ? "No rest"
        : `Rest ${number(value)} sec`;
  return (
    <div className="fitness-rest-between-sets">
      {open ? (
        <div className="fitness-rest-line-editor">
          <label htmlFor={id}>Rest</label>
          <input
            ref={editor}
            id={id}
            aria-label="Rest (seconds)"
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            type="number"
            inputMode="numeric"
            min={0}
            max={3600}
            step={1}
            style={{ width: `${Math.max(2, String(value ?? "").length)}ch` }}
            value={value ?? ""}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
            onBlur={() => {
              if (!error) setOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !error) {
                event.preventDefault();
                setOpen(false);
                requestAnimationFrame(() => trigger.current?.focus());
              }
            }}
          />
          <span>sec</span>
          {error && (
            <p
              id={`${id}-error`}
              className="error fitness-field-error"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      ) : (
        <button
          ref={trigger}
          type="button"
          className="fitness-text-action"
          disabled={disabled}
          aria-label={`Edit rest after set ${index + 1}: ${label}`}
          onClick={() => setOpen(true)}
        >
          {label}
        </button>
      )}
    </div>
  );
}
