import { features } from "@/lib/release";
import { useWatch } from "react-hook-form";
import { z } from "zod";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { calendarSearchQuery, type SearchRecord } from "@168hours/contracts";
import { api } from "@/lib/api";
import { Form, Field, Submit, useZodForm } from "@/components/ui/form";
import { Loading, ErrorState } from "@/components/ui/feedback";
import { X, ChevronDown } from "lucide-react";
import { CalendarDateField } from "./calendar-form-fields";
import { formatTime, formatDate } from "@/lib/format";
import { useMe } from "@/features/identity/me";
import { localDate } from "@168hours/domain-utils";
import type { CalendarFilter } from "./calendar-filters";
export function CalendarSearch({
  anchor,
  filter,
  onFilter,
  onClose,
  onOpen,
}: {
  anchor: RefObject<HTMLButtonElement | null>;
  filter: CalendarFilter;
  onFilter: (filter: CalendarFilter) => void;
  onClose: () => void;
  onOpen: (record: SearchRecord) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [datesOpen, setDatesOpen] = useState(false);
  const [search, setSearch] = useState<ReturnType<
    typeof calendarSearchQuery.parse
  > | null>(null);
  const optionalDate = z
    .union([calendarSearchQuery.shape.from, z.literal("")])
    .transform((v) => v || undefined);
  const schema = z
    .object({
      ...calendarSearchQuery.shape,
      from: optionalDate,
      to: optionalDate,
    })
    .refine((v) => !v.from || !v.to || v.from <= v.to, {
      path: ["to"],
      message: "End date must follow start date.",
    });
  const form = useZodForm(schema, {
    ...filter,
    from: undefined,
    to: undefined,
    limit: 30,
  });
  const [from, to] = useWatch({ control: form.control, name: ["from", "to"] });
  const q = useInfiniteQuery({
    queryKey: ["calendar-search", search],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.searchCalendar({ ...search, cursor: pageParam }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    enabled: !!search,
  });
  const { preferences } = useMe();
  const results = q.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = !!(filter.q || filter.categoryId || filter.kind !== "all");
  useLayoutEffect(() => {
    panel.current
      ?.querySelector<HTMLInputElement>('input[name="q"]')
      ?.focus({ preventScroll: true });
  }, []);
  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    const place = () => {
      const bounds = anchor.current?.getBoundingClientRect();
      if (!bounds) return;
      const viewport = window.visualViewport;
      const leftEdge = (viewport?.offsetLeft ?? 0) + 8;
      const topEdge = (viewport?.offsetTop ?? 0) + 8;
      const viewportWidth = viewport?.width ?? innerWidth;
      const width = Math.min(380, viewportWidth - 16);
      const rightEdge = leftEdge + viewportWidth - 16;
      const bottomEdge = topEdge + (viewport?.height ?? innerHeight) - 16;
      const left = Math.max(leftEdge, Math.min(bounds.left, rightEdge - width));
      const below = bottomEdge - bounds.bottom - 8;
      const above = bounds.top - topEdge - 8;
      const placeAbove = below < 240 && above > below;
      element.style.width = `${width}px`;
      element.style.left = `${left}px`;
      element.style.top = `${placeAbove ? topEdge : bounds.bottom + 8}px`;
      element.style.maxHeight = `${Math.max(0, placeAbove ? above : below)}px`;
      element.style.visibility = "visible";
    };
    place();
    document.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      document.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, [anchor]);
  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !element.contains(event.target) &&
        !anchor.current?.contains(event.target)
      )
        onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (
        event.target instanceof Element &&
        element.contains(event.target) &&
        event.target.closest('[role="dialog"]') !== element
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      anchor.current?.focus({ preventScroll: true });
      onClose();
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape, true);
    };
  }, [anchor, onClose]);
  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="calendar-search-popover"
    >
      <div className="calendar-search-heading">
        <div>
          <h2 id={titleId}>Search calendar</h2>
          <p>Find plans and recorded time.</p>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Close search"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <Form
        form={form}
        retrySafe={false}
        onInvalid={() => setDatesOpen(true)}
        onSubmit={async (value) => setSearch(value)}
      >
        <Field name="q" label="Title contains" />
        <Field name="kind" label="Record type">
          <option value="all">Everything</option>
          <option value="block">Planned time</option>
          <option value="entry">Recorded time</option>
          <option value="all_day">All-day plans</option>
          {features.unscheduled && (
            <option value="unscheduled">Unscheduled plans</option>
          )}
        </Field>
        <div className="calendar-search-dates">
          <button
            type="button"
            className="button calendar-search-range-trigger"
            aria-expanded={datesOpen}
            aria-label="Date range"
            aria-describedby={from || to ? `${titleId}-dates` : undefined}
            onClick={() => setDatesOpen(!datesOpen)}
          >
            <span className="calendar-search-range-label">
              <span>Date range</span>
              {(from || to) && (
                <small id={`${titleId}-dates`}>
                  {from ? formatDate(from) : "Any date"} -{" "}
                  {to ? formatDate(to) : "Any date"}
                </small>
              )}
            </span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          {datesOpen && (
            <div className="calendar-search-date-fields">
              <CalendarDateField
                name="from"
                label="From (optional)"
                timezone={preferences.timezone}
                optional
              />
              <CalendarDateField
                name="to"
                label="Through (optional)"
                timezone={preferences.timezone}
                optional
              />
              <p className="muted text-small">Used when searching all dates.</p>
            </div>
          )}
        </div>
        <div className="calendar-search-actions">
          <Submit>Search all dates</Submit>
          <button
            className="button"
            type="button"
            onClick={() => {
              const value = form.getValues();
              onFilter({ q: value.q, kind: value.kind });
              onClose();
            }}
          >
            Filter visible calendar
          </button>
        </div>
      </Form>
      {filtered && (
        <button
          className="button calendar-search-clear"
          type="button"
          onClick={() => {
            onFilter({ q: "", kind: "all" });
            onClose();
          }}
        >
          Clear filter
        </button>
      )}
      {search && (
        <section
          className="calendar-search-results"
          aria-label="Search results"
        >
          <h3>Results</h3>
          {q.isPending && <Loading />}
          {q.error && (
            <ErrorState error={q.error} retry={() => void q.refetch()} />
          )}
          {q.data && results.length === 0 && <p>No matching records.</p>}
          <ol className="search-results">
            {results.map((record) => (
              <li key={record.kind + record.item.id}>
                <button
                  className="calendar-search-result"
                  type="button"
                  onClick={() => onOpen(record)}
                >
                  <strong>{record.item.title}</strong>
                  <small>
                    {record.kind === "item"
                      ? (record.item.date
                          ? formatDate(record.item.date, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "No date") +
                        " · " +
                        (record.item.kind === "all_day"
                          ? "All day"
                          : "Unscheduled")
                      : formatDate(
                          localDate(record.item.startsAt, preferences.timezone),
                          { month: "short", day: "numeric", year: "numeric" },
                        ) +
                        " · " +
                        formatTime(record.item.startsAt, preferences.timezone) +
                        " · " +
                        (record.kind === "block" ? "Planned" : "Recorded")}
                  </small>
                </button>
              </li>
            ))}
          </ol>
          {q.hasNextPage && (
            <button
              className="button"
              disabled={q.isFetchingNextPage}
              onClick={() => void q.fetchNextPage()}
            >
              Load more results
            </button>
          )}
        </section>
      )}
    </div>,
    document.body,
  );
}
