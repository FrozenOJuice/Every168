"use client";
import { useId, useRef, useState } from "react";
import { Search, Check } from "lucide-react";
import { useSearchDismissal } from "./use-search-dismissal";
export function ExerciseFilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const id = useId();
  const root = useRef<HTMLFieldSetElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(false);
  useSearchDismissal({ root, field: input, popup, setOpen: setActive });
  const matches = options.filter((option) =>
    option.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <fieldset
      ref={root}
      className="fitness-filter-group"
      onFocus={() => setActive(true)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && active) {
          event.preventDefault();
          event.stopPropagation();
          input.current?.focus();
          setActive(false);
          return;
        }
        const buttons = Array.from(
          popup.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
        );
        if (!buttons.length) return;
        const index = buttons.indexOf(event.target as HTMLButtonElement);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setActive(true);
          const next =
            index < 0
              ? event.key === "ArrowDown"
                ? 0
                : buttons.length - 1
              : Math.max(
                  0,
                  Math.min(
                    buttons.length - 1,
                    index + (event.key === "ArrowDown" ? 1 : -1),
                  ),
                );
          if (active) buttons[next]?.focus();
          else
            requestAnimationFrame(() => {
              if (root.current?.contains(buttons[next]!))
                buttons[next]?.focus();
            });
        } else if (
          index >= 0 &&
          (event.key === "Home" || event.key === "End")
        ) {
          event.preventDefault();
          buttons[event.key === "Home" ? 0 : buttons.length - 1]?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setActive(false);
      }}
    >
      <legend>{label}</legend>
      <label className="fitness-search" htmlFor={id}>
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Search {label.toLowerCase()}</span>
        <input
          ref={input}
          id={id}
          type="search"
          placeholder={label === "Muscle group" ? "Muscles…" : `${label}…`}
          aria-controls={`${id}-options`}
          aria-describedby={`${id}-hint`}
          onClick={() => setActive(true)}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setActive(true);
          }}
        />
      </label>
      <span id={`${id}-hint`} className="sr-only">
        Use arrow keys to browse options and Space to toggle them. Escape closes
        options.
      </span>
      <div
        id={`${id}-options`}
        ref={popup}
        className="fitness-filter-options"
        hidden={!active}
      >
        {matches.map((option) => (
          <button
            type="button"
            className="fitness-filter-option"
            key={option}
            aria-pressed={value.includes(option)}
            onClick={() =>
              onChange(
                value.includes(option)
                  ? value.filter((item) => item !== option)
                  : [...value, option],
              )
            }
          >
            <span>{option}</span>
            {value.includes(option) && <Check size={17} aria-hidden="true" />}
          </button>
        ))}
        {!matches.length && (
          <p className="text-small" role="status">
            No matching options.
          </p>
        )}
      </div>
    </fieldset>
  );
}
