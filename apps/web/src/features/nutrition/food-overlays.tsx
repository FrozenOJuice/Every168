import type { Food, FoodEntry, Water, Weight } from "@168hours/contracts";
import { localDate } from "@168hours/domain-utils";
import { Dialog } from "@/components/ui/dialog";
import { useMe } from "@/features/identity/me";
import { MeasurementForm } from "@/features/measurements/measurement-form";
import { MeasurementHistory } from "@/features/measurements/measurement-history";
import { FoodForm } from "./food-form";
import { FoodEntryForm } from "./food-entry-form";
import { FoodHistory } from "./food-history";

export type FoodEditor =
  | {
      kind: "food";
      food?: Food;
      continueLogging?: boolean;
      meal?: FoodEntry["mealType"];
    }
  | {
      kind: "entry";
      food?: Food;
      entry?: FoodEntry;
      repeat?: boolean;
      meal?: FoodEntry["mealType"];
    }
  | { kind: "history" }
  | {
      kind: "measurement";
      measurement: "water" | "weight";
      item?: Water | Weight;
    }
  | { kind: "measurement-history"; measurement: "water" | "weight" };

export function FoodOverlays({
  editor,
  date,
  setEditor,
  onSaved,
  onViewDay,
}: {
  editor: FoodEditor;
  date: string;
  setEditor: (editor: FoodEditor | null) => void;
  onSaved: (message: string, date?: string) => void;
  onViewDay: (date: string) => void;
}) {
  const {
    preferences: { timezone },
  } = useMe();
  const close = () => setEditor(null);
  if (editor.kind === "food")
    return (
      <Dialog title={editor.food ? "Edit food" : "Add food"} onClose={close}>
        <FoodForm
          key={editor.food?.id ?? "new"}
          food={editor.food}
          onSaved={(food) => {
            if (editor.continueLogging)
              setEditor({ kind: "entry", food, meal: editor.meal });
            else
              onSaved(
                editor.food
                  ? "Food updated. Past entries keep their original nutrition."
                  : "Food added to your library.",
              );
          }}
        />
      </Dialog>
    );
  if (editor.kind === "entry")
    return (
      <Dialog
        title={editor.entry && !editor.repeat ? "Edit food entry" : "Log food"}
        onClose={close}
      >
        <FoodEntryForm
          key={
            (editor.entry?.id ?? editor.food?.id ?? "new") +
            String(editor.repeat)
          }
          {...editor}
          date={date}
          onCreateFood={() =>
            setEditor({
              kind: "food",
              continueLogging: true,
              meal: editor.meal,
            })
          }
          onRecent={() => setEditor({ kind: "history" })}
          onSaved={(entry) =>
            onSaved(
              editor.entry && !editor.repeat
                ? "Food entry updated."
                : "Food logged.",
              localDate(entry.consumedAt, timezone),
            )
          }
        />
      </Dialog>
    );
  if (editor.kind === "history")
    return (
      <Dialog title="Recent food" onClose={close}>
        <FoodHistory
          date={date}
          onViewDay={onViewDay}
          onRepeat={(entry) =>
            setEditor({ kind: "entry", entry, repeat: true })
          }
        />
      </Dialog>
    );
  if (editor.kind === "measurement-history")
    return (
      <Dialog
        title={
          editor.measurement === "water" ? "Water history" : "Weight history"
        }
        onClose={close}
      >
        <MeasurementHistory
          key={editor.measurement}
          kind={editor.measurement}
          through={date}
        />
      </Dialog>
    );
  return (
    <Dialog
      title={(editor.item ? "Edit " : "Log ") + editor.measurement}
      onClose={close}
    >
      <MeasurementForm
        key={editor.item?.id ?? editor.measurement}
        kind={editor.measurement}
        item={editor.item}
        date={date}
        onSaved={(item) =>
          onSaved(
            "Entry saved.",
            localDate(
              "measuredAt" in item ? item.measuredAt : item.consumedAt,
              timezone,
            ),
          )
        }
      />
    </Dialog>
  );
}
