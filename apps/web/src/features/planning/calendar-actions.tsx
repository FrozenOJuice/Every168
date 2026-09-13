import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { FoodEntryForm } from "@/features/nutrition/food-entry-form";
import { CardioForm } from "@/features/exercise/cardio-form";
import { WorkoutStartForm } from "@/features/exercise/workout-start-form";
import { MeasurementForm } from "@/features/measurements/measurement-form";
import { GoalForm } from "@/features/goals/goal-form";
import { formatDate } from "@/lib/format";
export type CalendarAction =
  "series" | "all_day" | "unscheduled" | "backlog" | "templates" | "quick";
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
            ["unscheduled", "Add unscheduled plan", "Keep a plan for later."],
            [
              "backlog",
              "Unscheduled plans",
              "Choose when to make time for undated plans.",
            ],
            [
              "templates",
              "Copy and templates",
              "Reuse a day, week, or saved routine.",
            ],
            [
              "quick",
              "Quick actions",
              "Log food, exercise, water, weight, or create a goal.",
            ],
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
  goal: "Create goal",
};
export function CalendarQuickActions({
  date,
  onClose,
  onSaved,
}: {
  date: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [action, setAction] = useState<keyof typeof quickTitles | null>(null);
  const saved = () => onSaved("Saved.");
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
        · Review the date and time before saving.
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
        <FoodEntryForm date={date} onSaved={saved} />
      ) : action === "cardio" ? (
        <CardioForm date={date} onSaved={saved} />
      ) : action === "strength" ? (
        <WorkoutStartForm date={date} />
      ) : action === "goal" ? (
        <GoalForm date={date} onSaved={saved} />
      ) : (
        <MeasurementForm kind={action} date={date} onSaved={saved} />
      )}
    </Dialog>
  );
}
