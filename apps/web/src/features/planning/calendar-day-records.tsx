import { CalendarItemButton } from "./calendar-item-button";
import {
  itemsOnDate,
  type CalendarFilter,
  type CalendarDisplayRecord,
} from "./calendar-filters";
import Link from "next/link";
import type { Week, CalendarItem } from "@168hours/contracts";
import { Dialog } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { CalendarRecord } from "./calendar-record";
import { calendarHref, dayRecords } from "./calendar-layout";

export function CalendarDayRecords({
  date,
  week,
  onClose,
  onOpen,
  onAdd,
  items,
  filter,
}: {
  date: string;
  week: Week;
  onClose: () => void;
  onOpen: (record: CalendarDisplayRecord, date: string) => void;
  items: CalendarItem[];
  filter: CalendarFilter;
  onAdd: (date: string) => void;
}) {
  const records: CalendarDisplayRecord[] = [
    ...itemsOnDate(items, date, filter).map((item) => ({
      kind: "item" as const,
      item,
    })),
    ...dayRecords(week, date, filter),
  ];
  return (
    <Dialog
      title={formatDate(date, {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      })}
      onClose={onClose}
    >
      <p className="muted text-small">
        {records.length} record{records.length === 1 ? "" : "s"} ·{" "}
        {week.timezone}
      </p>
      {records.length ? (
        <ol className="day-records">
          {records.map((record) => (
            <li key={record.kind + record.item.id}>
              {record.kind === "item" ? (
                <CalendarItemButton
                  item={record.item}
                  onOpen={() => onOpen(record, date)}
                />
              ) : (
                <CalendarRecord
                  record={record}
                  week={week}
                  onOpen={() => onOpen(record, date)}
                />
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">No time planned or recorded for this day.</p>
      )}
      <div className="row wrap">
        <button className="button primary" onClick={() => onAdd(date)}>
          Add block
        </button>
        <Link
          className="button"
          href={calendarHref(date, "day")}
          scroll={false}
          onClick={onClose}
        >
          Open Day view
        </Link>
      </div>
    </Dialog>
  );
}
