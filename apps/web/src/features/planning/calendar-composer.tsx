import { timeForLogDate } from "@/features/measurements/log-time";
import { useMe } from "@/features/identity/me";
import { inputAtMinute } from "./calendar-times";
import { FormBusyContext } from "@/components/ui/form";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { FoodEntryForm } from "@/features/nutrition/food-entry-form";
import { CardioForm } from "@/features/exercise/cardio-form";
import { WorkoutStartForm } from "@/features/exercise/workout-start-form";
import { MeasurementForm } from "@/features/measurements/measurement-form";
import { TimeForm } from "./time-form";
import type { TimeEditor } from "./calendar-layout";
import type { CalendarAction } from "./calendar-actions";

const recordActions = [
  { id: "entry", label: "Time spent" },
  { id: "food", label: "Food" },
  { id: "cardio", label: "Cardio" },
  { id: "strength", label: "Strength workout" },
  { id: "water", label: "Water" },
  { id: "weight", label: "Weight" },
] as const;
export function CalendarComposer({
  editor,
  onClose,
  onSaved,
  onPlanType,
}: {
  editor: TimeEditor;
  onClose: () => void;
  onSaved: (startsAt: string) => void;
  onPlanType: (kind: CalendarAction) => void;
}) {
  const {
    preferences: { timezone },
  } = useMe();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"plan" | "record">("plan");
  const [action, setAction] =
    useState<(typeof recordActions)[number]["id"]>("entry");
  const initialTime =
    editor.minute === undefined
      ? timeForLogDate(editor.date, timezone)
      : inputAtMinute(editor.date, editor.minute);
  const saved = () => onClose();
  return (
    <FormBusyContext.Provider value={setBusy}>
      <Dialog
        title="Add to calendar"
        onClose={() => {
          if (!busy) onClose();
        }}
      >
        <div
          className="row composer-modes"
          role="group"
          aria-label="Create a plan or record activity"
        >
          <button
            type="button"
            disabled={busy}
            className="button"
            aria-pressed={mode === "plan"}
            onClick={() => setMode("plan")}
          >
            Plan
          </button>
          <button
            type="button"
            disabled={busy}
            className="button"
            aria-pressed={mode === "record"}
            onClick={() => setMode("record")}
          >
            Record
          </button>
        </div>
        {mode === "plan" ? (
          <>
            <TimeForm {...editor} onSaved={onSaved} />
            <div className="row wrap composer-plan-types">
              <button
                className="text-button"
                disabled={busy}
                onClick={() => onPlanType("all_day")}
              >
                All-day plan
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => onPlanType("unscheduled")}
              >
                Unscheduled plan
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => onPlanType("series")}
              >
                Repeating plan
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="field">
              What did you record?
              <select
                disabled={busy}
                value={action}
                onChange={(event) =>
                  setAction(event.target.value as typeof action)
                }
              >
                {recordActions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="composer-record-form" key={action}>
              {action === "entry" ? (
                <TimeForm {...editor} kind="entry" onSaved={onSaved} />
              ) : action === "food" ? (
                <FoodEntryForm
                  date={editor.date}
                  initialTime={initialTime}
                  onSaved={saved}
                />
              ) : action === "cardio" ? (
                <CardioForm
                  date={editor.date}
                  initialTime={initialTime}
                  onSaved={saved}
                />
              ) : action === "strength" ? (
                <WorkoutStartForm
                  date={editor.date}
                  initialTime={initialTime}
                />
              ) : (
                <MeasurementForm
                  kind={action}
                  date={editor.date}
                  initialTime={initialTime}
                  onSaved={saved}
                />
              )}
            </div>
          </>
        )}
      </Dialog>
    </FormBusyContext.Provider>
  );
}
