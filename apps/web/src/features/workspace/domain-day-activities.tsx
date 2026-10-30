"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Undo2, Redo2 } from "lucide-react";
import type {
  CalendarActivity,
  CalendarActivityResult,
  CalendarItem,
  Week,
} from "@168hours/contracts";
import { localDate } from "@168hours/domain-utils";
import { FormBusyContext } from "@/components/ui/form";
import {
  ContextMenu,
  type ContextMenuAction,
} from "@/components/ui/context-menu";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { CalendarDayFeed } from "@/features/planning/calendar-day-feed";
import { CalendarEditor } from "@/features/planning/calendar-editor";
import { CalendarItemEditor } from "@/features/planning/calendar-item-editor";
import { CalendarSeriesEditor } from "@/features/planning/calendar-series-editor";
import {
  CalendarInteractions,
  useCalendarInteractions,
} from "@/features/planning/calendar-interactions";
import { CalendarInteractionStatus } from "@/features/planning/calendar-interaction-status";
import { useCalendarSelection } from "@/features/planning/use-calendar-selection";
import {
  emptyCalendarFilter,
  type CalendarDisplayRecord,
} from "@/features/planning/calendar-filters";
import {
  HOUR_HEIGHT,
  type TimeEditor,
} from "@/features/planning/calendar-layout";

