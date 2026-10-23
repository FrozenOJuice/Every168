"use client";
import { useState } from "react";
import { useFieldArray } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { preparationInput, type Food } from "@168hours/contracts";
import { Field, Form, Submit, useZodForm } from "@/components/ui/form";
import { api } from "@/lib/api";
import { FoodPicker } from "./food-picker";
import { invalidateFood, useFoodDirty } from "./food-shared";
export function PreparationEditor({
  kind,
  item,
  onSaved,
}: {
  kind: "meal" | "recipe";
  item?: Food;
  onSaved: (food: Food) => void;
}) {
  const form = useZodForm(preparationInput, {
    name: item?.name ?? "",
    kind,
    ingredients:
      item?.ingredients.map((i) => ({
        foodId: i.foodId,
        quantity: i.quantity,
      })) ?? [],
    yieldServings: item?.yieldServings ?? 1,
    instructions: item?.instructions ?? null,
    favourite: item?.favourite ?? false,
  });
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "ingredients",
  });
  const [labels, setLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (item?.ingredients ?? []).map((i) => [
        i.foodId,
        `${i.name} · ${i.servingAmount} ${i.servingUnit}`,
      ]),
    ),
  );
  const cache = useQueryClient();
  useFoodDirty(form.formState.isDirty);
  return (
    <Form
      form={form}
      onSubmit={async (v, key) => {
        const saved = await api.savePreparation(
          v,
          item?.id,
          item?.version,
          key,
        );
        await invalidateFood(cache);
        onSaved(saved);
      }}
    >
      <Field
        name="name"
        label={kind === "recipe" ? "Recipe name" : "Meal name"}
        required
      />
      <p className="muted">
        {kind === "recipe"
          ? "Add foods for the full recipe, then set how many portions it makes."
          : "Add foods or recipes for one meal. You can adjust amounts when logging."}{" "}
        Nutrition uses the saved ingredient values; editing this preparation
        refreshes them.
      </p>
      <div className="form-stack">
        {fields.map((f, i) => (
          <section
            className="food-ingredient"
            key={f.id}
            aria-label={`Ingredient ${i + 1}`}
          >
            <h3>{labels[f.foodId] ?? "Ingredient"}</h3>
            <Field
              name={`ingredients.${i}.quantity`}
              label={`Servings of ${labels[f.foodId] ?? "ingredient"}`}
              type="number"
              min="0.001"
              max={1000}
              step="any"
            />
            <div className="row">
              <button
                type="button"
                className="button"
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              >
                Move up
              </button>
              <button
                type="button"
                className="button"
                onClick={() => remove(i)}
              >
                Remove ingredient
              </button>
            </div>
          </section>
        ))}
      </div>
      {form.formState.errors.ingredients && (
        <p className="error" role="alert">
          Add 1–50 ingredients with positive serving quantities.
        </p>
      )}
      <details open={fields.length === 0 || undefined}>
        <summary>Add ingredient</summary>
        <FoodPicker
          kind={kind === "recipe" ? "food" : undefined}
          excludeId={item?.id}
          onChoose={(f) => {
            if (fields.length >= 50) return;
            setLabels((v) => ({
              ...v,
              [f.id]: `${f.name} · ${f.servingAmount} ${f.servingUnit}`,
            }));
            append({ foodId: f.id, quantity: 1 });
          }}
        />
      </details>
      {kind === "recipe" && (
        <Field
          name="yieldServings"
          label="Recipe yield (portions)"
          type="number"
          min={1}
          max={1000}
          step="any"
        />
      )}
      <Field
        name="instructions"
        label={
          kind === "recipe" ? "Instructions (optional)" : "Notes (optional)"
        }
        type="textarea"
        optional
      />
      <label className="row">
        <input type="checkbox" {...form.register("favourite")} />
        Favourite
      </label>
      <Submit>
        {item
          ? "Save changes"
          : kind === "recipe"
            ? "Create recipe"
            : "Save meal"}
      </Submit>
    </Form>
  );
}
