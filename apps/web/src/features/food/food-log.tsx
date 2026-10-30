"use client";
import { useState } from "react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  foodInput,
  foodEntryUpdate,
  ingredientInput,
  type Food,
  type FoodEntry,
} from "@168hours/contracts";
import {
  instantToLocalInput,
  localInputToInstant,
} from "@168hours/domain-utils";
import { Field, Form, Submit, useZodForm } from "@/components/ui/form";
import { useMe } from "@/features/identity/me";
import { timeForLogDate } from "@/features/measurements/log-time";
import { localTimeField } from "@/lib/format";
import { api } from "@/lib/api";
import { FoodPicker } from "./food-picker";
import { FoodEditor, FoodFields } from "./food-editor";
import { invalidateFood, useFoodDirty } from "./food-shared";
export function FoodLog({
  date,
  initialFood,
  entry,
  repeat = false,
  onSaved,
}: {
  date: string;
  initialFood?: Food;
  entry?: FoodEntry;
  repeat?: boolean;
  onSaved: (entry: FoodEntry) => void;
}) {
  const [food, setFood] = useState(initialFood);
  const [mode, setMode] = useState<"choose" | "quick" | "create">("choose");
  if (mode === "create")
    return (
      <FoodEditor
        onSaved={(f) => {
          setFood(f);
          setMode("choose");
        }}
      />
    );
  if (!food && !entry && mode === "choose")
    return (
      <div className="form-stack">
        <div className="row">
          <button className="button" onClick={() => setMode("quick")}>
            Quick entry
          </button>
          <button className="button" onClick={() => setMode("create")}>
            Create a food
          </button>
        </div>
        <FoodPicker includeMeals onChoose={setFood} />
      </div>
    );
  return (
    <FoodLogForm
      key={food?.id ?? entry?.id ?? "quick"}
      date={date}
      food={food}
      entry={entry}
      repeat={repeat}
      quick={mode === "quick"}
      onSaved={onSaved}
    />
  );
}
function FoodLogForm({
  date,
  food,
  entry,
  repeat,
  quick,
  onSaved,
}: {
  date: string;
  food?: Food;
  entry?: FoodEntry;
  repeat: boolean;
  quick: boolean;
  onSaved: (entry: FoodEntry) => void;
}) {
  const {
    preferences: { timezone },
  } = useMe();
  const cache = useQueryClient();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const recorded = entry && !repeat ? entry.consumedAt : undefined;
  const schema = z.object({
    quantity: foodEntryUpdate.shape.quantity,
    mealType: foodEntryUpdate.shape.mealType,
    at: localTimeField(timezone, recorded),
    ingredientQuantities: z.array(ingredientInput.shape.quantity).optional(),
    food: foodInput.omit({ favourite: true }).optional(),
  });
  const form = useZodForm(schema, {
    quantity: entry?.quantity ?? 1,
    mealType: entry?.mealType ?? "other",
    at: recorded
      ? instantToLocalInput(recorded, timezone)
      : timeForLogDate(date, timezone),
    ingredientQuantities: food?.ingredients.map((i) => i.quantity),
    food: quick
      ? {
          name: "",
          servingAmount: 1,
          servingUnit: "serving",
          calories: null,
          proteinG: null,
          carbsG: null,
          fatG: null,
          fiberG: null,
        }
      : undefined,
  });
  useFoodDirty(form.formState.isDirty);
  const amount = food?.servingAmount ?? entry?.servingAmountSnapshot ?? 1,
    unit = food?.servingUnit ?? entry?.servingUnitSnapshot ?? "serving";
  return (
    <Form
      form={form}
      onSubmit={async (v, key) => {
        const input = {
          quantity: v.quantity,
          mealType: v.mealType,
          consumedAt:
            recorded && v.at === instantToLocalInput(recorded, timezone)
              ? recorded
              : localInputToInstant(v.at, timezone),
        };
        const saved = entry
          ? repeat
            ? await api.repeatFoodEntry(entry.id, input, key)
            : await api.updateFoodEntry(entry.id, input, entry.version, key)
          : quick
            ? await api.quickLogFood({ ...input, food: v.food! }, key)
            : await api.logFood(
                {
                  ...input,
                  foodId: food!.id,
                  foodVersion: food!.version,
                  ...(food!.ingredients.length > 0
                    ? { ingredientQuantities: v.ingredientQuantities }
                    : {}),
                },
                key,
              );
        await invalidateFood(cache);
        onSaved(saved);
      }}
    >
      {quick ? (
        <FoodFields prefix="food." />
      ) : (
        <h3>{food?.name ?? entry?.nameSnapshot}</h3>
      )}
      {repeat && (
        <p className="muted">
          Copies the original recorded food and nutrition, even if its library
          definition has changed.
        </p>
      )}
      <Field
        name="quantity"
        label={
          quick
            ? "Number of servings"
            : `Number of servings (${amount} ${unit} each)`
        }
        type="number"
        min="0.001"
        max={1000}
        step="any"
      />
      <Field name="mealType" label="Meal label (optional)">
        {["other", "breakfast", "lunch", "dinner", "snack"].map((m) => (
          <option key={m} value={m}>
            {m === "other" ? "No label" : m[0]!.toUpperCase() + m.slice(1)}
          </option>
        ))}
      </Field>
      <Field name="at" label="Eaten at" type="datetime-local" />
      {!!food?.ingredients.length && (
        <details
          open={adjustOpen || !!form.formState.errors.ingredientQuantities}
          onToggle={(e) => setAdjustOpen(e.currentTarget.open)}
        >
          <summary>Adjust ingredient amounts for this entry</summary>
          <p className="muted">
            Amounts for the{" "}
            {food.kind === "recipe"
              ? `full recipe (${food.yieldServings} portions)`
              : "whole saved meal"}
            . The saved definition stays unchanged.
          </p>
          {food.ingredients.map((i, index) => (
            <Field
              key={index}
              name={`ingredientQuantities.${index}`}
              label={`Servings of ${i.name} (${i.servingAmount} ${i.servingUnit} each)`}
              type="number"
              min="0.001"
              max={1000}
              step="any"
            />
          ))}
        </details>
      )}
      <Submit>{entry && !repeat ? "Save entry" : "Log food"}</Submit>
    </Form>
  );
}
