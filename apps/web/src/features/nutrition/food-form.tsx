"use client";
import { useQueryClient } from "@tanstack/react-query";
import { foodInput, type Food } from "@168hours/contracts";
import { api } from "@/lib/api";
import { Field, Form, Submit, useZodForm } from "@/components/ui/form";
export function FoodForm({
  food,
  onSaved,
}: {
  food?: Food;
  onSaved: () => void;
}) {
  const form = useZodForm(
    foodInput,
    food ?? {
      name: "",
      servingAmount: 100,
      servingUnit: "g",
      calories: 0,
      proteinG: null,
      carbsG: null,
      fatG: null,
      fiberG: null,
    },
  );
  const cache = useQueryClient();
  return (
    <Form
      form={form}
      onSubmit={async (v, key) => {
        if (food) await api.updateFood(food.id, v, food.version, key);
        else await api.createFood(v, key);
        await cache.invalidateQueries({ queryKey: ["foods"] });
        onSaved();
      }}
    >
      <Field name="name" label="Food name" />
      <div className="form-grid">
        <Field
          name="servingAmount"
          label="Serving amount"
          type="number"
          min={0.01}
          step="any"
        />
        <Field name="servingUnit" label="Serving unit">
          <option value="g">Grams (g)</option>
          <option value="ml">Millilitres (ml)</option>
          <option value="item">Item</option>
          <option value="serving">Serving</option>
        </Field>
      </div>
      <Field
        name="calories"
        label="Calories per serving (kcal)"
        type="number"
        min={0}
        step="any"
      />
      <p className="muted text-small">
        Leave nutrients blank when unknown. Enter 0 only when you know the value
        is zero.
      </p>
      <div className="form-grid">
        {[
          ["proteinG", "Protein"],
          ["carbsG", "Carbohydrates"],
          ["fatG", "Fat"],
          ["fiberG", "Fibre"],
        ].map(([name, label]) => (
          <Field
            key={name}
            name={name!}
            label={label + " per serving (g)"}
            type="number"
            min={0}
            step="any"
            optional
          />
        ))}
      </div>
      <Submit>{food ? "Save food" : "Create food"}</Submit>
    </Form>
  );
}
