"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Block, CalendarItem } from "@168hours/contracts";
import { instantToLocalInput, localDate } from "@168hours/domain-utils";
import { ContextMenu } from "@/components/ui/context-menu";
import { useCalendarClipboard } from "./calendar-clipboard";
import {
  useCalendarInteractions,
  type PlanSelection,
} from "./calendar-interactions";
import type { CalendarDisplayRecord } from "./calendar-filters";
import { calendarHref, slotMinute, type CalendarView } from "./calendar-layout";
import { useCalendarNavigation } from "./calendar-navigation";
import { calendarMenuActions } from "./calendar-menu-actions";
import { CalendarMoveGroup } from "./calendar-move-group";

import {
  planActionTarget,
  dayActionTarget,
  selectionActionTarget,
  type CalendarActionTarget,
} from "./calendar-action-target";
type OpenMenu = {
  target: CalendarActionTarget;
  anchor: HTMLElement;
  x: number;
  y: number;
  mac: boolean;
  fromToolbar: boolean;
};
const nativeTargets =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="dialog"], [role="menu"], .calendar-plan-popover';

import {
  ActionsContext,
  CalendarActionButtons,
} from "./calendar-action-controls";
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
  onTemplates,
  onQuick,
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
  onTemplates?: () => void;
  onQuick?: () => void;
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

  const targetData = { blocks, items, timezone };
  function showMenu(
    target: CalendarActionTarget,
    anchor: HTMLElement,
    x?: number,
    y?: number,
    fromToolbar = false,
  ) {
    if (blocked) return false;
    const bounds = anchor.getBoundingClientRect();
    setMenu({
      target,
      fromToolbar,
      anchor,
      x: x ?? bounds.left + Math.min(24, bounds.width / 2),
      y: y ?? bounds.bottom,
      mac: /Mac|iPhone|iPad/.test(navigator.platform),
      scope,
    });
    return true;
  }
  function openActions(trigger: HTMLButtonElement) {
    const target = selectionActionTarget(
      interaction.selection,
      date,
      view,
      targetData,
    );
    if (target) showMenu(target, trigger, undefined, undefined, true);
  }

  function open(element: Element, x?: number, y?: number) {
    if (blocked || element.closest(nativeTargets)) return false;
    let target: CalendarActionTarget | null = null;
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
      interaction.contextPlan(plan);
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
      target = planActionTarget(plan, interaction.selection, targetData, {
        date: pasteDate,
        minute: pasteMinute,
      });
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
      interaction.contextDay(date);
      target = dayActionTarget(date, interaction.selection);
    }
    if (!target) return false;
    return showMenu(target, anchor, x, y);
  }
  const actions = menu
    ? calendarMenuActions({
        ...menu,
        view,
        blocks,
        items,
        timezone,
        interaction,
        clipboard,
        onTemplates,
        onQuick,
        onAdd,
        onOpen,
        onMove: setMovePlans,
        onResetZoom,
        onOpenDay: (date) =>
          router.push(calendarHref(date, "day"), { scroll: false }),
      })
    : [];
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
