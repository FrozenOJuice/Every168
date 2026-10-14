import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { Week, CalendarItem } from "@168hours/contracts";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { calendarHref } from "./calendar-layout";
import { CalendarDayFeed } from "./calendar-day-feed";
import type { CalendarFilter, CalendarDisplayRecord } from "./calendar-filters";
export function CalendarDayRecords({
  date,
  week,
  onClose,
  onOpen,
  items,
  filter,
  now,
  dialogRef,
}: {
  date: string;
  week: Week;
  now: string;
  dialogRef?: (element: HTMLDialogElement | null) => void;
  onClose: () => void;
  onOpen: (record: CalendarDisplayRecord, date: string) => void;
  items: CalendarItem[];
  filter: CalendarFilter;
}) {
  const activity = useQuery({
    queryKey: ["calendar-activity", date, date, week.timezone],
    queryFn: () => api.getCalendarActivity(date, date),
  });
  return (
    <Dialog
      dialogRef={dialogRef}
      title={formatDate(date, {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      })}
      onClose={onClose}
    >
      {activity.isPending && <Loading />}
      {activity.error && (
        <ErrorState
          error={activity.error}
          retry={() => void activity.refetch()}
        />
      )}
      {activity.data && (
        <CalendarDayFeed
          date={date}
          week={week}
          items={items}
          activity={activity.data}
          filter={filter}
          now={now}
          onOpen={onOpen}
        />
      )}
      <Link
        className="button"
        href={calendarHref(date, "day")}
        scroll={false}
        onClick={onClose}
      >
        Open Day view
      </Link>
    </Dialog>
  );
}
