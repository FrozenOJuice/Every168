import type { Block, CalendarItem } from "@168hours/contracts";
import { localDate } from "@168hours/domain-utils";
import type { ContextMenuAction } from "@/components/ui/context-menu";
import type { useCalendarClipboard } from "./calendar-clipboard";
import type { useCalendarInteractions } from "./calendar-interactions";
import type { PlanSelection } from "./calendar-selection";
import type { CalendarActionTarget } from "./calendar-action-target";
import type { CalendarDisplayRecord } from "./calendar-filters";
import type { CalendarView } from "./calendar-layout";
export function calendarMenuActions({
  target,
  fromToolbar,
  mac,
  view,
  blocks,
  items,
  timezone,
  interaction,
  clipboard,
  onTools,
  onAdd,
  onOpen,
  onMove,
  onResetZoom,
  onOpenDay,
}: {
  target: CalendarActionTarget;
  fromToolbar: boolean;
  mac: boolean;
  view: CalendarView;
  blocks: Block[];
  items: CalendarItem[];
  timezone: string;
  interaction: NonNullable<ReturnType<typeof useCalendarInteractions>>;
  clipboard: NonNullable<ReturnType<typeof useCalendarClipboard>>;
  onTools: () => void;
  onAdd: (date: string, minute?: number, allDay?: boolean) => void;
  onOpen: (record: CalendarDisplayRecord, date: string) => void;
  onMove: (plans: PlanSelection[]) => void;
  onResetZoom: () => void;
  onOpenDay: (date: string) => void;
}): ContextMenuAction[] {
  const actions: ContextMenuAction[] = [];
  if (fromToolbar)
    actions.push(
      {
        label: interaction.multiSelect ? "Done selecting" : "Select multiple",
        run: () => interaction.setMultiSelect(!interaction.multiSelect),
      },
      { separator: true },
    );
  const mod = mac ? "⌘" : "Ctrl+";
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
      actions.push({ label: "Move…", run: () => onMove(target.plans) });
    if (target.plans.length > 1)
      actions.push({
        label: "Duplicate",
        run: () => clipboard.duplicate(target.plans),
      });
    paste("Paste here", target.pasteDate, target.pasteMinute);
    actions.push({
      label: "Delete",
      shortcut: mac ? "⌫" : "Delete",
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
          run: () => onOpenDay(target.date),
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
  } else actions.push({ label: "Reset zoom", shortcut: "R", run: onResetZoom });
  if (fromToolbar)
    actions.push(
      { separator: true },
      { label: "Calendar tools…", run: onTools },
    );
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
      shortcut: mac ? "⌘⇧Z" : "Ctrl+Shift+Z",
      disabled: !interaction.history.redoActions.length,
      run: () => interaction.history.redo(),
    },
  );
  return actions;
}
