"use client";

import {
  createContext,
  useContext,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Block, CalendarItem } from "@168hours/contracts";
import { instantToLocalInput, localDate } from "@168hours/domain-utils";
import {
  ContextMenu,
  type ContextMenuAction,
} from "@/components/ui/context-menu";
import { useCalendarClipboard } from "./calendar-clipboard";
import {
  useCalendarInteractions,
  type PlanSelection,
} from "./calendar-interactions";
import type { CalendarDisplayRecord } from "./calendar-filters";
import { calendarHref, slotMinute, type CalendarView } from "./calendar-layout";
import { useCalendarNavigation } from "./calendar-navigation";
import { CalendarMoveGroup } from "./calendar-move-group";

type Target =
  | {
      kind: "plans";
      plans: PlanSelection[];
      date: string;
      pasteDate: string;
      pasteMinute?: number;
    }
  | { kind: "day"; date: string; days: string[] }
  | { kind: "time"; date: string; minute: number }
  | { kind: "all-day"; date: string }
  | { kind: "axis" };
type OpenMenu = {
  target: Target;
  anchor: HTMLElement;
  x: number;
  y: number;
  mac: boolean;
};
const nativeTargets =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="dialog"], [role="menu"], .calendar-plan-popover';

const ActionsContext = createContext<{
  openActions: (anchor: HTMLButtonElement) => void;
  label: string;
  expanded: boolean;
  disabled: boolean;
} | null>(null);

export function CalendarActionButtons() {
  const actions = useContext(ActionsContext);
  const interaction = useCalendarInteractions();
  if (!actions || !interaction) return null;
  return (
    <div className="calendar-selection-actions">
      <span className="calendar-selection-summary" aria-live="polite">
        {interaction.multiSelect
          ? "Tap plans or days to add or remove them."
          : actions.label}
      </span>
      <button
        type="button"
        className="button"
        aria-pressed={interaction.multiSelect}
        disabled={actions.disabled}
        onClick={() => interaction.setMultiSelect(!interaction.multiSelect)}
      >
        {interaction.multiSelect ? "Done selecting" : "Select multiple"}
      </button>
      <button
        type="button"
        className="button"
        aria-haspopup="menu"
        disabled={actions.disabled}
        aria-expanded={actions.expanded}
        onClick={(event) => actions.openActions(event.currentTarget)}
      >
        Actions
      </button>
    </div>
  );
}

