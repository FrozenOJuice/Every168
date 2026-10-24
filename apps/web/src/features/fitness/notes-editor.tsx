"use client";
import { ChevronDown, StickyNote } from "lucide-react";
import { NotesField } from "./notes-field";

export function NotesEditor({
  label,
  value,
  onChange,
  open,
  onOpenChange,
  disabled = false,
  error,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <details
      className="fitness-inline-editor fitness-notes-editor"
      open={open}
      onToggle={(event) => {
        if (event.currentTarget.open !== open)
          onOpenChange(event.currentTarget.open);
      }}
    >
      <summary
        className="fitness-inline-editor-heading"
        role="button"
        aria-expanded={open}
        aria-label={`Toggle ${label.toLowerCase()}`}
      >
        <StickyNote size={16} aria-hidden="true" />
        Notes
        {!!value && (
          <span className="fitness-note-indicator" aria-hidden="true" />
        )}
        <ChevronDown
          className="fitness-disclosure-chevron"
          size={16}
          aria-hidden="true"
        />
      </summary>
      <NotesField
        label={label}
        hideLabel
        value={value}
        onChange={onChange}
        disabled={disabled}
        error={error}
      />
    </details>
  );
}
