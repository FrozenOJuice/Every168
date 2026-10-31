import { features } from "@/lib/release";
import { useConfirm } from "@/components/ui/confirmation-provider";
import {
  TaskBlockAction,
  TaskTimeAction,
} from "@/features/tasks/calendar-task-actions";
import Link from "next/link";
import { ScheduledWorkoutAction } from "@/features/fitness/scheduled-workout-action";
import { CalendarComposer } from "./calendar-composer";
import { CalendarPlanPopover } from "./calendar-plan-popover";
import type {
  CalendarDraft,
  CalendarSaveResult,
  TimeEditor,
} from "./calendar-layout";
import { useCalendarInteractions } from "./calendar-interactions";
import { useRouter } from "next/navigation";
import { calendarHref } from "./calendar-layout";
import { invalidateCalendar } from "./invalidate-calendar";
import { useQueryClient } from "@tanstack/react-query";
import type { Block, CalendarItem, Week } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { useState } from "react";
import type { ContextMenuAction } from "@/components/ui/context-menu";
import { CalendarEditorActions } from "./calendar-editor-actions";
import { formatDate, formatTime } from "@/lib/format";
import { localDate } from "@168hours/domain-utils";
import { CalendarRepeatSummary } from "./calendar-repeating";
import { TimeForm } from "./time-form";

