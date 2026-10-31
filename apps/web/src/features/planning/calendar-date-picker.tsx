import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays } from "@168hours/domain-utils";
import { formatDate } from "@/lib/format";
import { shiftPeriod } from "./calendar-dates";
import type { CalendarView } from "./calendar-layout";

export function CalendarDatePicker({
  date,
  weekStart,
  today,
  view,
  anchor,
  onSelect,
  onClose,
  portalContainer,
}: {
  date: string;
  weekStart: string;
  today: string;
  view: CalendarView;
  anchor: RefObject<HTMLButtonElement | null>;
  onSelect: (date: string) => void;
  onClose: () => void;
  portalContainer?: HTMLElement | null;
}) {
  const [month, setMonth] = useState(date.slice(0, 7) + "-01");
  const [position, setPosition] = useState({ top: 0, left: 0, width: 280 });
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    function positionPanel() {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const center = rect.left + rect.width / 2;
      const width = Math.min(320, window.innerWidth - 16);
      const height = panel.current?.offsetHeight ?? 320;
      setPosition({
        left: Math.max(
          8,
          Math.min(center - width / 2, window.innerWidth - width - 8),
        ),
        top: Math.max(
          8,
          Math.min(rect.bottom + 8, window.innerHeight - height - 8),
        ),
        width,
      });
    }
    positionPanel();
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    return () => {
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
    };
  }, [anchor, month]);
  useEffect(() => {
    const selected = panel.current?.querySelector<HTMLButtonElement>(
      '[aria-pressed="true"]',
    );
    selected?.focus({ preventScroll: true });
    if (view === "month") selected?.scrollIntoView({ block: "nearest" });
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !panel.current?.contains(event.target) &&
        !anchor.current?.contains(event.target)
      )
        onClose();
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
      anchor.current?.focus();
    }
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape, true);
    };
  }, [anchor, onClose, view]);
  const weekDay = (value: string) => new Date(value + "T12:00:00Z").getUTCDay();
  const firstWeekday = weekDay(weekStart);
  const first = addDays(month, -((weekDay(month) - firstWeekday + 7) % 7));
  const nextMonth = shiftPeriod(month, "month", 1);
  const days = Array.from(
    {
      length:
        Math.ceil(
          (Number(addDays(nextMonth, -1).slice(8)) +
            ((weekDay(month) - firstWeekday + 7) % 7)) /
            7,
        ) * 7,
    },
    (_, i) => addDays(first, i),
  );
  const weeks = Array.from({ length: days.length / 7 }, (_, i) =>
    days.slice(i * 7, i * 7 + 7),
  );
  const year = month.slice(0, 4);
  function select(value: string) {
    onSelect(value);
    anchor.current?.focus();
  }
  return createPortal(
    <div
      ref={panel}
      role="dialog"
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget) &&
          !anchor.current?.contains(event.relatedTarget)
        )
          onClose();
      }}
      aria-modal="false"
      aria-label={
        view === "month"
          ? "Choose month"
          : view === "week"
            ? "Choose week"
            : "Choose day"
      }
      className="calendar-date-picker"
      style={position}
    >
      <div className="calendar-picker-header">
        <button
          className="icon-button"
          aria-label={
            view === "month" ? "Previous year" : "Previous picker month"
          }
          disabled={view === "month" ? year === "0001" : month === "0001-01-01"}
          onClick={() =>
            setMonth(
              view === "month"
                ? String(Number(year) - 1).padStart(4, "0") + "-01-01"
                : shiftPeriod(month, "month", -1),
            )
          }
        >
          <ChevronLeft size={16} />
        </button>
        <strong>
          {view === "month"
            ? year
            : formatDate(month, { month: "long", year: "numeric" })}
        </strong>
        <button
          className="icon-button"
          aria-label={view === "month" ? "Next year" : "Next picker month"}
          disabled={view === "month" ? year === "9999" : month === "9999-12-01"}
          onClick={() =>
            setMonth(
              view === "month"
                ? String(Number(year) + 1).padStart(4, "0") + "-01-01"
                : shiftPeriod(month, "month", 1),
            )
          }
        >
          <ChevronRight size={16} />
        </button>
      </div>
      {view === "month" ? (
        <div className="calendar-picker-months">
          {Array.from({ length: 12 }, (_, i) => {
            const value = year + "-" + String(i + 1).padStart(2, "0") + "-01";
            return (
              <button
                key={value}
                aria-pressed={value.slice(0, 7) === date.slice(0, 7)}
                onClick={() => select(value)}
              >
                {formatDate(value, { month: "long" })}
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="calendar-picker-weekdays" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i}>
                {formatDate(addDays(first, i), { weekday: "narrow" })}
              </span>
            ))}
          </div>
          <div
            className={
              "calendar-picker-days" + (view === "week" ? " picks-week" : "")
            }
          >
            {view === "week"
              ? weeks.map((week) => (
                  <button
                    key={week[0]}
                    className="calendar-picker-week"
                    aria-label={
                      "Week of " +
                      formatDate(week[0]!, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    }
                    aria-pressed={week[0] === weekStart}
                    onClick={() => select(week[0]!)}
                  >
                    {week.map((value) => (
                      <span
                        key={value}
                        className={
                          "calendar-picker-week-day" +
                          (value.slice(0, 7) !== month.slice(0, 7)
                            ? " outside-month"
                            : "")
                        }
                        aria-current={value === today ? "date" : undefined}
                      >
                        {Number(value.slice(8))}
                      </span>
                    ))}
                  </button>
                ))
              : days.map((value) => (
                  <button
                    key={value}
                    aria-label={formatDate(value, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                    aria-current={value === today ? "date" : undefined}
                    aria-pressed={value === date}
                    className={
                      value.slice(0, 7) !== month.slice(0, 7)
                        ? "outside-month"
                        : undefined
                    }
                    onClick={() => select(value)}
                  >
                    {Number(value.slice(8))}
                  </button>
                ))}
          </div>
        </>
      )}
    </div>,
    portalContainer ?? document.body,
  );
}
