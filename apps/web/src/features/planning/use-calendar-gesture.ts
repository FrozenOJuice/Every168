import {
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
  type RefObject,
} from "react";
import type {
  Block,
  BlockInput,
  CalendarItem,
  CalendarItemInput,
  SelectionMoveInput,
} from "@168hours/contracts";
import { daysBetween, plannedInstant } from "@168hours/domain-utils";
import { formatTime } from "@/lib/format";
import {
  dragDates,
  motionDelta,
  movePlans,
  motionPreviews,
  type MovingPlan,
} from "./calendar-plan-motion";
import {
  dragTimes,
  dragSelection,
  type DragMode,
  type CalendarPoint,
} from "./calendar-drag";
import type { PlanSelection } from "./calendar-selection";
import type { Gesture, Preview } from "./calendar-interaction-types";
export function pointAt(
  x: number,
  y: number,
  mode: DragMode,
  hourHeight: number,
): CalendarPoint | null {
  const top = document.elementFromPoint(x, y);
  const elements = top ? [top] : [];
  for (const element of elements) {
    const day = element.closest<HTMLElement>("[data-drag-day]");
    if (day) {
      const step = 5;
      const snap = mode === "create" ? Math.floor : Math.round;
      const minute = Math.max(
        0,
        Math.min(
          1440,
          snap(
            (((y - day.getBoundingClientRect().top) / hourHeight) * 60) / step,
          ) * step,
        ),
      );
      return { date: day.dataset.dragDay!, minute };
    }
    const month = element.closest<HTMLElement>("[data-drop-date]");
    if (month) return { date: month.dataset.dropDate! };
    const allDay = element.closest<HTMLElement>(
      "[data-context-all-day], [data-date]",
    );
    if (allDay)
      return { date: allDay.dataset.contextAllDay ?? allDay.dataset.date! };
  }
  return null;
}

