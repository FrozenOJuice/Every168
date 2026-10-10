"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { CalendarItem } from "@168hours/contracts";
import { localDate } from "@168hours/domain-utils";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import {
  Empty,
  ErrorState,
  Loading,
  PageHeading,
} from "@/components/ui/feedback";
import { useMe } from "@/features/identity/me";
import { api } from "@/lib/api";
import { CalendarItemButton } from "./calendar-item-button";
import { CalendarItemEditor } from "./calendar-item-editor";
import { calendarHref } from "./calendar-layout";
import { currentHourMinute } from "./calendar-times";
import { TimeForm } from "./time-form";

export function UnscheduledPlansPage() {
  const { preferences } = useMe();
  const router = useRouter();
  const [editing, setEditing] = useState<CalendarItem | "new" | null>(null);
  const [scheduling, setScheduling] = useState<CalendarItem | null>(null);
  const [notice, setNotice] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["calendar-items", "backlog"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.getCalendarBacklog({ cursor: pageParam }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const now = new Date().toISOString();
  const today = localDate(now, preferences.timezone);
  return (
    <>
      <PageHeading
        title="Unscheduled plans"
        description="Keep plans here until you choose when to do them."
      >
        <button className="button primary" onClick={() => setEditing("new")}>
          Add plan
        </button>
      </PageHeading>
      {notice && <p role="status">{notice}</p>}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : items.length ? (
        <ol className="unscheduled-list">
          {items.map((item) => (
            <li key={item.id}>
              <CalendarItemButton item={item} onOpen={() => setEditing(item)} />
              {item.notes && <p>{item.notes}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <Empty>No unscheduled plans yet. Add one to keep it for later.</Empty>
      )}
      {query.hasNextPage && (
        <button
          className="button"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Load more
        </button>
      )}
      {editing && (
        <CalendarItemEditor
          key={editing === "new" ? "new" : `${editing.id}:${editing.version}`}
          item={editing === "new" ? undefined : editing}
          kind="unscheduled"
          date={today}
          onClose={() => setEditing(null)}
          onSchedule={(item) => {
            setEditing(null);
            setScheduling(item);
          }}
          onSaved={(message, date) => {
            setEditing(null);
            setNotice(message);
            if (date) router.push(calendarHref(date, "day"));
          }}
        />
      )}
      {scheduling && (
        <Dialog title="Schedule plan" onClose={() => setScheduling(null)}>
          <TimeForm
            key={`${scheduling.id}:${scheduling.version}`}
            kind="block"
            date={today}
            minute={currentHourMinute(now, preferences.timezone)}
            scheduledItem={scheduling}
            onSaved={(result) => {
              setScheduling(null);
              if (result.kind === "timed")
                router.push(
                  calendarHref(
                    localDate(result.startsAt, preferences.timezone),
                    "day",
                  ),
                );
            }}
          />
        </Dialog>
      )}
    </>
  );
}
