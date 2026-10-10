import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { FoodEntryForm } from "@/features/nutrition/food-entry-form";
import { CardioForm } from "@/features/exercise/cardio-form";
import { WorkoutStartForm } from "@/features/exercise/workout-start-form";
import { MeasurementForm } from "@/features/measurements/measurement-form";
import { formatDate } from "@/lib/format";
export type CalendarAction =
  "series" | "all_day" | "unscheduled" | "copy" | "templates" | "quick";
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
            [
              "copy",
              "Copy plans",
              "Copy one plan, a day, a week, or a date range.",
            ],
            ["templates", "Templates", "Save and apply calendar patterns."],
            ["quick", "Quick actions", "Log food, exercise, water or weight."],
          ] as const
        ).map(([id, title, description]) => (
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
  food: "Log food",
  cardio: "Log cardio",
  strength: "Start workout",
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
      ) : action === "food" ? (
        <FoodEntryForm date={date} initialTime={initialTime} onSaved={saved} />
      ) : action === "cardio" ? (
        <CardioForm date={date} initialTime={initialTime} onSaved={saved} />
      ) : action === "strength" ? (
        <WorkoutStartForm date={date} initialTime={initialTime} />
      ) : (
        <MeasurementForm
          kind={action}
          date={date}
          initialTime={initialTime}
          onSaved={saved}
        />
      )}
    </Dialog>
  );
}
