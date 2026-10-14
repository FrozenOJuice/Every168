import Link from "next/link";
import { ScheduledWorkoutAction } from "@/features/fitness/scheduled-workout-action";
import { CalendarComposer } from "./calendar-composer";
import { CalendarPlanPopover } from "./calendar-plan-popover";
import type { CalendarDraft, CalendarSaveResult } from "./calendar-layout";
import { useCalendarInteractions } from "./calendar-interactions";
import { useRouter } from "next/navigation";
import { calendarHref } from "./calendar-layout";
import { invalidateCalendar } from "./invalidate-calendar";
import { useQueryClient } from "@tanstack/react-query";
import type { Block, CalendarItem, Week } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { useState } from "react";
import { formatDate, formatTime } from "@/lib/format";
import { localDate } from "@168hours/domain-utils";
import { CalendarRepeatSummary } from "./calendar-repeating";
import { TimeForm } from "./time-form";
import type { TimeEditor } from "./calendar-layout";

export function CalendarEditor({
  editor,
  week,
  onClose,
  onChange,
  onSaved,
  onSeries,
  onRepeat,
  composer = false,
  onDraftChange,
}: {
  editor: TimeEditor;
  composer?: boolean;
  onDraftChange?: (draft: CalendarDraft | null) => void;
  week: Week;
  onClose: () => void;
  onChange: (editor: TimeEditor) => void;
  onSaved: (result: CalendarSaveResult) => void;
  onSeries: (id: string) => void;
  onRepeat: (block: Block | CalendarItem) => void;
}) {
  const interaction = useCalendarInteractions(),
    router = useRouter();
  const cache = useQueryClient();
  const [formBusy, setFormBusy] = useState(false);
  const { kind, item } = editor;
  const plan =
    editor.allDayItem ??
    (kind === "block" && item && "seriesId" in item ? item : undefined);
  const automatic =
    item && "sourceType" in item && item.sourceType !== "manual";
  const linked =
    kind === "block" && item
      ? week.entries.filter((entry) => entry.timeBlockId === item.id)
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
      date={editor.date}
      recordId={plan?.id ?? item?.id ?? editor.duplicateOf?.id}
      busy={remove.isPending}
      onBusyChange={setFormBusy}
      title={
        automatic
          ? "Recorded activity"
          : item || plan
            ? "Edit " + (kind === "block" ? "plan" : "recorded time")
            : editor.duplicateOf
              ? "Duplicate block"
              : kind === "block"
                ? "Add time block"
                : "Record actual time"
      }
      onClose={onClose}
    >
      {plan?.seriesId && (
        <CalendarRepeatSummary
          id={plan.seriesId}
          disabled={formBusy || remove.isPending || interaction?.busy}
          onEdit={() => onSeries(plan.seriesId!)}
        />
      )}
      {automatic ? (
        <div className="stack">
          <div>
            <h3>{item.title}</h3>
            <p>
              {formatDate(localDate(item.startsAt, week.timezone))} ·{" "}
              {formatTime(item.startsAt, week.timezone)} –{" "}
              {formatTime(item.endsAt, week.timezone)}
            </p>
            <p className="muted text-small">
              {"sourceType" in item && item.sourceType === "strength_workout"
                ? "Recorded from Fitness. Open the session to review or correct it."
                : "Recorded activity. Its editing workspace is not available yet."}
            </p>
          </div>
        </div>
      ) : (
        <TimeForm
          {...editor}
          compact
          allowAllDay={kind === "block"}
          onSaved={onSaved}
          disabled={remove.isPending}
        />
      )}
      {automatic &&
        "sourceType" in item &&
        item.sourceType === "strength_workout" && (
          <Link
            className="button primary"
            href={`/fitness/session/${item.sourceId}`}
          >
            Open session
          </Link>
        )}
      {plan && <ScheduledWorkoutAction blockId={plan.id} />}
      {editor.allDayItem && (
        <details className="calendar-block-actions">
          <summary>Actions</summary>
          <fieldset
            className="editor-actions"
            disabled={formBusy || interaction?.busy}
          >
            {!editor.allDayItem.seriesId && (
              <button
                className="button"
                onClick={() => onRepeat(editor.allDayItem!)}
              >
                Repeat…
              </button>
            )}
            <button
              className="button"
              onClick={() =>
                onChange({
                  kind: "block",
                  date: editor.allDayItem!.date!,
                  fromItem: editor.allDayItem,
                })
              }
            >
              Create timed copy…
            </button>
            <button
              className="button danger"
              onClick={() => {
                interaction?.deleteItem(editor.allDayItem!);
                onClose();
              }}
            >
              Delete plan
            </button>
          </fieldset>
        </details>
      )}
      {linkedPlan && (
        <p className="notice">
          Linked plan: {linkedPlan.title}. Planned and recorded time are
          summarized separately.
        </p>
      )}
      {linked.length > 0 && (
        <div className="linked-records">
          <h3>Linked recorded time</h3>
          <ul>
            {linked.map((entry) => (
              <li key={entry.id}>
                <button
                  className="text-button"
                  disabled={formBusy || remove.isPending || interaction?.busy}
                  onClick={() =>
                    onChange({ kind: "entry", item: entry, date: editor.date })
                  }
                >
                  {entry.title} · {formatTime(entry.startsAt, week.timezone)} –{" "}
                  {formatTime(entry.endsAt, week.timezone)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {item && !automatic && (
        <details className="calendar-block-actions">
          <summary>Actions</summary>
          <fieldset
            className="editor-actions"
            disabled={formBusy || remove.isPending || interaction?.busy}
          >
            {kind === "block" && "goalId" in item && (
              <>
                <button
                  className="button"
                  disabled={interaction?.busy}
                  onClick={() => {
                    interaction?.adjust(item.id);
                    onClose();
                    router.push(
                      calendarHref(
                        localDate(item.startsAt, week.timezone),
                        "day",
                      ),
                      { scroll: false },
                    );
                  }}
                >
                  Move or resize on calendar
                </button>
                {!item.seriesId && (
                  <button
                    className="button"
                    disabled={formBusy || interaction?.busy}
                    onClick={() => onRepeat(item)}
                  >
                    Repeat…
                  </button>
                )}
                <button
                  className="button"
                  disabled={remove.isPending}
                  onClick={() =>
                    onChange({
                      kind: "block",
                      date: editor.date,
                      duplicateOf: item,
                    })
                  }
                >
                  Duplicate
                </button>
              </>
            )}
            <button
              className="button danger"
              disabled={remove.isPending}
              onClick={() => {
                if (
                  kind === "block" &&
                  item &&
                  "goalId" in item &&
                  interaction
                ) {
                  interaction.deleteBlock(item);
                  onClose();
                  return;
                }
                if (
                  confirm(
                    kind === "block"
                      ? "Delete this planned block? Recorded time will remain."
                      : "Delete this recorded time entry?",
                  )
                )
                  remove.mutate();
              }}
            >
              Delete {kind === "block" ? "block" : "recorded time"}
            </button>
          </fieldset>
        </details>
      )}
      <CommandError command={remove} />
    </CalendarPlanPopover>
  );
}
