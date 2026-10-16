"use client";
import { useId } from "react";
export function NotesField({
  label,
  value,
  onChange,
  disabled = false,
  hideLabel = false,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  hideLabel?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </label>
      <textarea
        id={id}
        disabled={disabled}
        maxLength={4000}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </div>
  );
}
