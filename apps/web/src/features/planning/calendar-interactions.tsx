"use client";
import {
  CalendarOccurrenceScope,
  type OccurrenceRequest,
} from "./calendar-repeating";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type {
  Block,
  BlockInput,
  BlockDeletion,
  CalendarItem,
  CalendarItemInput,
  SelectionMoveInput,
  GroupDeleteInput,
} from "@168hours/contracts";
import { useCommand } from "@/lib/use-command";
import { useCalendarHistory } from "./use-calendar-history";
import type { DragMode } from "./calendar-drag";
import { useCalendarGesture, pointAt } from "./use-calendar-gesture";
import { useCalendarInteractionCommands } from "./use-calendar-interaction-commands";
import { CalendarDragPreview } from "./calendar-drag-preview";
export type {
  PlanSelection,
  CalendarTimeSelection,
} from "./calendar-selection";
import {
  type PlanSelection,
  type CalendarTimeSelection,
  type SelectionModifiers,
} from "./calendar-selection";
import type { CalendarSelectionController } from "./use-calendar-selection";
import type {
  Gesture,
  Preview,
  CalendarNotice,
} from "./calendar-interaction-types";
type Interactions = {
  selection: CalendarSelectionController["selection"];
  daySelectionMode: CalendarSelectionController["dayMode"];
  contextPlan: (plan: PlanSelection) => void;
  contextDay: (date: string) => void;
  multiSelect: boolean;
  setMultiSelect: (enabled: boolean) => void;
  timeSelection: CalendarTimeSelection | null;
  selectTime: (point: CalendarTimeSelection) => void;
  start: (
    event: ReactPointerEvent,
    mode: DragMode,
    block?: Block,
    date?: string,
  ) => void;
  startItem: (
    event: ReactPointerEvent,
    mode: Exclude<DragMode, "create">,
    item: CalendarItem,
    date: string,
  ) => void;
  isDragging: (kind: PlanSelection["kind"], id: string) => boolean;
  adjust: (id: string) => void;
  select: (id: string, modifiers?: SelectionModifiers) => void;
  selectItem: (id: string, modifiers?: SelectionModifiers) => void;
  isSelected: (kind: PlanSelection["kind"], id: string) => boolean;
  selectedPlans: PlanSelection[];
  selectedPlanCount: number;
  adjusting: boolean;
  selectedId: string | null;
  selectedItemId: string | null;
  selectedMode: Exclude<DragMode, "create">;
  setMode: (mode: Exclude<DragMode, "create">) => void;
  finish: () => void;
  draggingId?: string;
  preview: Preview | null;
  busy: boolean;
  setClipboardBusy: (busy: boolean) => void;
  quickActionsAvailable: boolean;
  status: string;
  notice: CalendarNotice | null;
  showNotice: (
    message: string,
    options?: {
      undoKey?: string;
      action?: CalendarNotice["action"];
      kind?: CalendarNotice["kind"];
    },
  ) => void;
  dismissNotice: () => void;
  remove: ReturnType<
    typeof useCommand<BlockDeletion & { title: string; key: string }, Block>
  >;
  groupDelete: ReturnType<
    typeof useCommand<
      { ok: true; undoId: string; key: string; count: number },
      GroupDeleteInput
    >
  >;
  groupMove: ReturnType<typeof useCommand<unknown, SelectionMoveInput>>;
  itemAdjust: ReturnType<
    typeof useCommand<unknown, { item: CalendarItem; input: CalendarItemInput }>
  >;
  history: ReturnType<typeof useCalendarHistory>;
  deleteBlock: (block: Block) => void;
  deleteItem: (item: CalendarItem) => void;
  deletePlans: (plans: PlanSelection[]) => void;
  command: ReturnType<
    typeof useCommand<Block, { block: Block; input: BlockInput }>
  >;
};
const Context = createContext<Interactions | null>(null);
export const useCalendarInteractions = () => useContext(Context);
export function CalendarInteractions({
  scope,
  timezone,
  hourHeight,
  blocks,
  items,
  editorOpen,
  overlayContainer,
  onCreate,
  selection,
  children,
}: {
  scope: string;
  selection: CalendarSelectionController;
  timezone: string;
  hourHeight: number;
  blocks: Block[];
  items: CalendarItem[];
  editorOpen: boolean;
  overlayContainer?: Element | null;
  onCreate: (date: string, minute: number, duration: number) => void;
  children: ReactNode;
}) {
  const [gesture, setGesture] = useState<Gesture | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [adjusting, setAdjusting] = useState(false),
    [mode, setMode] = useState<Exclude<DragMode, "create">>("move"),
    [status, setStatus] = useState(""),
    [notice, setNotice] = useState<CalendarNotice | null>(null);
  const { selectedPlans, timeSelection, multiSelect, setMultiSelect } =
    selection;
  const noticeId = useRef(0);
  const [occurrenceRequest, setOccurrenceRequest] =
    useState<OccurrenceRequest | null>(null);
  const [clipboardBusy, setClipboardBusy] = useState(false);
  function showNotice(
    message: string,
    options?: {
      undoKey?: string;
      action?: CalendarNotice["action"];
      kind?: CalendarNotice["kind"];
    },
  ) {
    setNotice({
      id: ++noticeId.current,
      message,
      undoKey: options?.undoKey,
      action: options?.action,
      kind: options?.kind ?? "hint",
    });
  }
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(
      () =>
        setNotice((current) => (current?.id === notice.id ? null : current)),
      notice.undoKey || notice.action
        ? 5000
        : notice.kind === "hint" || notice.kind === "error"
          ? 4000
          : 2400,
    );
    return () => window.clearTimeout(timer);
  }, [notice]);
  const [selectionScope, setSelectionScope] = useState(scope);
  // Reset before children render without remounting commands or history.
  if (selectionScope !== scope) {
    setSelectionScope(scope);
    setAdjusting(false);
    setMode("move");
  }
  const selectedId =
    selectedPlans.length === 1 && selectedPlans[0]?.kind === "block"
      ? selectedPlans[0].id
      : null;
  const selectedItemId =
    selectedPlans.length === 1 && selectedPlans[0]?.kind === "item"
      ? selectedPlans[0].id
      : null;
  const clearSelectedPlans = selection.clearPlans;
  function selectPlan(plan: PlanSelection, modifiers?: SelectionModifiers) {
    if (busy) return;
    selection.selectPlan(plan, modifiers);
    setMode("move");
    setAdjusting(false);
  }
  const history = useCalendarHistory((block, action, direction) => {
    if (block)
      selection.selectPlan({ kind: "block", id: block.id }, undefined, true);
    else selection.clearPlans();
    setStatus(
      direction === "redo"
        ? "Calendar change redone."
        : action.kind === "group-delete"
          ? "Plans restored."
          : action.kind === "conversion"
            ? "Plan mode change undone."
            : action.kind === "series"
              ? "Repeating plan change undone."
              : action.kind === "item-edit"
                ? "Plan edit undone."
                : action.kind === "activity-create"
                  ? "Activity logging undone."
                  : action.kind === "delete"
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
  const suppress = useRef(false);
  const { groupMove, itemAdjust, command, remove, groupDelete } =
    useCalendarInteractionCommands({
      history,
      setPreview,
      setStatus,
      clearSelectedPlans,
      setAdjusting,
      showNotice,
    });
  const busy =
    !!occurrenceRequest ||
    clipboardBusy ||
    command.isPending ||
    remove.isPending ||
    groupDelete.isPending ||
    groupMove.isPending ||
    itemAdjust.isPending ||
    history.command.isPending;
  function deleteBlock(block: Block) {
    if (busy) return;
    if (block.seriesId) {
      setOccurrenceRequest({
        plan: block,
        kind: "block",
        operation: "delete",
        onThis: () => remove.mutate(block),
      });
      return;
    }
    setStatus("Deleting plan…");
    remove.mutate(block);
  }
  function deleteItem(item: CalendarItem) {
    if (busy || item.kind !== "all_day") return;
    if (item.seriesId) {
      setOccurrenceRequest({
        plan: item,
        kind: "item",
        operation: "delete",
        onThis: () =>
          groupDelete.mutate({
            plans: [{ kind: "item", id: item.id, version: item.version }],
          }),
      });
      return;
    }
    setStatus("Deleting plan…");
    groupDelete.mutate({
      plans: [{ kind: "item", id: item.id, version: item.version }],
    });
  }
  function deletePlans(plans: PlanSelection[]) {
    if (busy || editorOpen || gesture || !plans.length) return;
    if (plans.length === 1) {
      const plan = plans[0]!;
      if (plan.kind === "block") {
        const block = blocks.find((block) => block.id === plan.id);
        if (block) deleteBlock(block);
      } else {
        const item = items.find((item) => item.id === plan.id);
        if (item) deleteItem(item);
      }
      return;
    }
    const records = plans.map((plan) => {
      const record =
        plan.kind === "block"
          ? blocks.find((block) => block.id === plan.id)
          : items.find(
              (item) => item.id === plan.id && item.kind === "all_day",
            );
      return record ? { ...plan, version: record.version } : null;
    });
    if (records.some((record) => record === null)) {
      clearSelectedPlans();
      setStatus("Selection changed. Select the plans again.");
    } else groupDelete.mutate({ plans: records as GroupDeleteInput["plans"] });
  }
  useEffect(() => {
    function undo(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const redo =
        (key === "z" && event.shiftKey) ||
        (key === "y" && event.ctrlKey && !event.metaKey && !event.shiftKey);
      if (
        !(redo ? history.redoActions.length : history.actions.length) ||
        editorOpen ||
        gesture ||
        busy ||
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.altKey ||
        (event.shiftKey && !redo) ||
        !(event.metaKey || event.ctrlKey) ||
        (key !== "z" && !redo) ||
        (event.target instanceof Element &&
          event.target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="dialog"]',
          ))
      )
        return;
      event.preventDefault();
      if (redo) history.redo();
      else history.undo();
    }
    window.addEventListener("keydown", undo);
    return () => window.removeEventListener("keydown", undo);
  }, [history, editorOpen, gesture, busy]);
  function submitAdjustment(value: { block: Block; input: BlockInput }) {
    if (value.block.seriesId)
      setOccurrenceRequest({
        plan: value.block,
        kind: "block",
        operation: "edit",
        input: value.input,
        onThis: () => command.mutate(value),
      });
    else command.mutate(value);
  }
  function submitItemAdjustment(value: {
    item: CalendarItem;
    input: CalendarItemInput;
  }) {
    if (value.item.seriesId)
      setOccurrenceRequest({
        plan: value.item,
        kind: "item",
        operation: "edit",
        itemInput: value.input,
        onThis: () => itemAdjust.mutate(value),
      });
    else itemAdjust.mutate(value);
  }
  // The active gesture owns native listeners and its animation frame; a rerender does not replace them.
  useCalendarGesture({
    gesture,
    timezone,
    hourHeight,
    setGesture,
    setPreview,
    suppressRef: suppress,
    setStatus,
    onCreate,
    selectForDrag: selection.selectForDrag,
    mutate: submitAdjustment,
    item: submitItemAdjustment,
    group: groupMove.mutate,
  });
  function selectedGroup(kind: PlanSelection["kind"], id: string) {
    if (
      selectedPlans.length < 2 ||
      !selectedPlans.some((p) => p.kind === kind && p.id === id)
    )
      return undefined;
    const group = {
      blocks: blocks.filter((b) =>
        selectedPlans.some((p) => p.kind === "block" && p.id === b.id),
      ),
      items: items.filter(
        (b) =>
          b.kind === "all_day" &&
          selectedPlans.some((p) => p.kind === "item" && p.id === b.id),
      ),
    };
    if (
      group.blocks.length + group.items.length !== selectedPlans.length ||
      selectedPlans.length > 100
    ) {
      showNotice("Select up to 100 available plans to move together.");
      return null;
    }
    return group;
  }
  const value: Interactions = {
    selection: selection.selection,
    daySelectionMode: selection.dayMode,
    contextPlan(plan) {
      if (!busy && !editorOpen) selection.contextPlan(plan);
    },
    contextDay(date) {
      if (!busy && !editorOpen) selection.contextDay(date);
    },
    multiSelect,
    setMultiSelect,
    timeSelection,
    selectTime(point) {
      if (busy || editorOpen) return;
      selection.selectTime(point);
      setAdjusting(false);
    },
    start(event, requested, block, date) {
      if (
        multiSelect ||
        busy ||
        event.button !== 0 ||
        event.isPrimary === false
      )
        return;
      const touch = event.pointerType !== "mouse";
      if (
        touch &&
        (!block ||
          !selectedPlans.some((p) => p.kind === "block" && p.id === block.id))
      )
        return;
      if (block && (event.metaKey || event.ctrlKey || event.shiftKey)) return;
      const group =
        block && requested === "move"
          ? selectedGroup("block", block.id)
          : undefined;
      if (group === null) return;
      const origin =
        pointAt(event.clientX, event.clientY, requested, hourHeight) ??
        (date ? { date } : null);
      if (!origin) return;
      if (block) {
        selection.preparePlans();
      }
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
        plans: group,
        bounds: {
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
        },
      });
    },
    startItem(event, requested, item, date) {
      if (
        busy ||
        editorOpen ||
        multiSelect ||
        item.kind !== "all_day" ||
        event.button !== 0 ||
        event.isPrimary === false ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey
      )
        return;
      const selected = selectedPlans.some(
        (p) => p.kind === "item" && p.id === item.id,
      );
      if (event.pointerType !== "mouse" && !selected) return;
      selection.preparePlans();
      const group =
        requested === "move" ? selectedGroup("item", item.id) : undefined;
      if (group === null) return;
      event.stopPropagation();
      if (event.pointerType !== "mouse") event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      suppress.current = false;
      const rect = event.currentTarget.getBoundingClientRect();
      setGesture({
        pointer: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        origin: { date },
        mode: requested,
        item,
        plans: group,
        bounds: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
      });
    },
    isDragging: (kind, id) =>
      !!preview &&
      gesture?.mode === "move" &&
      (gesture.plans
        ? (kind === "block" ? gesture.plans.blocks : gesture.plans.items).some(
            (p) => p.id === id,
          )
        : (kind === "block" ? gesture.block?.id : gesture.item?.id) === id),
    select(id, modifiers) {
      selectPlan({ kind: "block", id }, modifiers);
    },
    selectItem(id, modifiers) {
      selectPlan({ kind: "item", id }, modifiers);
    },
    isSelected: (kind, id) =>
      selectedPlans.some((plan) => plan.kind === kind && plan.id === id),
    selectedPlans,
    selectedPlanCount: selectedPlans.length,
    adjust(id) {
      selection.preparePlans();
      selection.selectPlan({ kind: "block", id }, undefined, true);
      setAdjusting(true);
      setMode("move");
      setStatus("");
    },
    selectedId,
    selectedItemId,
    adjusting,
    selectedMode: mode,
    setMode,
    finish() {
      selection.clear();
      setAdjusting(false);
      setStatus("");
    },
    draggingId:
      preview && gesture?.mode === "move" ? gesture.block?.id : undefined,
    preview,
    busy,
    setClipboardBusy,
    quickActionsAvailable: !gesture && !editorOpen && !busy,
    remove,
    groupDelete,
    groupMove,
    itemAdjust,
    history,
    deleteBlock,
    deleteItem,
    deletePlans,
    status,
    notice,
    showNotice,
    dismissNotice: () => setNotice(null),
    command: { ...command, mutate: submitAdjustment },
  };
  return (
    <Context.Provider value={value}>
      <div
        className="calendar-interactions"
        aria-busy={busy}
        onPointerDownCapture={(event) => {
          if (
            event.button !== 0 ||
            (event.target instanceof Element &&
              event.target.closest('[role="menu"]'))
          )
            return;
          if (
            !busy &&
            event.target instanceof Element &&
            !event.target.closest(
              ".hour-slot, .month-select-day, .calendar-add-block, .calendar-plan-popover, .calendar-view-switcher, .calendar-selection-actions",
            )
          )
            selection.clearTime();
          if (
            !busy &&
            event.target instanceof Element &&
            !event.target.closest(
              ".calendar-record, .calendar-resize-handle, .calendar-date-resize, .calendar-adjust-controls, .calendar-plan-popover, .calendar-selection-actions",
            )
          ) {
            clearSelectedPlans();
            setAdjusting(false);
          }
        }}
        onKeyDown={(event) => {
          if (
            (event.key === "Delete" || event.key === "Backspace") &&
            selectedPlans.length > 0 &&
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
            event.preventDefault();
            event.stopPropagation();
            deletePlans(selectedPlans);
            return;
          }
          if (event.key === "Escape" && !gesture && !busy) {
            selection.clear();
            setAdjusting(false);
          }
        }}
        onClickCapture={(event) => {
          if (
            suppress.current &&
            event.detail > 0 &&
            event.target instanceof Element &&
            event.target.closest(
              ".calendar-record, .hour-slot, .calendar-resize-handle, .calendar-date-resize",
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
      {occurrenceRequest && (
        <CalendarOccurrenceScope
          container={overlayContainer}
          request={occurrenceRequest}
          onClose={() => setOccurrenceRequest(null)}
        />
      )}
      <CalendarDragPreview preview={preview} gesture={gesture} />
    </Context.Provider>
  );
}
