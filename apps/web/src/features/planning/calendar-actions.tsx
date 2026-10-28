import { features } from "@/lib/release";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { MeasurementForm } from "@/features/measurements/measurement-form";
import { formatDate } from "@/lib/format";
import { useCalendarInteractions } from "./calendar-interactions";
export type CalendarAction =
  "series" | "all_day" | "unscheduled" | "templates" | "quick";
export function CalendarActions({
  onClose,
  onAction,
}: {
  onClose: () => void;
  onAction: (action: CalendarAction) => void;
}) {
  return (
    <Dialog title="Calendar tools" onClose={onClose}>
      <div className="calendar-action-list">
        {(
          [
            ["series", "Add repeating plan", "Daily or weekly routines."],
            [
              "all_day",
              "Add all-day plan",
              "A date or several days without allocated hours.",
            ],
            ["templates", "Templates", "Save and apply calendar patterns."],
            ["quick", "Quick actions", "Log water or weight."],
          ] as const
        )
          .filter(([id]) => id !== "quick" || features.food)
          .map(([id, title, description]) => (
            <button
              className="calendar-record"
              key={id}
              onClick={() => onAction(id)}
            >
              <strong>{title}</strong>
              <small>{description}</small>
            </button>
          ))}
      </div>
    </Dialog>
  );
}
const quickTitles = {
  water: "Log water",
  weight: "Log weight",
};
export function CalendarQuickActions({
  date,
  minute,
  onClose,
  onSaved,
}: {
  date: string;
  minute?: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [action, setAction] = useState<keyof typeof quickTitles | null>(null);
  const interaction = useCalendarInteractions();
  const created =
    (resource: keyof typeof quickTitles) =>
    (item: { id: string; version: number }, key: string) => {
      interaction?.history.record({
        key,
        kind: "activity-create",
        resource,
        id: item.id,
        version: item.version,
      });
      interaction?.showNotice("Activity logged", {
        undoKey: key,
        kind: "change",
      });
    };
  const saved = () => onSaved("Saved.");
  const initialTime =
    minute === undefined
      ? undefined
      : `${date}T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  return (
    <Dialog
      title={action ? quickTitles[action] : "Quick actions"}
      onClose={onClose}
    >
      <p className="muted text-small">
        {formatDate(date, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}{" "}
        {initialTime
          ? ` · ${initialTime.slice(11)}`
          : " · Review the date and time before saving."}
      </p>
      {!action ? (
        <div className="calendar-action-list">
          {(Object.keys(quickTitles) as (keyof typeof quickTitles)[]).map(
            (key) => (
              <button
                className="button"
                key={key}
                onClick={() => setAction(key)}
              >
                {quickTitles[key]}
              </button>
            ),
          )}
        </div>
      ) : (
        <MeasurementForm
          kind={action}
          date={date}
          initialTime={initialTime}
          onSaved={saved}
          onCreated={created(action)}
        />
      )}
    </Dialog>
  );
}
