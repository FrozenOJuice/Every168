"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { uncertainWrite } from "@168hours/api-client";
import type { Block, BlockInput } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { formatTime } from "@/lib/format";
import { invalidateCalendar } from "./invalidate-calendar";
import { HOUR_HEIGHT } from "./calendar-layout";
import {
  dragTimes,
  dragSelection,
  type DragMode,
  type CalendarPoint,
} from "./calendar-drag";
type Gesture = {
  pointer: number;
  x: number;
  y: number;
  origin: CalendarPoint;
  mode: DragMode;
  block?: Block;
};
type Preview = { point: CalendarPoint; x: number; y: number; label: string };
type Interactions = {
  start: (
    event: ReactPointerEvent,
    mode: DragMode,
    block?: Block,
    date?: string,
  ) => void;
  adjust: (id: string) => void;
  selectedId: string | null;
  selectedMode: Exclude<DragMode, "create">;
  setMode: (mode: Exclude<DragMode, "create">) => void;
  finish: () => void;
  draggingId?: string;
  preview: Preview | null;
  busy: boolean;
  status: string;
  command: ReturnType<
    typeof useCommand<Block, { block: Block; input: BlockInput }>
  >;
};
const Context = createContext<Interactions | null>(null);
export const useCalendarInteractions = () => useContext(Context);
function pointAt(x: number, y: number): CalendarPoint | null {
  const top = document.elementFromPoint(x, y);
  const elements = top ? [top] : [];
  for (const element of elements) {
    const day = element.closest<HTMLElement>("[data-drag-day]");
    if (day) {
      const minute = Math.max(
        0,
        Math.min(
          1440,
          Math.round(
            (((y - day.getBoundingClientRect().top) / HOUR_HEIGHT) * 60) / 15,
          ) * 15,
        ),
      );
      return { date: day.dataset.dragDay!, minute };
    }
    const month = element.closest<HTMLElement>("[data-drop-date]");
    if (month) return { date: month.dataset.dropDate! };
  }
  return null;
}
export function CalendarInteractions({
  timezone,
  onCreate,
  children,
}: {
  timezone: string;
  onCreate: (date: string, minute: number, duration: number) => void;
  children: ReactNode;
}) {
  const [gesture, setGesture] = useState<Gesture | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [mode, setMode] = useState<Exclude<DragMode, "create">>("move"),
    [status, setStatus] = useState("");
  const suppress = useRef(false),
    cache = useQueryClient();
  const command = useCommand({
    mutationFn: (
      { block, input }: { block: Block; input: BlockInput },
      key: string,
    ) => api.updateTimeBlock(block.id, input, block.version, key),
    onSuccess: async () => {
      await invalidateCalendar(cache);
      setPreview(null);
      setStatus("Plan updated.");
    },
    onError: (error) => {
      if (!uncertainWrite(error)) {
        setPreview(null);
        setStatus("");
      }
    },
  });
  // The active gesture owns native listeners and its animation frame; a rerender does not replace them.
  const callbacks = useRef({ onCreate, mutate: command.mutate });
  useEffect(() => {
    callbacks.current = { onCreate, mutate: command.mutate };
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
      target = pointAt(x, y);
      if (!moved) return;
      let label = "Drop outside the calendar to cancel";
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
        if (times)
          label = `${formatTime(times.startsAt, timezone)} – ${formatTime(times.endsAt, timezone)} · ${target.date}`;
        else if (selection)
          label = `New ${selection.durationMinutes}-minute plan · ${selection.date}`;
        else label = "This time cannot be used. Drop outside to cancel.";
      }
      setPreview({ point: target ?? gesture!.origin, x, y, label });
    }
    function move(event: PointerEvent) {
      if (finished || event.pointerId !== gesture!.pointer) return;
      x = event.clientX;
      y = event.clientY;
      moved ||= Math.hypot(x - gesture!.x, y - gesture!.y) > 6;
      if (moved) {
        suppress.current = true;
        event.preventDefault();
        evaluate();
      }
    }
    function cancel() {
      finished = true;
      setGesture(null);
      setPreview(null);
      if (moved) suppress.current = true;
    }
    function end(event: PointerEvent) {
      if (finished || event.pointerId !== gesture!.pointer) return;
      finished = true;
      x = event.clientX;
      y = event.clientY;
      target = pointAt(x, y);
      setGesture(null);
      setPreview(null);
      if (!moved || !target) return;
      suppress.current = true;
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
  }, [gesture, timezone]);
  const value: Interactions = {
    start(event, requested, block, date) {
      if (command.isPending || event.button !== 0 || event.isPrimary === false)
        return;
      const touch = event.pointerType !== "mouse";
      if (touch && (!block || block.id !== selectedId)) return;
      const origin =
        pointAt(event.clientX, event.clientY) ?? (date ? { date } : null);
      if (!origin) return;
      suppress.current = false;
      // Keep feedback mounted until release so the grid cannot shift under the pointer.
      event.stopPropagation();
      if (touch) event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setGesture({
        pointer: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        origin,
        mode:
          block?.id === selectedId && requested === "move" ? mode : requested,
        block,
      });
    },
    adjust(id) {
      setSelectedId(id);
      setMode("move");
      setStatus("");
    },
    selectedId,
    selectedMode: mode,
    setMode,
    finish() {
      setSelectedId(null);
      setStatus("");
    },
    draggingId: gesture?.block?.id,
    preview,
    busy: command.isPending,
    status,
    command,
  };
  return (
    <Context.Provider value={value}>
      <div
        className="calendar-interactions"
        onClickCapture={(event) => {
          if (
            suppress.current &&
            event.detail > 0 &&
            event.target instanceof Element &&
            event.target.closest(
              ".calendar-record, .hour-slot, .calendar-resize-handle",
            )
          ) {
            suppress.current = false;
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {children}
      </div>
      {preview && (
        <div
          className="calendar-drag-label"
          role="status"
          style={{
            left: Math.min(preview.x + 12, window.innerWidth - 250),
            top: Math.max(8, preview.y - 64),
          }}
        >
          {preview.label}
          <small>15-minute steps · Escape cancels</small>
        </div>
      )}
    </Context.Provider>
  );
}
export function CalendarInteractionStatus() {
  const interaction = useCalendarInteractions();
  if (!interaction) return null;
  return (
    <>
      {interaction.selectedId && (
        <div className="calendar-adjust-controls">
          <span>Drag the selected block</span>
          <div role="group" aria-label="Adjust block">
            {(["move", "start", "end"] as const).map((mode) => (
              <button
                className="button"
                key={mode}
                aria-pressed={interaction.selectedMode === mode}
                disabled={interaction.busy}
                onClick={() => interaction.setMode(mode)}
              >
                {mode === "move"
                  ? "Move"
                  : mode === "start"
                    ? "Resize start"
                    : "Resize end"}
              </button>
            ))}
            <button
              className="button"
              disabled={interaction.busy}
              onClick={interaction.finish}
            >
              Done
            </button>
          </div>
        </div>
      )}
      {interaction.status && (
        <p className="calendar-status" role="status">
          {interaction.command.needsRetry
            ? "The adjustment could not be confirmed. Retry the same change."
            : interaction.status}
        </p>
      )}
      <CommandError command={interaction.command} />
    </>
  );
}
