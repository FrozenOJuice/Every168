import { z } from "zod";
import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { calendarSearchQuery, type SearchRecord } from "@168hours/contracts";
import { api } from "@/lib/api";
import { Dialog } from "@/components/ui/dialog";
import { Form, Field, Submit, useZodForm } from "@/components/ui/form";
import { Loading, ErrorState } from "@/components/ui/feedback";
import { formatTime } from "@/lib/format";
import { useMe } from "@/features/identity/me";
import { localDate } from "@168hours/domain-utils";
import type { CalendarFilter } from "./calendar-filters";
export function CalendarSearch({
  filter,
  onFilter,
  onClose,
  onOpen,
}: {
  filter: CalendarFilter;
  onFilter: (filter: CalendarFilter) => void;
  onClose: () => void;
  onOpen: (record: SearchRecord) => void;
}) {
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
      categoryId: z
        .union([calendarSearchQuery.shape.categoryId, z.literal("")])
        .transform((v) => v || undefined),
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
  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: api.getCategories,
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
  return (
    <Dialog title="Search and filter" onClose={onClose}>
      <Form form={form} retrySafe={false} onSubmit={async (v) => setSearch(v)}>
        <Field name="q" label="Title contains" />
        <Field name="kind" label="Record type">
          <option value="all">Everything</option>
          <option value="block">Planned time</option>
          <option value="entry">Recorded time</option>
          <option value="all_day">All-day plans</option>
          <option value="unscheduled">Unscheduled plans</option>
        </Field>
        <Field name="categoryId" label="Category">
          <option value="">All categories</option>
          <option value="none">Uncategorized</option>
          {cats.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Field>
        <div className="row wrap">
          <button
            className="button"
            type="button"
            onClick={() => {
              const v = form.getValues();
              onFilter({
                q: v.q,
                kind: v.kind,
                categoryId: v.categoryId || undefined,
              });
              onClose();
            }}
          >
            Filter visible calendar
          </button>
          <button
            className="button"
            type="button"
            onClick={() => {
              onFilter({ q: "", kind: "all" });
              onClose();
            }}
          >
            Clear filter
          </button>
        </div>
        <div className="form-grid">
          <Field
            name="from"
            label="Starts on or after (optional)"
            type="date"
          />
          <Field name="to" label="Starts on or before (optional)" type="date" />
        </div>
        <Submit>Search all dates</Submit>
      </Form>
      {search && (
        <>
          <p className="muted text-small">
            Newest records first. Date bounds use {preferences.timezone}.
            Undated plans appear when no date bounds are set.
          </p>
          {q.isPending && <Loading />}
          {q.error && (
            <ErrorState error={q.error} retry={() => void q.refetch()} />
          )}
          <ol className="search-results">
            {q.data?.pages
              .flatMap((p) => p.items)
              .map((r) => (
                <li key={r.kind + r.item.id}>
                  <button className="calendar-record" onClick={() => onOpen(r)}>
                    <strong>{r.item.title}</strong>
                    <small>
                      {r.kind === "item"
                        ? (r.item.date ?? "No date") +
                          " · " +
                          (r.item.kind === "all_day"
                            ? "All day"
                            : "Unscheduled")
                        : localDate(r.item.startsAt, preferences.timezone) +
                          " · " +
                          formatTime(r.item.startsAt, preferences.timezone) +
                          " · " +
                          (r.kind === "block" ? "Planned" : "Recorded")}
                    </small>
                  </button>
                </li>
              ))}
          </ol>
          {q.data && !q.data.pages[0]?.items.length && (
            <p>No matching records.</p>
          )}
          {q.hasNextPage && (
            <button
              className="button"
              disabled={q.isFetchingNextPage}
              onClick={() => void q.fetchNextPage()}
            >
              Load more results
            </button>
          )}
        </>
      )}
    </Dialog>
  );
}
