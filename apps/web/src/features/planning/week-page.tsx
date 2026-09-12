"use client";
import { useCommand, CommandError } from "@/lib/use-command";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { localDate, addDays } from "@168hours/domain-utils";
import { dateSchema, type Block, type TimeEntry } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import {
  PageHeading,
  Loading,
  ErrorState,
  Empty,
} from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/dialog";
import { TimeForm } from "./time-form";
import { WeekSummary } from "./week-summary";
import { formatDate, formatTime } from "@/lib/format";
type Editor = {
  kind: "block" | "entry";
  date: string;
  item?: Block | TimeEntry;
  linkedBlock?: Block;
};
export function WeekPage({
  date,
  add = false,
}: {
  date?: string;
  add?: boolean;
}) {
  const {
    preferences: { timezone },
  } = useMe();
  const today = localDate(new Date(), timezone);
  const selected = dateSchema.safeParse(date).success ? date! : today;
  const query = useQuery({
    queryKey: ["week", selected, timezone],
    queryFn: () => api.getWeek(selected),
  });
  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: api.getCategories,
  });
  const cache = useQueryClient();
  const [filter, setFilter] = useState("");
  const [editor, setEditor] = useState<Editor | null>(
    add ? { kind: "block", date: today } : null,
  );
  const remove = useCommand({
    mutationFn: (
      {
        kind,
        id,
        version,
      }: { kind: "block" | "entry"; id: string; version: number },
      key: string,
    ) =>
      kind === "block"
        ? api.deleteTimeBlock(id, version, key)
        : api.deleteTimeEntry(id, version, key),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["week"] });
      await cache.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const week = query.data;
  const weekDate = week?.weekStart ?? selected;
  return (
    <>
      <PageHeading
        eyebrow="Plan • live • reflect"
        title="Your week"
        description="Make space for what matters. Leave room for life."
      >
        <div className="row">
          <button
            className="button"
            onClick={() => setEditor({ kind: "entry", date: today })}
          >
            Record time
          </button>
          <button
            className="button primary"
            onClick={() => setEditor({ kind: "block", date: weekDate })}
          >
            <Plus size={17} />
            Add block
          </button>
        </div>
      </PageHeading>
      <div className="row between week-toolbar">
        <div className="row">
          <Link
            className="button"
            aria-label="Previous week"
            href={"/week?date=" + addDays(weekDate, -7)}
          >
            <ChevronLeft size={17} />
          </Link>
          <strong>
            {formatDate(weekDate)} –{" "}
            {formatDate(addDays(weekDate, 6), {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </strong>
          <Link
            className="button"
            aria-label="Next week"
            href={"/week?date=" + addDays(weekDate, 7)}
          >
            <ChevronRight size={17} />
          </Link>
          <Link className="button" href="/week">
            This week
          </Link>
        </div>
        <div className="row">
          <label htmlFor="category-filter">Category</label>
          <select
            id="category-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {cats.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Link href="/settings">Manage categories</Link>
        </div>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        week && (
          <div className="stack">
            <WeekSummary week={week} />
            <div className="week-grid">
              {week.days.map((day) => (
                <section
                  key={day.date}
                  className={
                    "day-column" + (day.date === today ? " today" : "")
                  }
                  aria-label={formatDate(day.date, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                >
                  <button
                    className="day-heading"
                    aria-label={"Add block on " + day.date}
                    onClick={() => setEditor({ kind: "block", date: day.date })}
                  >
                    <span>{formatDate(day.date, { weekday: "short" })}</span>
                    <strong>{formatDate(day.date, { day: "numeric" })}</strong>
                    <Plus size={14} />
                  </button>
                  <div className="day-blocks">
                    {day.blockIds
                      .map((id) => week.blocks.find((b) => b.id === id)!)
                      .filter((b) => !filter || b.categoryId === filter)
                      .map((block) => {
                        const category = cats.data?.find(
                          (c) => c.id === block.categoryId,
                        );
                        const overlap = week.overlapPairs.some((pair) =>
                          pair.includes(block.id),
                        );
                        return (
                          <article
                            className="time-block"
                            key={block.id}
                            style={{
                              borderLeftColor:
                                category?.color ?? "var(--primary)",
                            }}
                          >
                            <button
                              className="block-edit"
                              onClick={() =>
                                setEditor({
                                  kind: "block",
                                  item: block,
                                  date: day.date,
                                })
                              }
                            >
                              <small>
                                {formatTime(block.startsAt, timezone)} –{" "}
                                {formatTime(block.endsAt, timezone)}
                              </small>
                              <strong>{block.title}</strong>
                              <span>{category?.name ?? "Uncategorized"}</span>
                              {overlap && (
                                <span className="overlap-label">
                                  Overlapping
                                </span>
                              )}
                            </button>
                            <div className="block-actions">
                              <button
                                onClick={() =>
                                  setEditor({
                                    kind: "entry",
                                    date: day.date,
                                    linkedBlock: block,
                                  })
                                }
                              >
                                Log actual
                              </button>
                              <button
                                disabled={remove.isPending}
                                onClick={() => {
                                  if (
                                    confirm(
                                      "Delete this planned block? Recorded time will remain.",
                                    )
                                  )
                                    remove.mutate({
                                      kind: "block",
                                      id: block.id,
                                      version: block.version,
                                    });
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    {day.blockIds.length === 0 && (
                      <p className="day-empty">Open space</p>
                    )}
                  </div>
                </section>
              ))}
            </div>
            <section className="panel">
              <div className="row between">
                <h2>Recorded this week</h2>
                <button
                  className="button"
                  onClick={() => setEditor({ kind: "entry", date: today })}
                >
                  Record time
                </button>
              </div>
              {!week.entries.length ? (
                <Empty>
                  Your plan is an intention. Log selected activities here when
                  they happen.
                </Empty>
              ) : (
                <ul className="record-list">
                  {week.entries.map((entry) => (
                    <li key={entry.id}>
                      <div>
                        <strong>{entry.title}</strong>
                        <small>
                          {formatDate(localDate(entry.startsAt, timezone))} ·{" "}
                          {formatTime(entry.startsAt, timezone)} –{" "}
                          {formatTime(entry.endsAt, timezone)}
                        </small>
                      </div>
                      {entry.sourceType === "manual" ? (
                        <div className="row">
                          <button
                            className="button"
                            onClick={() =>
                              setEditor({
                                kind: "entry",
                                item: entry,
                                date: today,
                              })
                            }
                          >
                            Edit
                          </button>
                          <button
                            className="button danger"
                            disabled={remove.isPending}
                            onClick={() => {
                              if (confirm("Delete this recorded time entry?"))
                                remove.mutate({
                                  kind: "entry",
                                  id: entry.id,
                                  version: entry.version,
                                });
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <Link href="/exercise">View exercise</Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )
      )}
      <CommandError command={remove} />
      {editor && (
        <Dialog
          title={
            editor.item
              ? "Edit " + (editor.kind === "block" ? "block" : "recorded time")
              : editor.kind === "block"
                ? "Add time block"
                : "Record actual time"
          }
          onClose={() => setEditor(null)}
        >
          <TimeForm {...editor} onSaved={() => setEditor(null)} />
        </Dialog>
      )}
    </>
  );
}
