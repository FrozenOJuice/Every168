import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Ellipsis,
} from "lucide-react";
import { addDays } from "@168hours/domain-utils";
import { dateSchema } from "@168hours/contracts";
import { Dialog } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { calendarHref, type CalendarView } from "./calendar-layout";
import { shiftPeriod } from "./calendar-dates";

export function CalendarToolbar({
  date,
  weekStart,
  today,
  view,
  onAdd,
  onToday,
  onJump,
  onTools,
  onSearch,
  filtered,
}: {
  date: string;
  weekStart: string;
  today: string;
  view: CalendarView;
  onAdd: () => void;
  onToday: () => void;
  onJump: (date: string) => void;
  onTools: () => void;
  onSearch: () => void;
  filtered: boolean;
}) {
  const [jump, setJump] = useState(false);
  const dateId = useId();
  const router = useRouter();
  const title =
    view === "month"
      ? formatDate(date, { month: "long", year: "numeric" })
      : view === "day"
        ? formatDate(date, {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : formatDate(weekStart, { month: "short", day: "numeric" }) +
          " – " +
          formatDate(addDays(weekStart, 6), {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
  return (
    <>
      <header className="calendar-toolbar">
        <div className="calendar-period">
          <h1 className="sr-only">Calendar</h1>
          <h2>
            <button
              className="calendar-date-title"
              aria-label={"Jump to date, " + title}
              aria-haspopup="dialog"
              onClick={() => setJump(true)}
            >
              {title}
              <ChevronDown size={15} aria-hidden="true" />
            </button>
          </h2>
          <div className="calendar-date-controls">
            <Link
              className="icon-button"
              aria-label={"Previous " + view}
              href={calendarHref(shiftPeriod(date, view, -1), view)}
              scroll={false}
            >
              <ChevronLeft size={19} />
            </Link>
            <Link
              className="button"
              href={calendarHref(today, view)}
              scroll={false}
              onClick={onToday}
            >
              Today
            </Link>
            <Link
              className="icon-button"
              aria-label={"Next " + view}
              href={calendarHref(shiftPeriod(date, view, 1), view)}
              scroll={false}
            >
              <ChevronRight size={19} />
            </Link>
          </div>
        </div>
        <div className="calendar-view-tools">
          <nav className="segmented" aria-label="Calendar view">
            {(["day", "week", "month"] as const).map((item) => (
              <Link
                key={item}
                href={calendarHref(date, item)}
                scroll={false}
                aria-current={view === item ? "true" : undefined}
              >
                {item[0]!.toUpperCase() + item.slice(1)}
              </Link>
            ))}
          </nav>
          <button
            className="icon-button"
            aria-label="Search and filter calendar"
            aria-pressed={filtered}
            onClick={onSearch}
          >
            <Search size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Calendar tools"
            onClick={onTools}
          >
            <Ellipsis size={20} />
          </button>
          <button className="button primary calendar-add-block" onClick={onAdd}>
            <Plus size={17} aria-hidden="true" />
            <span className="calendar-add-label">Add block</span>
          </button>
        </div>
      </header>
      {jump && (
        <Dialog title="Jump to date" onClose={() => setJump(false)}>
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              const value = new FormData(event.currentTarget).get("date");
              const parsed = dateSchema.safeParse(value);
              if (!parsed.success) return;
              onJump(parsed.data);
              router.push(calendarHref(parsed.data, view), { scroll: false });
              setJump(false);
            }}
          >
            <div className="field">
              <label htmlFor={dateId}>Date</label>
              <input
                id={dateId}
                type="date"
                name="date"
                defaultValue={date}
                min="0001-01-01"
                max="9999-12-31"
                required
              />
            </div>
            <button className="button primary" type="submit">
              Go to date
            </button>
          </form>
        </Dialog>
      )}
    </>
  );
}
