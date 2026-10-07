import { CalendarComposer } from "./calendar-composer";
import type { CalendarAction } from "./calendar-actions";
import { useCalendarInteractions } from "./calendar-interactions";
import { useRouter } from "next/navigation";
import { calendarHref } from "./calendar-layout";
import { invalidateCalendar } from "./invalidate-calendar";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import type { Week } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { Dialog } from "@/components/ui/dialog";
import { formatDate, formatTime } from "@/lib/format";
import { localDate } from "@168hours/domain-utils";
import { TimeForm } from "./time-form";
import type { TimeEditor } from "./calendar-layout";

export function CalendarEditor({
  editor,
  week,
  onClose,
  onChange,
  onSaved,
  onSeries,
  composer = false,
  onPlanType,
}: {
  editor: TimeEditor;
  composer?: boolean;
  onPlanType?: (mode: CalendarAction) => void;
  week: Week;
  onClose: () => void;
  onChange: (editor: TimeEditor) => void;
  onSaved: (startsAt: string) => void;
  onSeries: (id: string) => void;
}) {
  const interaction = useCalendarInteractions(),
    router = useRouter();
  const cache = useQueryClient();
  const { kind, item } = editor;
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
  if (composer && onPlanType)
    return (
      <CalendarComposer
        editor={editor}
        onClose={onClose}
        onSaved={onSaved}
        onPlanType={onPlanType}
      />
    );
  return (
    <Dialog
      title={
        automatic
          ? "Recorded activity"
          : item
            ? "Edit " + (kind === "block" ? "block" : "recorded time")
            : editor.duplicateOf
              ? "Duplicate block"
              : kind === "block"
                ? "Add time block"
                : "Record actual time"
      }
      onClose={onClose}
    >
      {item && "seriesId" in item && item.seriesId && (
        <p className="notice">
          This block repeats
          {item.isException ? " and has an individual edit" : ""}. Saving here
          changes this occurrence only.{" "}
          <button
            className="text-button"
            onClick={() => onSeries(item.seriesId!)}
          >
            Edit entire series
          </button>
        </p>
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
              Recorded from Exercise. Edit the original activity to update its
              time here.
            </p>
          </div>
          <Link
            className="button primary"
            href={
              "sourceType" in item && item.sourceType === "strength_workout"
                ? "/exercise/workout/" + item.sourceId
                : "/exercise?tab=cardio"
            }
          >
            View activity
          </Link>
        </div>
      ) : (
        <TimeForm {...editor} onSaved={onSaved} />
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
        <div className="editor-actions">
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
              <button
                className="button"
                disabled={remove.isPending}
                onClick={() =>
                  onChange({
                    kind: "entry",
                    date: editor.date,
                    linkedBlock: item,
                  })
                }
              >
                Log actual
              </button>
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
        </div>
      )}
      <CommandError command={remove} />
    </Dialog>
  );
}