export function CalendarEditor({
  editor,
  week,
  onClose,
  onChange,
  onSaved,
  onSeries,
  onRepeat,
  composer = false,
  container,
  onDraftChange,
}: {
  editor: TimeEditor;
  composer?: boolean;
  container?: Element | null;
  onDraftChange?: (draft: CalendarDraft | null) => void;
  week: Week;
  onClose: () => void;
  onChange: (editor: TimeEditor) => void;
  onSaved: (result: CalendarSaveResult) => void;
  onSeries: (id: string) => void;
  onRepeat: (block: Block | CalendarItem) => void;
}) {
  const confirm = useConfirm();
  const interaction = useCalendarInteractions(),
    router = useRouter();
  const cache = useQueryClient();
  const [formBusy, setFormBusy] = useState(false);
  const { kind, item } = editor;
  const timedPlan =
    kind === "block" && item && "seriesId" in item ? item : undefined;
  const plan = editor.allDayItem ?? timedPlan;
  const automatic =
    item && "sourceType" in item && item.sourceType !== "manual";
  const linked = timedPlan
    ? week.entries.filter((entry) => entry.timeBlockId === timedPlan.id)
    : [];
  const linkedPlan =
    item && "timeBlockId" in item
      ? week.blocks.find((block) => block.id === item.timeBlockId)
      : undefined;
  const remove = useCommand({
    mutationFn: (_: void, key: string) =>
      kind === "block"
        ? api.deleteTimeBlock(item!.id, item!.version, key)
        : api.deleteTimeEntry(item!.id, item!.version, key),
    onSuccess: async () => {
      await invalidateCalendar(cache);
      onClose();
    },
  });
  const busy = formBusy || remove.isPending || !!interaction?.busy;
  const actions: ContextMenuAction[] = [];
  if (editor.allDayItem) {
    const allDay = editor.allDayItem;
    if (!allDay.seriesId)
      actions.push({ label: "Repeat…", run: () => onRepeat(allDay) });
    actions.push(
      {
        label: "Create timed copy…",
        run: () =>
          onChange({ kind: "block", date: allDay.date!, fromItem: allDay }),
      },
      { separator: true },
      {
        label: "Delete plan",
        destructive: true,
        run: () => {
          interaction?.deleteItem(allDay);
          onClose();
        },
      },
    );
  } else if (item && !automatic) {
    if (timedPlan) {
      actions.push({
        label: "Move or resize on calendar",
        run: () => {
          interaction?.adjust(timedPlan.id);
          onClose();
          router.push(
            calendarHref(localDate(timedPlan.startsAt, week.timezone), "day"),
            { scroll: false },
          );
        },
      });
      if (!timedPlan.seriesId)
        actions.push({ label: "Repeat…", run: () => onRepeat(timedPlan) });
      actions.push(
        {
          label: "Duplicate",
          run: () =>
            onChange({
              kind: "block",
              date: editor.date,
              duplicateOf: timedPlan,
            }),
        },
        { separator: true },
      );
    }
    actions.push({
      label: kind === "block" ? "Delete plan" : "Delete recorded time",
      destructive: true,
      run: () => {
        if (timedPlan && interaction) {
          interaction.deleteBlock(timedPlan);
          onClose();
          return;
        }
        void (async () => {
          if (
            await confirm(
              kind === "block"
                ? "Delete this planned block? Recorded time will remain."
                : "Delete this recorded time entry?",
            )
          )
            remove.mutate();
        })();
      },
    });
  }
  if (composer)
    return (
      <CalendarComposer
        editor={editor}
        onClose={onClose}
        onSaved={onSaved}
        onDraftChange={onDraftChange}
      />
    );
  return (
    <CalendarPlanPopover
      container={container}
      date={editor.date}
      recordId={plan?.id ?? item?.id ?? editor.duplicateOf?.id}
      width={automatic ? 320 : 380}
      className={automatic ? undefined : "calendar-event-editor"}
      busy={remove.isPending || interaction?.busy}
      onBusyChange={setFormBusy}
      headerActions={
        actions.length ? (
          <CalendarEditorActions
            label={kind === "block" ? "Plan actions" : "Recorded time actions"}
            actions={actions}
            disabled={busy}
          />
        ) : undefined
      }
      title={
        automatic
          ? "Recorded activity"
          : item || plan
            ? "Edit " + (kind === "block" ? "plan" : "recorded time")
            : editor.duplicateOf
              ? "Duplicate plan"
              : kind === "block"
                ? "Add plan"
                : "Record actual time"
      }
      onClose={onClose}
    >
      {automatic ? (
        <>
          <div className="stack">
            <div>
              <h3>{item.title}</h3>
              <p>
                {formatDate(localDate(item.startsAt, week.timezone))} ·{" "}
                {formatTime(item.startsAt, week.timezone)} –{" "}
                {formatTime(item.endsAt, week.timezone)}
              </p>
              {"excludedIntervals" in item &&
                !!item.excludedIntervals?.length && (
                  <p className="muted text-small">
                    Paused intervals are excluded from recorded time totals.
                  </p>
                )}
              <p className="muted text-small">
                {"sourceType" in item && item.sourceType === "strength_workout"
                  ? "Recorded from Fitness. Open the session to review or correct it."
                  : item.sourceType === "task_time" && features.tasks
                    ? "Recorded from Tasks. Open Tasks to review or correct it."
                    : "Recorded activity. Its editing workspace is not available yet."}
              </p>
            </div>
          </div>
          {"sourceType" in item && item.sourceType === "strength_workout" && (
            <Link
              className="button primary"
              href={`/fitness/session/${item.sourceId}`}
            >
              Open session
            </Link>
          )}
          {features.tasks &&
            "sourceType" in item &&
            item.sourceType === "task_time" && (
              <TaskTimeAction sourceId={item.sourceId!} />
            )}
        </>
      ) : (
        <>
          {timedPlan && (
            <fieldset className="calendar-event-source-actions" disabled={busy}>
              <ScheduledWorkoutAction blockId={timedPlan.id} disabled={busy} />
              {features.tasks && (
                <TaskBlockAction blockId={timedPlan.id} disabled={busy} />
              )}
            </fieldset>
          )}
          <TimeForm
            {...editor}
            compact
            eventLayout
            onCancel={onClose}
            allowAllDay={kind === "block"}
            onSaved={onSaved}
            disabled={remove.isPending}
            leading={
              plan?.seriesId ? (
                <CalendarRepeatSummary
                  id={plan.seriesId}
                  disabled={busy}
                  onEdit={() => onSeries(plan.seriesId!)}
                />
              ) : undefined
            }
            trailing={
              <>
                {linkedPlan && (
                  <p className="notice">
                    Linked plan: {linkedPlan.title}. Planned and recorded time
                    are summarized separately.
                  </p>
                )}
                {linked.length > 0 && (
                  <div className="linked-records">
                    <h3>Linked recorded time</h3>
                    <ul>
                      {linked.map((entry) => (
                        <li key={entry.id}>
                          <button
                            type="button"
                            className="button"
                            disabled={busy}
                            onClick={() =>
                              onChange({
                                kind: "entry",
                                item: entry,
                                date: editor.date,
                              })
                            }
                          >
                            {entry.title} ·{" "}
                            {formatTime(entry.startsAt, week.timezone)} –{" "}
                            {formatTime(entry.endsAt, week.timezone)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            }
          />
        </>
      )}
      <CommandError command={remove} />
    </CalendarPlanPopover>
  );
}
