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
import { formatTime } from "@/lib/format";
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
      const width = Math.min(400, viewportWidth - 16);
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
        {filtered && (
          <button
            className="text-button"
            type="button"
            onClick={() => {
              onFilter({ q: "", kind: "all" });
              onClose();
            }}
          >
            Clear filter
          </button>
        )}
      </div>
      <Form
        form={form}
        retrySafe={false}
        onSubmit={async (value) => setSearch(value)}
      >
        <Field name="q" label="Title contains" />
        <Field name="kind" label="Record type">
          <option value="all">Everything</option>
          <option value="block">Planned time</option>
          <option value="entry">Recorded time</option>
          <option value="all_day">All-day plans</option>
          <option value="unscheduled">Unscheduled plans</option>
        </Field>
        <details className="calendar-search-dates">
          <summary>Date range</summary>
          <div className="form-grid">
            <Field
              name="from"
              label="Starts on or after (optional)"
              type="date"
            />
            <Field
              name="to"
              label="Starts on or before (optional)"
              type="date"
            />
          </div>
          <p>
            Applies to Search all dates. Undated plans appear without a range.
          </p>
        </details>
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
                  onClick={() => onOpen(record)}
                >
                  <strong>{record.item.title}</strong>
                  <small>
                    {record.kind === "item"
                      ? (record.item.date ?? "No date") +
                        " · " +
                        (record.item.kind === "all_day"
                          ? "All day"
                          : "Unscheduled")
                      : localDate(record.item.startsAt, preferences.timezone) +
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