export function useCalendarGesture({
  gesture,
  timezone,
  hourHeight,
  setGesture,
  setPreview,
  suppressRef,
  setStatus,
  onCreate,
  selectForDrag,
  mutate,
  item,
  group,
}: {
  gesture: Gesture | null;
  timezone: string;
  hourHeight: number;
  setGesture: Dispatch<SetStateAction<Gesture | null>>;
  setPreview: Dispatch<SetStateAction<Preview | null>>;
  suppressRef: RefObject<boolean>;
  setStatus: Dispatch<SetStateAction<string>>;
  onCreate: (date: string, minute: number, duration: number) => void;
  selectForDrag: (plan: PlanSelection, preserveGroup: boolean) => void;
  mutate: (value: { block: Block; input: BlockInput }) => void;
  item: (value: { item: CalendarItem; input: CalendarItemInput }) => void;
  group: (input: SelectionMoveInput) => void;
}) {
  const callbacks = useRef({
    onCreate,
    selectForDrag,
    mutate,
    item,
    group,
  });
  useEffect(() => {
    callbacks.current = {
      onCreate,
      selectForDrag,
      mutate,
      item,
      group,
    };
  });
  useEffect(() => {
    if (!gesture) return;
    let x = gesture.x,
      y = gesture.y,
      moved = false,
      finished = false,
      frame = 0;
    let target: CalendarPoint | null = null;
    function evaluate() {
      target = pointAt(x, y, gesture!.mode, hourHeight);
      if (!moved) return;
      let label = "Drop outside the calendar to cancel";
      let selected: Preview["selection"] = null;
      let bounds: Preview["bounds"] = null;
      let resize: Preview["resize"] = null;
      let dateResize: CalendarItem | undefined;
      let moving: MovingPlan[] | undefined;
      if (target) {
        const times =
          gesture!.block && gesture!.mode !== "create"
            ? dragTimes(
                gesture!.block,
                gesture!.mode,
                gesture!.origin,
                target,
                timezone,
              )
            : null;
        const selection =
          gesture!.mode === "create"
            ? dragSelection(gesture!.origin, target, timezone)
            : null;
        if (gesture!.item) {
          const dates = dragDates(
            gesture!.item,
            gesture!.mode as Exclude<DragMode, "create">,
            gesture!.origin,
            target,
          );
          if (dates) {
            const item = { ...gesture!.item, ...dates };
            label = `All day\n${dates.date} - ${dates.endDate}`;
            if (gesture!.mode === "move") {
              const delta = daysBetween(gesture!.origin.date, target.date);
              const plans = movePlans(
                gesture!.plans?.blocks ?? [],
                gesture!.plans?.items ?? [gesture!.item],
                delta,
                0,
                timezone,
              );
              if (plans) moving = motionPreviews(plans, timezone, hourHeight);
              else label = "This move contains a missing clock time.";
            } else dateResize = item;
          } else label = "All-day plans need a span of 1 to 31 days.";
        }
        if (times) {
          if (gesture!.mode === "start" || gesture!.mode === "end")
            resize = { id: gesture!.block!.id, ...times };
          label = `${formatTime(times.startsAt, timezone)} - ${formatTime(times.endsAt, timezone)}\n${target.date}`;
          if (gesture!.mode === "move") {
            if (gesture!.plans) {
              const delta = motionDelta(gesture!.block!, times, timezone);
              const plans = movePlans(
                gesture!.plans.blocks,
                gesture!.plans.items,
                delta.dayDelta,
                delta.minuteDelta,
                timezone,
              );
              if (plans) moving = motionPreviews(plans, timezone, hourHeight);
              else label = "This move contains a missing clock time.";
            }
            const day = document.querySelector<HTMLElement>(
              `[data-drag-day="${target.date}"]`,
            );
            const month = document.querySelector<HTMLElement>(
              `[data-drop-date="${target.date}"]`,
            );
            if (day) {
              const rect = day.getBoundingClientRect();
              const midnight = plannedInstant(target.date, 0, timezone)!;
              const start = Math.max(
                0,
                (Date.parse(times.startsAt) - Date.parse(midnight)) / 60000,
              );
              const end = Math.min(
                1440,
                (Date.parse(times.endsAt) - Date.parse(midnight)) / 60000,
              );
              bounds = {
                left: rect.left + 2,
                top: rect.top + (start / 60) * hourHeight,
                width:
                  rect.width -
                  4 -
                  (day.classList.contains("has-moments") ? 44 : 0),
                height: Math.max(1, ((end - start) / 60) * hourHeight),
              };
            } else if (month) {
              const rect = month.getBoundingClientRect();
              const heading = month
                .querySelector(".month-day-heading")
                ?.getBoundingClientRect();
              bounds = {
                left: rect.left + 4,
                top: heading ? heading.bottom + 4 : rect.top + 4,
                width: rect.width - 8,
                height: gesture!.bounds.height,
              };
            }
          }
        } else if (selection) {
          const startsAt = plannedInstant(
            selection.date,
            selection.minute,
            timezone,
          )!;
          const endsAt = new Date(
            Date.parse(startsAt) + selection.durationMinutes * 60000,
          ).toISOString();
          selected = { startsAt, endsAt };
          label = `${formatTime(startsAt, timezone)} - ${formatTime(endsAt, timezone)}\n${selection.date}`;
        } else if (!gesture!.item)
          label = "This time cannot be used. Drop outside to cancel.";
      }
      setPreview({
        point: target ?? gesture!.origin,
        x,
        y,
        label,
        selection: selected,
        bounds,
        resize,
        dateResize,
        moving,
      });
    }
    function move(event: PointerEvent) {
      if (finished || event.pointerId !== gesture!.pointer) return;
      x = event.clientX;
      y = event.clientY;
      // One five-minute step remains draggable at every zoom level.
      moved ||=
        Math.hypot(x - gesture!.x, y - gesture!.y) >
        Math.min(3, (hourHeight / 12) * 0.75);
      if (moved) {
        if (gesture!.block) {
          const id = gesture!.block.id;
          callbacks.current.selectForDrag(
            { kind: "block", id },
            !!gesture!.plans,
          );
        }
        if (gesture!.item && !gesture!.plans)
          callbacks.current.selectForDrag(
            { kind: "item", id: gesture!.item.id },
            false,
          );
        suppressRef.current = true;
        event.preventDefault();
        evaluate();
      }
    }
    function cancel() {
      finished = true;
      setGesture(null);
      setPreview(null);
      if (moved) suppressRef.current = true;
    }
    function end(event: PointerEvent) {
      if (finished || event.pointerId !== gesture!.pointer) return;
      finished = true;
      x = event.clientX;
      y = event.clientY;
      target = pointAt(x, y, gesture!.mode, hourHeight);
      setGesture(null);
      setPreview(null);
      if (!moved || !target) return;
      suppressRef.current = true;
      if (gesture!.mode === "create") {
        const draft = dragSelection(gesture!.origin, target, timezone);
        if (draft)
          callbacks.current.onCreate(
            draft.date,
            draft.minute,
            draft.durationMinutes,
          );
        return;
      }
      if (gesture!.item) {
        const dates = dragDates(
          gesture!.item,
          gesture!.mode as Exclude<DragMode, "create">,
          gesture!.origin,
          target,
        );
        if (!dates) {
          setStatus("All-day plans need a span of 1 to 31 days.");
          return;
        }
        if (
          dates.date === gesture!.item.date &&
          dates.endDate === gesture!.item.endDate
        )
          return;
        if (gesture!.plans && gesture!.mode === "move") {
          callbacks.current.group(
            groupInput(
              gesture!.plans,
              daysBetween(gesture!.origin.date, target.date),
              0,
              timezone,
            ),
          );
        } else {
          const item = gesture!.item;
          callbacks.current.item({
            item,
            input: {
              title: item.title,
              notes: item.notes,
              categoryId: item.categoryId,
              goalId: item.goalId,
              kind: item.kind,
              ...dates,
            },
          });
        }
        return;
      }
      const block = gesture!.block!;
      const times = dragTimes(
        block,
        gesture!.mode,
        gesture!.origin,
        target,
        timezone,
      );
      if (!times) {
        setStatus(
          "That adjustment is not valid. Use the block editor to choose the time.",
        );
        return;
      }
      if (
        Date.parse(times.startsAt) === Date.parse(block.startsAt) &&
        Date.parse(times.endsAt) === Date.parse(block.endsAt)
      )
        return;
      setStatus("Saving adjustment…");
      if (gesture!.plans && gesture!.mode === "move") {
        const delta = motionDelta(block, times, timezone);
        callbacks.current.group(
          groupInput(
            gesture!.plans,
            delta.dayDelta,
            delta.minuteDelta,
            timezone,
          ),
        );
        return;
      }
      callbacks.current.mutate({
        block,
        input: {
          title: block.title,
          categoryId: block.categoryId,
          goalId: block.goalId,
          notes: block.notes,
          ...times,
        },
      });
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    }
    function tick() {
      if (moved) {
        const scroll = document
          .elementsFromPoint(x, y)
          .map((e) =>
            e.closest<HTMLElement>(".calendar-scroll, .calendar-month"),
          )
          .find(Boolean);
        if (scroll) {
          const box = scroll.getBoundingClientRect(),
            dy = y < box.top + 50 ? -12 : y > box.bottom - 40 ? 12 : 0,
            dx = x < box.left + 35 ? -12 : x > box.right - 35 ? 12 : 0;
          if (dx || dy) {
            scroll.scrollBy(dx, dy);
            evaluate();
          }
        }
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key);
    window.addEventListener("blur", cancel);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", cancel);
    };
  }, [
    gesture,
    timezone,
    hourHeight,
    setGesture,
    setPreview,
    setStatus,
    suppressRef,
  ]);
}
function groupInput(
  plans: { blocks: Block[]; items: CalendarItem[] },
  dayDelta: number,
  minuteDelta: number,
  timezone: string,
): SelectionMoveInput {
  return {
    timezone,
    dayDelta,
    minuteDelta,
    plans: [
      ...plans.blocks.map(({ id, version }) => ({
        kind: "block" as const,
        id,
        version,
      })),
      ...plans.items.map(({ id, version }) => ({
        kind: "item" as const,
        id,
        version,
      })),
    ],
  };
}
