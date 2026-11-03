"use client";
import { useFoodWritePending } from "./food-write-provider";
import { useState } from "react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  foodInput,
  foodEntryUpdate,
  foodQuantity,
  type FoodSelection,
  type CatalogueFood,
  type Food,
  type FoodEntry,
  type FoodEntryDetail,
} from "@168hours/contracts";
import {
  instantToLocalInput,
  localInputToInstant,
} from "@168hours/domain-utils";
import { Field, Form, Submit, useZodForm } from "@/components/ui/form";
import { useMe } from "@/features/identity/me";
import { timeForLogDate } from "@/features/measurements/log-time";
import { number, localTimeField } from "@/lib/format";
import { foodApi as api } from "./food-write-recovery";
import { FoodSourceNote } from "./food-source";
import { FoodRecent } from "./food-recent";
import { FoodFavourites } from "./food-favourites";
import { FoodPicker } from "./food-picker";
import { FoodEditor, FoodFields } from "./food-editor";
import { invalidateFood, useFoodDirty } from "./food-shared";
export function FoodLog({
  date,
  initialFood,
  initialCatalogue,
  initialMeal,
  entry,
  repeat = false,
  onSaved,
}: {
  date: string;
  initialFood?: Food;
  initialCatalogue?: CatalogueFood;
  initialMeal?: FoodEntry["mealType"];
  entry?: FoodEntry;
  repeat?: boolean;
  onSaved: (entry: FoodEntry) => void;
}) {
  const [selection, setSelection] = useState<FoodSelection | undefined>(
    initialCatalogue
      ? { type: "catalogue", food: initialCatalogue }
      : initialFood
        ? { type: "owned", food: initialFood }
        : undefined,
  );
  const food = selection?.type === "owned" ? selection.food : undefined;
  const catalogue =
    selection?.type === "catalogue" ? selection.food : undefined;
  const setFood = (food: Food) => setSelection({ type: "owned", food });
  const [recent, setRecent] = useState<FoodEntryDetail>();
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
  if (!selection && !entry && !recent && mode === "choose")
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
        <FoodFavourites onLog={setFood} />
        <FoodRecent onChoose={setRecent} />
        <FoodPicker includeMeals onChoose={setSelection} />
      </div>
    );
  return (
    <FoodLogForm
      key={food?.id ?? catalogue?.id ?? entry?.id ?? recent?.id ?? "quick"}
      date={date}
      food={food}
      catalogue={catalogue}
      initialMeal={initialMeal}
      entry={entry ?? recent}
      repeat={repeat || !!recent}
      quick={mode === "quick"}
      onSaved={onSaved}
    />
  );
}
function FoodLogForm({
  date,
  food,
  catalogue,
  initialMeal,
  entry,
  repeat,
  quick,
  onSaved,
}: {
  date: string;
  food?: Food;
  catalogue?: CatalogueFood;
  initialMeal?: FoodEntry["mealType"];
  entry?: FoodEntry;
  repeat: boolean;
  quick: boolean;
  onSaved: (entry: FoodEntry) => void;
}) {
  const {
    preferences: { timezone },
  } = useMe();
  const cache = useQueryClient();
  const writePending = useFoodWritePending();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const recordedCatalogue = !!entry?.catalogueId;
  const recorded = entry && !repeat ? entry.consumedAt : undefined;
  const schema = z.object({
    quantity: z
      .number()
      .finite()
      .positive()
      .max(catalogue || recordedCatalogue ? 100000 : 1000),
    portionId: z.string().default("g"),
    mealType: foodEntryUpdate.shape.mealType,
    at: localTimeField(timezone, recorded),
    ingredientQuantities: z.array(foodQuantity).optional(),
    food: foodInput.omit({ favourite: true }).optional(),
  });
  const form = useZodForm(schema, {
    quantity: entry
      ? entry.quantity * (recordedCatalogue ? entry.servingAmountSnapshot : 1)
      : catalogue
        ? 100
        : 1,
    portionId: "g",
    mealType: initialMeal ?? entry?.mealType ?? "other",
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
      disabled={writePending}
      onSubmit={async (v, key) => {
        const input = {
          quantity: recordedCatalogue
            ? v.quantity / entry!.servingAmountSnapshot
            : v.quantity,
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
          : catalogue
            ? await api.logFood(
                {
                  ...input,
                  catalogueId: catalogue.id,
                  foodVersion: catalogue.version,
                  portionId: v.portionId,
                },
                key,
              )
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
        <h3>{food?.name ?? catalogue?.name ?? entry?.nameSnapshot}</h3>
      )}
      <FoodSourceNote
        source={
          catalogue
            ? {
                provider: catalogue.provider,
                release: catalogue.release,
                code: catalogue.code,
                name: catalogue.name,
                modified: false,
              }
            : (food?.source ?? entry?.sourceSnapshot)
        }
      />
      {repeat && (
        <p className="muted">
          Copies the original recorded food and nutrition, even if the saved
          definition has changed.
        </p>
      )}
      <Field
        name="quantity"
        label={
          catalogue
            ? "Amount eaten"
            : recordedCatalogue
              ? `Amount eaten (${entry!.servingUnitSnapshot})`
              : quick
                ? "Number of servings"
                : `Number of servings (${amount} ${unit} each)`
        }
        type="number"
        min="0.001"
        max={catalogue || recordedCatalogue ? 100000 : 1000}
        step="any"
      />
      {catalogue && (
        <Field name="portionId" label="Amount unit">
          <option value="g">Grams</option>
          {catalogue.portions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} ({number(p.grams)} g)
            </option>
          ))}
        </Field>
      )}
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
