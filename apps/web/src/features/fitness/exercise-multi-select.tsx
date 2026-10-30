"use client";
import { useEffect, useId, useRef, useState } from "react";
import { X, Search } from "lucide-react";
import { useSearchDismissal } from "./use-search-dismissal";
export function ExerciseMultiSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  disabled = false,
  optional = false,
}: {
  label: string;
  options: readonly T[];
  value: T[];
  onChange: (value: T[]) => void;
  error?: string;
  disabled?: boolean;
  optional?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const skipFocusOpen = useRef(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const matches = options.filter(
    (option) =>
      !value.includes(option) &&
      option.toLowerCase().includes(search.trim().toLowerCase()),
  );
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-option-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active, id, search]);
  useSearchDismissal({ root, field: input, popup, setOpen });
  const focusSearchClosed = () => {
    skipFocusOpen.current = document.activeElement !== input.current;
    input.current?.focus({ preventScroll: true });
  };
  const choose = (option: T) => {
    onChange([...value, option]);
    setSearch("");
    setActive(0);
    setOpen(false);
    focusSearchClosed();
  };
  const dropdown = open && !disabled && (
    <div ref={popup} className="fitness-multi-select-dropdown">
      <ul id={`${id}-options`} role="listbox" aria-label={label}>
        {matches.map((option, index) => (
          <li
            id={`${id}-option-${index}`}
            role="option"
            aria-selected={false}
            data-active={index === active}
            key={option}
            onPointerDown={(e) => e.preventDefault()}
            onMouseMove={() => setActive(index)}
            onClick={() => choose(option)}
          >
            {option}
          </li>
        ))}
      </ul>
      {!matches.length && (
        <p className="text-small" role="status">
          {search ? "No matching options." : "All options selected."}
        </p>
      )}
    </div>
  );
  return (
    <div
      ref={root}
      className="fitness-multi-select"
      onBlur={(e) => {
        if (
          e.relatedTarget !== input.current &&
          !(
            e.relatedTarget instanceof Node &&
            popup.current?.contains(e.relatedTarget)
          )
        )
          setOpen(false);
      }}
    >
      <label htmlFor={id}>
        {label}
        {optional && <span aria-hidden="true"> (optional)</span>}
      </label>
      <div className="fitness-select-input">
        <Search
          size={16}
          className="fitness-select-search-icon"
          aria-hidden="true"
        />
        <input
          ref={input}
          id={id}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-activedescendant={
            open && matches[active] ? `${id}-option-${active}` : undefined
          }
          value={search}
          placeholder={`Search ${label.toLowerCase()}…`}
          onFocus={() => {
            if (skipFocusOpen.current) {
              skipFocusOpen.current = false;
              return;
            }
            setOpen(true);
            setActive(0);
          }}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setSearch(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setActive((index) =>
                !open
                  ? e.key === "ArrowDown"
                    ? 0
                    : Math.max(0, matches.length - 1)
                  : Math.max(
                      0,
                      Math.min(
                        matches.length - 1,
                        index + (e.key === "ArrowDown" ? 1 : -1),
                      ),
                    ),
              );
            } else if (e.key === "Home" && !search) {
              e.preventDefault();
              setActive(0);
            } else if (e.key === "End" && !search) {
              e.preventDefault();
              setActive(Math.max(0, matches.length - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (open && matches[active]) choose(matches[active]);
              else setOpen(true);
            } else if (e.key === "Escape" && open) {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }
          }}
        />
        {dropdown}
      </div>
      {value.length > 0 && (
        <ul
          className="fitness-selection-chips"
          aria-label={`Selected ${label.toLowerCase()}`}
        >
          {value.map((option) => (
            <li key={option}>
              <span>{option}</span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${option}`}
                onClick={(event) => {
                  const buttons = Array.from(
                    event.currentTarget
                      .closest("ul")!
                      .querySelectorAll("button"),
                  );
                  const index = buttons.indexOf(event.currentTarget);
                  const next = buttons[index + 1] ?? buttons[index - 1];
                  onChange(value.filter((item) => item !== option));
                  setOpen(false);
                  if (event.detail === 0) {
                    if (next) next.focus({ preventScroll: true });
                    else focusSearchClosed();
                  }
                }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p id={`${id}-error`} className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
