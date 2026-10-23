"use client";
import { useQueryClient } from "@tanstack/react-query";
import { foodInput, type Food } from "@168hours/contracts";
import { Field, Form, Submit, useZodForm } from "@/components/ui/form";
import { api } from "@/lib/api";
import { invalidateFood, nutrients, useFoodDirty } from "./food-shared";
export function FoodFields({ prefix = "" }: { prefix?: string }) {
  return (
    <>
      <Field name={prefix + "name"} label="Food name" required />
      <div className="food-form-grid">
        <Field
          name={prefix + "servingAmount"}
          label="Serving amount"
          type="number"
          min="0.001"
          step="any"
        />
        <Field name={prefix + "servingUnit"} label="Serving unit">
          {["g", "ml", "item", "serving"].map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Field>
      </div>
      <p className="muted">
        Nutrition per serving. Leave anything you don’t know blank.
      </p>
      <div className="food-form-grid">
        {nutrients.map(([key, label, unit]) => (
          <Field
            key={key}
            name={prefix + key}
            label={`${label} (${unit})`}
            type="number"
            optional
            min={0}
            max={100000}
            step="any"
          />
        ))}
      </div>
    </>
  );
}
export function FoodEditor({
  item,
  onSaved,
}: {
  item?: Food;
  onSaved: (food: Food) => void;
}) {
  const form = useZodForm(
    foodInput,
    item ?? {
      name: "",
      servingAmount: 100,
      servingUnit: "g",
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
      fiberG: null,
      favourite: false,
    },
  );
  const cache = useQueryClient();
  useFoodDirty(form.formState.isDirty);
  return (
    <Form
      form={form}
      onSubmit={async (v, key) => {
        const saved = item
          ? await api.updateFood(item.id, v, item.version, key)
          : await api.createFood(v, key);
        await invalidateFood(cache);
        onSaved(saved);
      }}
    >
      <FoodFields />
      <label className="row">
        <input type="checkbox" {...form.register("favourite")} />
        Favourite
      </label>
      <Submit>{item ? "Save food" : "Create food"}</Submit>
    </Form>
  );
}