export function DomainDayActivities(props: {
  date: string;
  scope: string;
  week: Week;
  items: CalendarItem[];
  activity: CalendarActivityResult;
  now: string;
  emptyMessage?: string;
  onDate: (date: string) => void;
  onActivity: (activity: CalendarActivity) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [container, setContainer] = useState<Element | null>(null);
  const attach = useCallback((node: HTMLDivElement | null) => {
    root.current = node;
    setContainer(node?.closest("dialog") ?? node?.closest("main") ?? null);
  }, []);
  const selection = useCalendarSelection(
    props.scope,
    props.week.blocks,
    props.items,
    props.week.timezone,
  );
  const [editor, setEditor] = useState<TimeEditor | null>(null);
  const [item, setItem] = useState<CalendarItem | null>(null);
  const [series, setSeries] = useState<{
    id?: string;
    source?: CalendarItem | Week["blocks"][number];
    occurrenceDate?: string;
  } | null>(null);
  return (
    <CalendarInteractions
      scope={props.scope}
      timezone={props.week.timezone}
      hourHeight={HOUR_HEIGHT}
      blocks={props.week.blocks}
      items={props.items}
      selection={selection}
      editorOpen={!!editor || !!item || !!series}
      overlayContainer={container}
      keyboardRoot={root}
      onCreate={() => {}}
    >
      <div ref={attach} className="domain-day-activity-surface">
        <DayActivityContent
          {...props}
          root={root}
          container={container}
          editor={editor}
          setEditor={setEditor}
          item={item}
          setItem={setItem}
          series={series}
          setSeries={setSeries}
        />
      </div>
    </CalendarInteractions>
  );
}

function DayActivityContent({
  date,
  week,
  items,
  activity,
  now,
  emptyMessage,
  onDate,
  onActivity,
  onBusyChange,
  root,
  container,
  editor,
  setEditor,
  item,
  setItem,
  series,
  setSeries,
}: Parameters<typeof DomainDayActivities>[0] & {
  root: RefObject<HTMLDivElement | null>;
  container: Element | null;
  editor: TimeEditor | null;
  setEditor: (editor: TimeEditor | null) => void;
  item: CalendarItem | null;
  setItem: (item: CalendarItem | null) => void;
  series: {
    id?: string;
    source?: CalendarItem | Week["blocks"][number];
    occurrenceDate?: string;
  } | null;
  setSeries: (
    series: {
      id?: string;
      source?: CalendarItem | Week["blocks"][number];
      occurrenceDate?: string;
    } | null,
  ) => void;
}) {
  const interaction = useCalendarInteractions()!;
  const [formBusy, setFormBusy] = useState(false);
  const busy = interaction.busy || formBusy;
  const visible = !!root.current?.getClientRects().length;
  useUnsavedChanges(
    busy && visible,
    "Wait for the Calendar change to be confirmed.",
    true,
  );
  useLayoutEffect(() => {
    if (!root.current?.getClientRects().length) return;
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange, root]);
  const [menu, setMenu] = useState<{
    anchor: HTMLButtonElement;
    x: number;
    y: number;
  } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const plans = interaction.selectedPlans.flatMap(
    (selection): CalendarDisplayRecord[] => {
      if (selection.kind === "block") {
        const block = week.blocks.find((block) => block.id === selection.id);
        return block ? [{ kind: "block", item: block }] : [];
      }
      const plan = items.find((item) => item.id === selection.id);
      return plan ? [{ kind: "item", item: plan }] : [];
    },
  );
  function open(record: CalendarDisplayRecord, target = date) {
    if (busy) return;
    if (record.kind === "item") {
      if (record.item.kind === "all_day")
        setEditor({ kind: "block", date: target, allDayItem: record.item });
      else setItem(record.item);
    } else setEditor({ ...record, date: target });
  }
  const actions: ContextMenuAction[] = [
    ...(plans.length === 1
      ? [{ label: "Edit plan", run: () => open(plans[0]!) }]
      : []),
    ...(plans.length &&
    plans.every((plan) => plan.kind !== "item" || plan.item.kind === "all_day")
      ? [
          {
            label: plans.length === 1 ? "Delete plan" : "Delete selected plans",
            destructive: true,
            run: () => interaction.deletePlans(interaction.selectedPlans),
          },
          { label: "Clear selection", run: () => interaction.finish() },
          { separator: true as const },
        ]
      : []),
    {
      label: "Undo",
      disabled: !interaction.history.actions.length,
      run: () => interaction.history.undo(),
    },
    {
      label: "Redo",
      disabled: !interaction.history.redoActions.length,
      run: () => interaction.history.redo(),
    },
  ];
  function saved(target?: string) {
    setEditor(null);
    setItem(null);
    setSeries(null);
    interaction.showNotice("Plan saved.", { kind: "change" });
    if (target && target !== date) onDate(target);
  }
  return (
    <>
      {menu && (
        <ContextMenu
          {...menu}
          label="Day plan actions"
          anchorToggles
          actions={actions}
          onClose={closeMenu}
          portalContainer={container ?? undefined}
        />
      )}
      <CalendarDayFeed
        date={date}
        week={week}
        items={items}
        activity={activity}
        filter={emptyCalendarFilter}
        now={now}
        emptyMessage={emptyMessage}
        onOpen={open}
        onOpenActivity={(entry) => {
          if (!busy) onActivity(entry);
        }}
      />
      {(plans.length > 0 ||
        interaction.history.actions.length > 0 ||
        interaction.history.redoActions.length > 0) && (
        <div className="domain-day-selection calendar-selection-actions">
          <span role="status">
            {plans.length > 0 &&
              `${plans.length} ${plans.length === 1 ? "plan" : "plans"} selected`}
          </span>
          {plans.length > 0 ? (
            <button
              type="button"
              className="button"
              aria-label="Day plan actions"
              aria-haspopup="menu"
              aria-expanded={!!menu}
              disabled={busy}
              onClick={(event) => {
                if (menu) {
                  closeMenu();
                  return;
                }
                const anchor = event.currentTarget,
                  bounds = anchor.getBoundingClientRect();
                setMenu({ anchor, x: bounds.left, y: bounds.bottom + 4 });
              }}
            >
              Actions
            </button>
          ) : (
            <div className="domain-day-history">
              {interaction.history.actions.length > 0 && (
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => interaction.history.undo()}
                  aria-label="Undo Calendar change"
                >
                  <Undo2 size={16} aria-hidden="true" /> Undo
                </button>
              )}
              {interaction.history.redoActions.length > 0 && (
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => interaction.history.redo()}
                  aria-label="Redo Calendar change"
                >
                  <Redo2 size={16} aria-hidden="true" /> Redo
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <CalendarInteractionStatus container={container} />
      <FormBusyContext.Provider value={setFormBusy}>
        {editor && (
          <CalendarEditor
            key={
              editor.kind +
              (editor.item?.id ??
                editor.allDayItem?.id ??
                editor.scheduledItem?.id ??
                editor.duplicateOf?.id ??
                "new")
            }
            editor={editor}
            week={week}
            container={container}
            onClose={() => setEditor(null)}
            onChange={setEditor}
            onSaved={(result) =>
              saved(
                result.kind === "all_day"
                  ? result.date
                  : localDate(result.startsAt, week.timezone),
              )
            }
            onSeries={(id) => {
              setSeries({
                id,
                source:
                  editor.allDayItem ??
                  (editor.kind === "block"
                    ? (editor.item as Week["blocks"][number])
                    : undefined),
                occurrenceDate:
                  editor.allDayItem?.occurrenceDate ??
                  (editor.item && "occurrenceDate" in editor.item
                    ? (editor.item.occurrenceDate ?? undefined)
                    : undefined),
              });
              setEditor(null);
            }}
            onRepeat={(source) => {
              setEditor(null);
              setSeries({ source });
            }}
          />
        )}
        {item && (
          <CalendarItemEditor
            item={item}
            date={date}
            container={container}
            onClose={() => setItem(null)}
            onSaved={(_message, target) => saved(target)}
            onSchedule={(plan) => {
              setItem(null);
              setEditor({ kind: "block", date, scheduledItem: plan });
            }}
          />
        )}
        {series && (
          <CalendarSeriesEditor
            {...series}
            date={date}
            container={container}
            onClose={() => setSeries(null)}
            onSaved={(_message, target) => saved(target)}
          />
        )}
      </FormBusyContext.Provider>
    </>
  );
}
