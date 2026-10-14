import {
  useLayoutEffect,
  useRef,
  type RefObject,
  type KeyboardEvent,
  type FocusEvent,
} from "react";
import { useRouter } from "next/navigation";
import { addDays } from "@168hours/domain-utils";
import { useCalendarInteractions } from "./calendar-interactions";
import { calendarHref, type CalendarView } from "./calendar-layout";

export function useCalendarNavigation({
  surface,
  date,
  view,
  blocked,
  onSelectDayWithMode,
}: {
  surface: RefObject<HTMLDivElement | null>;
  date: string;
  view: CalendarView;
  blocked: boolean;
  onSelectDayWithMode: (
    date: string,
    mode?: "replace" | "toggle" | "extend",
  ) => void;
}) {
  const interaction = useCalendarInteractions()!;
  const router = useRouter();
  const focusedDay = useRef<string | null>(null);
  const focusedTime = useRef<{ date: string; minute: number } | null>(null);
  const pendingFocus = useRef<{ date: string; minute?: number } | null>(null);
  // Native buttons keep their semantics; each calendar region has one Tab entry.
  // Focus is independent of selection so selecting a day cannot strand the grid.
  useLayoutEffect(() => {
    const root = surface.current;
    if (!root) return;
    const headings = Array.from(
      root.querySelectorAll<HTMLButtonElement>(
        ".grid-day-heading > button, .month-select-day",
      ),
    );
    const pending = pendingFocus.current;
    const targetDay = pending?.date ?? focusedDay.current ?? date;
    const entry =
      headings.find(
        (button) =>
          button.closest<HTMLElement>("[data-date]")?.dataset.date ===
          targetDay,
      ) ??
      headings.find(
        (button) =>
          button.closest<HTMLElement>("[data-date]")?.dataset.date === date,
      ) ??
      headings[0];
    for (const button of headings) button.tabIndex = button === entry ? 0 : -1;
    const slots = Array.from(
      root.querySelectorAll<HTMLButtonElement>(".hour-slot"),
    );
    const point = pending?.minute !== undefined ? pending : focusedTime.current;
    const slotEntry =
      (point
        ? slots.find(
            (button) =>
              button.dataset.contextDate === point.date &&
              Number(button.dataset.contextHour) ===
                Math.floor(point.minute! / 60),
          )
        : undefined) ??
      slots.find((button) => button.getAttribute("aria-pressed") === "true") ??
      slots.find((button) => button.tabIndex === 0) ??
      slots[0];
    for (const button of slots) button.tabIndex = button === slotEntry ? 0 : -1;
    if (pending && !blocked) {
      const target =
        pending.minute === undefined
          ? headings.find(
              (button) =>
                button.closest<HTMLElement>("[data-date]")?.dataset.date ===
                pending.date,
            )
          : slotEntry?.dataset.contextDate === pending.date
            ? slotEntry
            : undefined;
      if (target) {
        pendingFocus.current = null;
        target.focus();
        if (pending.minute !== undefined)
          interaction.selectTime({
            date: pending.date,
            minute: pending.minute,
          });
      }
    }
  });

  return {
    onFocus(event: FocusEvent<HTMLDivElement>) {
      const target = event.target as HTMLElement;
      const heading = target.closest<HTMLElement>(
        ".grid-day-heading[data-date], .month-day[data-date]",
      );
      if (target.matches(".month-select-day, .grid-day-heading > button")) {
        focusedDay.current = heading?.dataset.date ?? null;
        for (const button of surface.current?.querySelectorAll<HTMLButtonElement>(
          ".month-select-day, .grid-day-heading > button",
        ) ?? [])
          button.tabIndex = button === target ? 0 : -1;
      }
      if (target.matches(".hour-slot")) {
        for (const button of surface.current?.querySelectorAll<HTMLButtonElement>(
          ".hour-slot",
        ) ?? [])
          button.tabIndex = button === target ? 0 : -1;
        focusedTime.current = {
          date: target.dataset.contextDate!,
          minute: Number(target.dataset.contextHour) * 60,
        };
      }
    },
    onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
      if (event.defaultPrevented || event.nativeEvent.isComposing) return false;
      const element = event.target;
      if (
        element instanceof HTMLElement &&
        !element.closest(
          'input, textarea, select, [contenteditable], [role="textbox"], [role="dialog"], [role="menu"], .calendar-plan-popover',
        ) &&
        !blocked
      ) {
        const heading = element.matches(
          ".grid-day-heading > button, .month-select-day",
        );
        const slot = element.matches(".hour-slot");
        if (heading || slot) {
          const day = slot
            ? element.dataset.contextDate!
            : element.closest<HTMLElement>("[data-date]")!.dataset.date!;
          if (heading && event.key === " ") {
            event.preventDefault();
            if (!event.repeat) {
              interaction.selectTime({ date: day });
              onSelectDayWithMode(
                day,
                event.shiftKey
                  ? "extend"
                  : interaction.multiSelect || event.metaKey || event.ctrlKey
                    ? "toggle"
                    : "replace",
              );
            }
            return true;
          }
          const delta = {
            ArrowLeft: -1,
            ArrowRight: 1,
            ArrowUp: view === "month" ? -7 : -1,
            ArrowDown: view === "month" ? 7 : 1,
          }[event.key];
          if (
            delta !== undefined &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.altKey
          ) {
            event.preventDefault();
            let targetDate = day;
            let minute: number | undefined;
            if (slot) {
              const selected = interaction.timeSelection;
              minute =
                selected?.date === day &&
                selected.minute !== undefined &&
                Math.floor(selected.minute / 60) ===
                  Number(element.dataset.contextHour)
                  ? selected.minute
                  : Number(element.dataset.contextHour) * 60;
              if (event.key === "ArrowLeft" || event.key === "ArrowRight")
                targetDate = addDays(day, delta);
              else {
                minute += delta * 5;
                if (minute < 0) {
                  targetDate = addDays(day, -1);
                  minute += 1440;
                }
                if (minute >= 1440) {
                  targetDate = addDays(day, 1);
                  minute -= 1440;
                }
              }
              focusedTime.current = { date: targetDate, minute };
            } else {
              targetDate = addDays(day, delta);
              focusedDay.current = targetDate;
            }
            const selector = slot
              ? `.hour-slot[data-context-date="${targetDate}"][data-context-hour="${Math.floor(minute! / 60)}"]`
              : `.grid-day-heading[data-date="${targetDate}"] > button, .month-day[data-date="${targetDate}"] .month-select-day`;
            const target =
              surface.current?.querySelector<HTMLButtonElement>(selector);
            if (target) {
              element.tabIndex = -1;
              target.tabIndex = 0;
              target.focus();
              if (slot) interaction.selectTime({ date: targetDate, minute });
              else if (event.shiftKey) {
                interaction.selectTime({ date: targetDate });
                onSelectDayWithMode(targetDate, "extend");
              }
            } else {
              pendingFocus.current = { date: targetDate, minute };
              router.push(calendarHref(targetDate, view), {
                scroll: false,
              });
            }
            return true;
          }
        }
      }

      return false;
    },
  };
}
