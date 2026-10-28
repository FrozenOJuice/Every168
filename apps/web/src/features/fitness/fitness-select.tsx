"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { useSearchDismissal } from "./use-search-dismissal";
export function FitnessSelect({
  label,
  options,
  value,
  onChange,
  disabled = false,
  hideLabel = false,
  searchable = true,
  error,
  compact = false,
  floating = false,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hideLabel?: boolean;
  searchable?: boolean;
  error?: string;
  compact?: boolean;
  floating?: boolean;
}) {
  const portalled = compact || floating;
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const renderPopup = (content: ReactNode) =>
    portalled ? createPortal(content, portalRoot ?? document.body) : content;
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 104 });
  useEffect(() => {
    if (!portalled || !open) return;
    const reposition = (event: Event) => {
      if (event.target instanceof Node && popup.current?.contains(event.target))
        return;
      const rect = trigger.current?.getBoundingClientRect();
      if (rect)
        setPosition({
          width: compact ? 104 : Math.max(160, rect.width),
          top: Math.min(
            rect.bottom + 4,
            window.innerHeight - options.length * 44 - 20,
          ),
          left: Math.max(
            8,
            Math.min(
              rect.left,
              window.innerWidth -
                (compact ? 104 : Math.max(160, rect.width)) -
                8,
            ),
          ),
        });
    };
    window.addEventListener("resize", reposition);
    document.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      document.removeEventListener("scroll", reposition, true);
    };
  }, [compact, portalled, open, options.length]);
  const choices = options;
  const matches = choices.filter((option) =>
    option.label.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const show = () => {
    if (portalled)
      setPortalRoot(trigger.current?.closest("dialog") ?? document.body);
    const rect = trigger.current?.getBoundingClientRect();
    if (portalled && rect)
      setPosition({
        width: compact ? 104 : Math.max(160, rect.width),
        top: Math.min(
          rect.bottom + 4,
          window.innerHeight - options.length * 44 - 20,
        ),
        left: Math.max(
          8,
          Math.min(
            rect.left,
            window.innerWidth - (compact ? 104 : Math.max(160, rect.width)) - 8,
          ),
        ),
      });
    setSearch("");
    setActive(
      Math.max(
        0,
        choices.findIndex((option) => option.value === value),
      ),
    );
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const choose = (next: string) => {
    onChange(next);
    close();
  };
  useLayoutEffect(() => {
    if (open)
      (searchable ? input.current : list.current)?.focus({
        preventScroll: portalled,
      });
  }, [open, searchable, portalled]);
  useSearchDismissal({ root, field: input, popup, trigger, setOpen });
  useEffect(() => {
    if (open && !portalled)
      document
        .getElementById(`${id}-option-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active, id, search, portalled]);
  return (
    <div
      className={`fitness-select${compact ? " fitness-unit-select" : ""}`}
      ref={root}
      onKeyDown={(event) => {
        if (!searchable && open) {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) =>
              Math.max(
                0,
                Math.min(
                  matches.length - 1,
                  index + (event.key === "ArrowDown" ? 1 : -1),
                ),
              ),
            );
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            setActive(event.key === "Home" ? 0 : matches.length - 1);
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (matches[active]) choose(matches[active].value);
          }
        }
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
      onBlur={(e) => {
        if (
          !e.currentTarget.contains(e.relatedTarget) &&
          !popup.current?.contains(e.relatedTarget)
        )
          setOpen(false);
      }}
    >
      <span className={`fitness-select-label${hideLabel ? " sr-only" : ""}`}>
        {label}
      </span>
      <button
        ref={trigger}
        disabled={disabled}
        type="button"
        className="fitness-select-trigger"
        aria-label={label}
        data-invalid={!!error}
        aria-describedby={`${id}-value${error ? ` ${id}-error` : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-choices`}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show();
          }
        }}
      >
        <span id={`${id}-value`}>
          {choices.find((option) => option.value === value)?.label ?? "Choose…"}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {error && (
        <p id={`${id}-error`} className="error" role="alert">
          {error}
        </p>
      )}
      {open &&
        !disabled &&
        renderPopup(
          <div
            ref={popup}
            id={`${id}-choices`}
            className={`fitness-select-options${compact ? " fitness-unit-options" : ""}`}
            style={
              portalled
                ? {
                    position: "fixed",
                    ...position,
                    right: "auto",
                    marginTop: 0,
                    zIndex: 50,
                  }
                : undefined
            }
          >
            {searchable && (
              <label className="fitness-select-option-search">
                <Search size={15} aria-hidden="true" />
                <input
                  ref={input}
                  role="combobox"
                  aria-label={`Search ${label.toLowerCase()}`}
                  aria-expanded="true"
                  aria-autocomplete="list"
                  aria-controls={`${id}-list`}
                  aria-activedescendant={
                    matches[active] ? `${id}-option-${active}` : undefined
                  }
                  disabled={disabled}
                  autoComplete="off"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      setActive((index) =>
                        Math.max(
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
                      if (matches[active]) choose(matches[active].value);
                    }
                  }}
                />
              </label>
            )}
            <ul
              ref={list}
              tabIndex={searchable ? undefined : 0}
              aria-activedescendant={
                !searchable && matches[active]
                  ? `${id}-option-${active}`
                  : undefined
              }
              id={`${id}-list`}
              role="listbox"
              aria-label={label}
            >
              {matches.map((option, index) => (
                <li
                  key={option.value}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  data-active={active === index}
                  onPointerDown={(e) => e.preventDefault()}
                  onMouseMove={() => setActive(index)}
                  onClick={() => choose(option.value)}
                >
                  {option.label}
                  {option.value === value && (
                    <Check size={16} aria-hidden="true" />
                  )}
                </li>
              ))}
            </ul>
            {!matches.length && (
              <p className="text-small" role="status">
                No matching options.
              </p>
            )}
          </div>,
        )}
    </div>
  );
}
