"use client";
import { useId, useState } from "react";
import { intentTagsSchema } from "@168hours/contracts";

export function IntentTagsField({
  value,
  onChange,
  disabled,
  label = "Intent tags (optional)",
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  label?: string;
}) {
  const id = useId();
  const serialized = value.join(", ");
  const [previous, setPrevious] = useState(serialized);
  const [text, setText] = useState(serialized);
  if (previous !== serialized) {
    setPrevious(serialized);
    setText(serialized);
  }
  const invalid = !intentTagsSchema.safeParse(value).success;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={text}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={`${id}-help`}
        placeholder="e.g. technique, recovery"
        onChange={(event) => {
          const next = event.target.value;
          const tags = next
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);
          setText(next);
          setPrevious(tags.join(", "));
          onChange(tags);
        }}
      />
      <p
        id={`${id}-help`}
        className={invalid ? "error text-small" : "muted text-small"}
        role={invalid ? "alert" : undefined}
      >
        {invalid
          ? "Use up to 8 tags, with 32 characters or fewer each."
          : "Separate tags with commas. Intent describes your purpose and does not restrict measurements."}
      </p>
    </div>
  );
}