export function CalendarContextMenus({
  children,
  date,
  blocks,
  items,
  timezone,
  selectedDays,
  view,
  scope,
  unavailable,
  onSelectDay: onSelectDayWithMode,
  onAdd,
  onOpen,
  onResetZoom,
  overlayContainer,
}: {
  children: ReactNode;
  date: string;
  blocks: Block[];
  items: CalendarItem[];
  timezone: string;
  selectedDays: string[];
  view: CalendarView;
  scope: string;
  unavailable: boolean;
  onSelectDay: (date: string, mode?: "replace" | "toggle" | "extend") => void;
  onAdd: (date: string, minute?: number, allDay?: boolean) => void;
  onOpen: (record: CalendarDisplayRecord, date: string) => void;
  onResetZoom: () => void;
  overlayContainer?: Element | null;
}) {
  const interaction = useCalendarInteractions()!;
  const clipboard = useCalendarClipboard()!;
  const router = useRouter();
  const [menu, setMenu] = useState<(OpenMenu & { scope: string }) | null>(null);
  const [movePlans, setMovePlans] = useState<PlanSelection[] | null>(null);
  if (menu && menu.scope !== scope) setMenu(null);
  const close = useCallback(() => setMenu(null), []);
  const blocked =
    unavailable || clipboard.busy || !interaction.quickActionsAvailable;

  const surface = useRef<HTMLDivElement>(null);
  const navigation = useCalendarNavigation({
    surface,
    date,
    view,
    blocked,
    onSelectDayWithMode,
  });

  function openActions(trigger: HTMLButtonElement) {
    const root = overlayContainer ?? surface.current;
    if (!root || blocked) return;
    let target: HTMLElement | null = null;
    const plan = interaction.selectedPlans[0];
    if (plan)
      target = root.querySelector(`[data-calendar-record="${plan.id}"]`);
    else if (interaction.timeSelection?.minute !== undefined) {
      const point = interaction.timeSelection;
      target = root.querySelector(
        `.hour-slot[data-context-date="${point.date}"][data-context-hour="${Math.floor(point.minute! / 60)}"]`,
      );
    } else {
      const day = selectedDays[0] ?? date;
      target = root.querySelector(
        `.grid-day-heading[data-date="${day}"] > button, .month-day[data-date="${day}"] .month-select-day`,
      );
    }
    if (target) open(target, undefined, undefined, trigger);
  }

  function open(
    element: Element,
    x?: number,
    y?: number,
    trigger?: HTMLElement,
  ) {
    if (blocked || element.closest(nativeTargets)) return false;
    let target: Target | null = null;
    let anchor =
      element.closest<HTMLElement>("button, [tabindex]") ??
      (element as HTMLElement);
    const record =
      element.closest<HTMLElement>("[data-calendar-record]") ??
      element
        .closest(".calendar-date-plan")
        ?.querySelector<HTMLElement>("[data-calendar-record]");
    const heading = element.closest<HTMLElement>(
      ".grid-day-heading[data-date], .month-day[data-date]",
    );
    const slot = element.closest<HTMLElement>(".hour-slot-wrap");
    const allDay = element.closest<HTMLElement>("[data-context-all-day]");
    if (record) {
      const block = blocks.find(
        (block) => block.id === record.dataset.calendarRecord,
      );
      const item = items.find(
        (item) =>
          item.id === record.dataset.calendarRecord && item.kind === "all_day",
      );
      if (!block && !item) return false;
      const plan: PlanSelection = {
        kind: block ? "block" : "item",
        id: (block ?? item)!.id,
      };
      const selected = interaction.isSelected(plan.kind, plan.id);
      if (!selected) {
        if (plan.kind === "block") interaction.select(plan.id);
        else interaction.selectItem(plan.id);
      }
      anchor = record;
      const date = block ? localDate(block.startsAt, timezone) : item!.date!;
      const column = record.closest<HTMLElement>(".grid-day[data-drag-day]");
      const pasteDate =
        heading?.dataset.date ??
        allDay?.dataset.contextAllDay ??
        column?.dataset.dragDay ??
        date;
      let pasteMinute: number | undefined;
      if (block && column) {
        if (y === undefined) {
          const time = instantToLocalInput(block.startsAt, timezone).slice(11);
          pasteMinute =
            pasteDate === date
              ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
              : 0;
        } else {
          for (const slot of column.querySelectorAll<HTMLElement>(
            ".hour-slot",
          )) {
            const bounds = slot.getBoundingClientRect();
            if (y >= bounds.top && y < bounds.bottom) {
              pasteMinute = slotMinute(
                Number(slot.dataset.contextHour),
                y - bounds.top,
                bounds.height,
              );
              break;
            }
          }
        }
      }
      target = {
        kind: "plans",
        plans: selected ? interaction.selectedPlans : [plan],
        date,
        pasteDate,
        pasteMinute,
      };
    } else if (element.closest('.hour-axis[role="slider"]')) {
      anchor = element.closest<HTMLElement>(".hour-axis")!;
      target = { kind: "axis" };
    } else if (allDay) {
      anchor = allDay;
      target = { kind: "all-day", date: allDay.dataset.contextAllDay! };
    } else if (slot) {
      const button = slot.querySelector<HTMLButtonElement>(".hour-slot")!;
      anchor = button;
      const date = button.dataset.contextDate!;
      const hour = Number(button.dataset.contextHour);
      const selected = interaction.timeSelection;
      const minute =
        y === undefined
          ? selected?.date === date &&
            selected.minute !== undefined &&
            Math.floor(selected.minute / 60) === hour
            ? selected.minute
            : hour * 60
          : slotMinute(
              hour,
              y - button.getBoundingClientRect().top,
              button.getBoundingClientRect().height,
            );
      target = { kind: "time", date, minute };
    } else if (heading) {
      const date = heading.dataset.date!;
      anchor = heading.querySelector<HTMLButtonElement>(
        ".month-select-day, button",
      )!;
      const selected = selectedDays.includes(date);
      if (!selected) {
        interaction.selectTime({ date });
        onSelectDayWithMode(date);
      }
      target = { kind: "day", date, days: selected ? selectedDays : [date] };
    }
    if (!target) return false;
    if (trigger) anchor = trigger;
    const bounds = anchor.getBoundingClientRect();
    setMenu({
      target,
      anchor,
      x: x ?? bounds.left + Math.min(24, bounds.width / 2),
      y: y ?? bounds.bottom,
      mac: /Mac|iPhone|iPad/.test(navigator.platform),
      scope,
    });
    return true;
  }
  const actions: ContextMenuAction[] = [];
  if (menu) {
    const target = menu.target;
    const mod = menu.mac ? "⌘" : "Ctrl+";
    const paste = (label: string, date: string, minute?: number) =>
      actions.push({
        label,
        shortcut: `${mod}V`,
        disabled: !clipboard.canPaste(),
        run: () => clipboard.pasteAt(date, minute),
      });
    if (target.kind === "plans") {
      if (target.plans.length === 1) {
        actions.push({
          label: "Edit",
          shortcut: "Enter",
          run: () => {
            const plan = target.plans[0]!;
            if (plan.kind === "block") {
              const block = blocks.find((block) => block.id === plan.id);
              if (block) onOpen({ kind: "block", item: block }, target.date);
            } else {
              const item = items.find((item) => item.id === plan.id);
              if (item) onOpen({ kind: "item", item }, target.date);
            }
          },
        });
        actions.push({
          label: "Duplicate",
          run: () => clipboard.duplicate(target.plans),
        });
      }
      actions.push({
        label: "Copy",
        shortcut: `${mod}C`,
        run: () => clipboard.copyPlans(target.plans),
      });
      if (target.plans.length > 1)
        actions.push({ label: "Move…", run: () => setMovePlans(target.plans) });
      if (target.plans.length > 1)
        actions.push({
          label: "Duplicate",
          run: () => clipboard.duplicate(target.plans),
        });
      paste("Paste here", target.pasteDate, target.pasteMinute);
      actions.push({
        label: "Delete",
        shortcut: menu.mac ? "⌫" : "Delete",
        destructive: true,
        run: () => interaction.deletePlans(target.plans),
      });
    } else if (target.kind === "time") {
      actions.push({
        label: "Add plan here",
        run: () => onAdd(target.date, target.minute),
      });
      paste("Paste here", target.date, target.minute);
    } else if (target.kind === "all-day") {
      actions.push({
        label: "Add all-day plan",
        run: () => onAdd(target.date, undefined, true),
      });
      paste("Paste", target.date);
    } else if (target.kind === "day") {
      if (target.days.length === 1) {
        if (view !== "day")
          actions.push({
            label: "Open Day",
            run: () =>
              router.push(calendarHref(target.date, "day"), { scroll: false }),
          });
        actions.push({ label: "Add plan", run: () => onAdd(target.date) });
      }
      const hasPlans =
        blocks.some((block) =>
          target.days.includes(localDate(block.startsAt, timezone)),
        ) ||
        items.some(
          (item) =>
            item.kind === "all_day" &&
            !!item.date &&
            target.days.includes(item.date),
        );
      actions.push({
        label: target.days.length > 1 ? "Copy selected days" : "Copy day",
        shortcut: `${mod}C`,
        disabled: !hasPlans,
        run: () => clipboard.copyDays(target.days),
      });
      paste(target.days.length > 1 ? "Paste" : "Paste into day", target.date);
    } else
      actions.push({ label: "Reset zoom", shortcut: "R", run: onResetZoom });
    actions.push(
      { separator: true },
      {
        label: "Undo",
        shortcut: `${mod}Z`,
        disabled: !interaction.history.actions.length,
        run: () => interaction.history.undo(),
      },
      {
        label: "Redo",
        shortcut: menu.mac ? "⌘⇧Z" : "Ctrl+Shift+Z",
        disabled: !interaction.history.redoActions.length,
        run: () => interaction.history.redo(),
      },
    );
  }
  return (
    <ActionsContext.Provider
      value={{
        openActions,
        disabled: blocked,
        expanded: !!menu,
        label: interaction.selectedPlanCount
          ? `${interaction.selectedPlanCount} ${interaction.selectedPlanCount === 1 ? "plan" : "plans"} selected`
          : selectedDays.length
            ? `${selectedDays.length} ${selectedDays.length === 1 ? "day" : "days"} selected`
            : interaction.timeSelection?.minute !== undefined
              ? "Time selected"
              : "",
      }}
    >
      <div
        ref={surface}
        className="calendar-context-surface"
        onFocusCapture={navigation.onFocus}
        onContextMenu={(event) => {
          if (event.defaultPrevented || !(event.target instanceof Element))
            return;
          if (
            open(
              event.target,
              event.clientX || undefined,
              event.clientY || undefined,
            )
          ) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onKeyDownCapture={(event) => {
          if (navigation.onKeyDown(event)) return;
          if (
            event.key !== "ContextMenu" &&
            !(event.key === "F10" && event.shiftKey)
          )
            return;
          if (
            event.repeat ||
            event.nativeEvent.isComposing ||
            !(event.target instanceof Element)
          )
            return;
          if (open(event.target)) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {children}
        {overlayContainer &&
          createPortal(<CalendarActionButtons />, overlayContainer)}
        {movePlans && (
          <CalendarMoveGroup
            container={overlayContainer}
            plans={movePlans}
            blocks={blocks}
            items={items}
            timezone={timezone}
            onClose={() => setMovePlans(null)}
          />
        )}
        {menu && menu.scope === scope && !blocked && (
          <ContextMenu
            x={menu.x}
            y={menu.y}
            anchor={menu.anchor}
            actions={actions}
            onClose={close}
          />
        )}
      </div>
    </ActionsContext.Provider>
  );
}
