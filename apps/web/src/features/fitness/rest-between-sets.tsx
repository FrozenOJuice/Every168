"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { RestDurationField } from "./rest-duration-field";
import { formatRestDuration } from "./rest-duration";

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
  const [draft, setDraft] = useState(value);
  const editor = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  if (error && !open) setOpen(true);
  useLayoutEffect(() => {
    if (open) {
      const input = editor.current?.querySelector("input");
      input?.focus();
      input?.select();
    }
  }, [open]);
  const label =
    value === null
      ? "Rest as needed"
      : value === 0
        ? "No rest"
        : `Rest ${formatRestDuration(value)}`;
  return (
    <div className="fitness-rest-between-sets">
      <div
        hidden={!open}
        ref={editor}
        className="fitness-rest-line-editor"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            onChange(draft);
            if (!error) setOpen(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            // Finish normalization before hiding, without discarding which
            // time component the user explicitly set to zero.
            editor.current
              ?.querySelector<HTMLInputElement>("input:focus")
              ?.blur();
            setOpen(false);
            requestAnimationFrame(() => trigger.current?.focus());
          }
        }}
      >
        <span>Rest</span>
        <RestDurationField
          compact
          value={draft}
          onChange={setDraft}
          disabled={disabled}
          error={error}
        />
      </div>
      {!open && (
        <button
          ref={trigger}
          type="button"
          className="fitness-text-action"
          disabled={disabled}
          aria-label={`Edit rest after set ${index + 1}: ${label}`}
          onClick={() => {
            setDraft(value);
            setOpen(true);
          }}
        >
          {label}
        </button>
      )}
    </div>
  );
}
