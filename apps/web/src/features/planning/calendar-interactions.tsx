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
import type { Block, BlockInput, BlockDeletion } from "@168hours/contracts";
import { plannedInstant } from "@168hours/domain-utils";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { formatTime } from "@/lib/format";
import { invalidateCalendar } from "./invalidate-calendar";
import { useCalendarHistory } from "./use-calendar-history";
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
  bounds: { left: number; top: number; width: number; height: number };
};
type Preview = {
  point: CalendarPoint;
  x: number;
  y: number;
  label: string;
  selection: { startsAt: string; endsAt: string } | null;
  bounds: Gesture["bounds"] | null;
  resize: { id: string; startsAt: string; endsAt: string } | null;
};
export type CalendarTimeSelection = { date: string; minute?: number };
type Interactions = {
  timeSelection: CalendarTimeSelection | null;
  selectTime: (point: CalendarTimeSelection) => void;
  start: (
    event: ReactPointerEvent,
    mode: DragMode,
    block?: Block,
    date?: string,
  ) => void;
  adjust: (id: string) => void;
  select: (id: string) => void;
  adjusting: boolean;
  selectedId: string | null;
  selectedMode: Exclude<DragMode, "create">;
  setMode: (mode: Exclude<DragMode, "create">) => void;
  finish: () => void;
  draggingId?: string;
  preview: Preview | null;
  busy: boolean;
  quickActionsAvailable: boolean;
  status: string;
  remove: ReturnType<
    typeof useCommand<BlockDeletion & { title: string }, Block>
  >;
  history: ReturnType<typeof useCalendarHistory>;
  deleteBlock: (block: Block) => void;
  command: ReturnType<
    typeof useCommand<Block, { block: Block; input: BlockInput }>
  >;
};
const Context = createContext<Interactions | null>(null);
export const useCalendarInteractions = () => useContext(Context);
function pointAt(
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
  }
  return null;
}
export function CalendarInteractions({
  timezone,
  hourHeight,
  blocks,
  editorOpen,
  onCreate,
  timeSelection,
  onSelectTime,
  onClearTimeSelection,
  children,
}: {
  timeSelection: CalendarTimeSelection | null;
  onSelectTime: (point: CalendarTimeSelection) => void;
  onClearTimeSelection: () => void;
  timezone: string;
  hourHeight: number;
  blocks: Block[];
  editorOpen: boolean;
  onCreate: (date: string, minute: number, duration: number) => void;
  children: ReactNode;
}) {
  const [gesture, setGesture] = useState<Gesture | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [adjusting, setAdjusting] = useState(false),
    [mode, setMode] = useState<Exclude<DragMode, "create">>("move"),
    [status, setStatus] = useState("");
  const history = useCalendarHistory((block, action) => {
    setSelectedId(block?.id ?? null);
    setStatus(
      action.kind === "delete"
        ? "Plan restored."
        : action.kind === "edit"
          ? "Plan edit undone."
          : "Plan creation undone.",
    );
    if (block)
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLButtonElement>(
            `button[data-calendar-record="${block.id}"]`,
          )
          ?.focus({ preventScroll: true }),
      );
  });
  const suppress = useRef(false),
    cache = useQueryClient();
  const command = useCommand({
    mutationFn: (
      { block, input }: { block: Block; input: BlockInput },
      key: string,
    ) => {
      return api
        .updateTimeBlock(block.id, input, block.version, key)
        .then((result) => {
          history.record({
            key,
            kind: "edit",
            blockId: block.id,
            title: result.title,
            version: result.version,
            previousVersion: block.version,
            undoId: result.undoId,
          });
          return result;
        });
    },
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
  const remove = useCommand<BlockDeletion & { title: string }, Block>({
    mutationFn: async (block, key) => {
      const result = await api.deleteTimeBlock(block.id, block.version, key);
      history.record({
        key,
        kind: "delete",
        blockId: block.id,
        title: block.title,
        previousVersion: block.version,
        undoId: result.undoId,
      });
      return { ...result, title: block.title };
    },
    onSuccess: async () => {
      await invalidateCalendar(cache);
      setSelectedId(null);
      setAdjusting(false);
      setStatus("Plan deleted.");
    },
    onError: (error) => {
      if (!uncertainWrite(error)) setStatus("");
    },
  });
  const busy =
    command.isPending || remove.isPending || history.command.isPending;
  function deleteBlock(block: Block) {
    if (busy) return;
    setStatus("Deleting plan…");
    remove.mutate(block);
  }
  useEffect(() => {
    function undo(event: KeyboardEvent) {
      if (
        !history.actions.length ||
        editorOpen ||
        gesture ||
        busy ||
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.altKey ||
        event.shiftKey ||
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "z" ||
        (event.target instanceof Element &&
          event.target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="dialog"]',
          ))
      )
        return;
      event.preventDefault();
      history.undo();
    }
    window.addEventListener("keydown", undo);
    return () => window.removeEventListener("keydown", undo);
  }, [history, editorOpen, gesture, busy]);
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
      target = pointAt(x, y, gesture!.mode, hourHeight);
      if (!moved) return;
      let label = "Drop outside the calendar to cancel";
      let selected: Preview["selection"] = null;
      let bounds: Preview["bounds"] = null;
      let resize: Preview["resize"] = null;
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
        if (times) {
          if (gesture!.mode === "start" || gesture!.mode === "end")
            resize = { id: gesture!.block!.id, ...times };
          label = `${formatTime(times.startsAt, timezone)} - ${formatTime(times.endsAt, timezone)}\n${target.date}`;
          if (gesture!.mode === "move") {
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
        } else label = "This time cannot be used. Drop outside to cancel.";
      }
      setPreview({
        point: target ?? gesture!.origin,
        x,
        y,
        label,
        selection: selected,
        bounds,
        resize,
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
        if (gesture!.block) setSelectedId(gesture!.block.id);
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
      target = pointAt(x, y, gesture!.mode, hourHeight);
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
  }, [gesture, timezone, hourHeight]);
  const value: Interactions = {
    timeSelection,
    selectTime(point) {
      if (busy || editorOpen) return;
      onSelectTime(point);
      setSelectedId(null);
      setAdjusting(false);
    },
    start(event, requested, block, date) {
      if (busy || event.button !== 0 || event.isPrimary === false) return;
      const touch = event.pointerType !== "mouse";
      if (touch && (!block || block.id !== selectedId)) return;
      const origin =
        pointAt(event.clientX, event.clientY, requested, hourHeight) ??
        (date ? { date } : null);
      if (!origin) return;
      suppress.current = false;
      // Keep feedback mounted until release so the grid cannot shift under the pointer.
      event.stopPropagation();
      if (touch) event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const bounds = event.currentTarget.getBoundingClientRect();
      setGesture({
        pointer: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        origin,
        mode:
          block?.id === selectedId && requested === "move" ? mode : requested,
        block,
        bounds: {
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
        },
      });
    },
    select(id) {
      if (busy) return;
      onClearTimeSelection();
      setSelectedId(id);
      setMode("move");
      setAdjusting(false);
    },
    adjust(id) {
      onClearTimeSelection();
      setSelectedId(id);
      setAdjusting(true);
      setMode("move");
      setStatus("");
    },
    selectedId,
    adjusting,
    selectedMode: mode,
    setMode,
    finish() {
      onClearTimeSelection();
      setSelectedId(null);
      setAdjusting(false);
      setStatus("");
    },
    draggingId:
      preview && gesture?.mode === "move" ? gesture.block?.id : undefined,
    preview,
    busy,
    quickActionsAvailable: !gesture && !editorOpen && !busy,
    remove,
    history,
    deleteBlock,
    status,
    command,
  };
  return (
    <Context.Provider value={value}>
      <div
        className="calendar-interactions"
        onPointerDownCapture={(event) => {
          if (
            !busy &&
            event.target instanceof Element &&
            !event.target.closest(
              ".hour-slot, .month-select-day, .calendar-add-block, .calendar-plan-popover, .calendar-view-switcher",
            )
          )
            onClearTimeSelection();
          if (
            !busy &&
            event.target instanceof Element &&
            !event.target.closest(
              ".calendar-record, .calendar-resize-handle, .calendar-adjust-controls, .calendar-plan-popover",
            )
          ) {
            setSelectedId(null);
            setAdjusting(false);
          }
        }}
        onKeyDown={(event) => {
          if (
            (event.key === "Delete" || event.key === "Backspace") &&
            selectedId &&
            !gesture &&
            !busy &&
            !editorOpen &&
            !event.repeat &&
            !event.nativeEvent.isComposing &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey &&
            event.target instanceof Element &&
            !event.target.closest(
              'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="dialog"]',
            )
          ) {
            const block = blocks.find((block) => block.id === selectedId);
            if (block) {
              event.preventDefault();
              event.stopPropagation();
              deleteBlock(block);
            }
            return;
          }
          if (event.key === "Escape" && !gesture && !busy) {
            onClearTimeSelection();
            setSelectedId(null);
            setAdjusting(false);
          }
        }}
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
      {preview?.bounds &&
        gesture?.block &&
        gesture.mode === "move" &&
        createPortal(
          <div
            className="calendar-moving-block"
            aria-hidden="true"
            style={preview.bounds}
          >
            <strong>{gesture.block.title}</strong>
            <span>{preview.label}</span>
            <small className="calendar-drag-hint">Escape to cancel</small>
          </div>,
          document.body,
        )}
      {preview && (
        <span className="sr-only" role="status">
          {preview.label} · Escape to cancel
        </span>
      )}
    </Context.Provider>
  );
}
export function CalendarInteractionStatus() {
  const interaction = useCalendarInteractions();
  if (!interaction) return null;
  return (
    <>
      {interaction.selectedId && interaction.adjusting && (
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
        <p
          className={
            interaction.remove.needsRetry || interaction.command.needsRetry
              ? "calendar-status"
              : "sr-only"
          }
          role="status"
        >
          {interaction.remove.needsRetry
            ? "The deletion could not be confirmed. Retry the same change."
            : interaction.command.needsRetry
              ? "The adjustment could not be confirmed. Retry the same change."
              : interaction.status}
        </p>
      )}
      <CommandError command={interaction.history.command} />
      <CommandError command={interaction.command} />
      <CommandError command={interaction.remove} />
    </>
  );
}
