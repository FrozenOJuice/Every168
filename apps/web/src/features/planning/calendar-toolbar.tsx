import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, type RefObject } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Ellipsis,
} from "lucide-react";
import { CalendarDatePicker } from "./calendar-date-picker";
import { formatDate } from "@/lib/format";
import { calendarHref, type CalendarView } from "./calendar-layout";
import { shiftPeriod } from "./calendar-dates";

export function CalendarToolbar({
  date,
  viewTargetDate,
  weekStart,
  today,
  view,
  onAdd,
  onToday,
  onJump,
  onTools,
  onSearch,
  searchAnchor,
  searchOpen,
  filtered,
}: {
  date: string;
  viewTargetDate: string;
  weekStart: string;
  today: string;
  view: CalendarView;
  onAdd: () => void;
  onToday: () => void;
  onJump: (date: string) => void;
  onTools: () => void;
  onSearch: () => void;
  searchAnchor: RefObject<HTMLButtonElement | null>;
  searchOpen: boolean;
  filtered: boolean;
}) {
  const [jump, setJump] = useState(false);
  const dateButton = useRef<HTMLButtonElement>(null);
  const closeJump = useCallback(() => setJump(false), []);
  const router = useRouter();
  const title = formatDate(date, {
    month: "long",
    ...(view === "day" ? { day: "numeric" as const } : {}),
    year: "numeric",
  });
  return (
    <>
      <header
        className={
          "calendar-toolbar" + (view === "day" ? " is-day-toolbar" : "")
        }
      >
        <h1 className="sr-only">Calendar</h1>
        <div className="calendar-view-tools">
          <div className="calendar-toolbar-actions">
            <button
              className="button primary calendar-add-block"
              onClick={onAdd}
            >
              <Plus size={17} aria-hidden="true" />
              <span className="calendar-add-label">Add</span>
            </button>
            <button
              ref={searchAnchor}
              className="icon-button"
              aria-label="Search and filter calendar"
              aria-pressed={filtered}
              aria-haspopup="dialog"
              aria-expanded={searchOpen}
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
          </div>
        </div>
        <nav
          className="segmented calendar-view-switcher"
          aria-label="Calendar view"
        >
          {(["day", "week", "month"] as const).map((item) => (
            <Link
              key={item}
              href={calendarHref(viewTargetDate, item)}
              scroll={false}
              aria-current={view === item ? "true" : undefined}
            >
              {item[0]!.toUpperCase() + item.slice(1)}
            </Link>
          ))}
        </nav>
        <div className="calendar-period">
          <Link
            className="button calendar-today"
            href={calendarHref(today, view)}
            scroll={false}
            onClick={onToday}
          >
            Today
          </Link>
          <div className="calendar-date-controls">
            <Link
              className="icon-button"
              aria-label={"Previous " + view}
              href={calendarHref(shiftPeriod(date, view, -1), view)}
              scroll={false}
            >
              <ChevronLeft size={19} />
            </Link>
            <h2>
              <button
                ref={dateButton}
                className="calendar-date-title"
                aria-label={"Jump to date, " + title}
                aria-haspopup="dialog"
                aria-expanded={jump}
                onClick={() => setJump(!jump)}
              >
                <span className="calendar-date-month">{title}</span>
              </button>
            </h2>
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
      </header>
      {jump && (
        <CalendarDatePicker
          date={date}
          weekStart={weekStart}
          today={today}
          view={view}
          anchor={dateButton}
          onClose={closeJump}
          onSelect={(value) => {
            onJump(value);
            router.push(calendarHref(value, view), { scroll: false });
            setJump(false);
          }}
        />
      )}
    </>
  );
}
