"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { NutritionDaily, NutritionGoals } from "@168hours/contracts";
import { nutritionGoalsInput } from "@168hours/contracts";
import { foodApi } from "./food-write-recovery";
import {
  Field,
  Form,
  FormBusyContext,
  Submit,
  useZodForm,
} from "@/components/ui/form";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { canNavigateAway, useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { invalidateFood } from "./food-shared";
import { useFoodWritePending } from "./food-write-provider";
import { number } from "@/lib/format";

export function FoodNutrition({ daily }: { daily: NutritionDaily }) {
  const goals = useQuery({
    queryKey: ["food", "goals"],
    queryFn: () => foodApi.getNutritionGoals(),
  });
  return (
    <section className="food-nutrition-summary" aria-label="Daily nutrition">
      <div className="food-progress-grid">
        {(
          [
            ["calories", "Calories", "kcal"],
            ["proteinG", "Protein", "g"],
            ["carbsG", "Carbohydrates", "g"],
            ["fatG", "Fat", "g"],
            ["fiberG", "Fibre", "g"],
          ] as const
        ).map(([key, label, unit]) => {
          const total = daily.totals[key];
          const value = daily.count === 0 ? 0 : total.value;
          const target = key === "fiberG" ? null : goals.data?.[key];
          return (
            <article
              className={`food-nutrition-metric ${key === "calories" ? "food-calories" : ""}`}
              aria-label={label}
              key={key}
            >
              <h3>{label}</h3>
              <p className="food-consumed">
                <strong>
                  {value === null ? "Unknown" : number(value)}
                  {total.unknownCount > 0 && value !== null ? "+" : ""}
                </strong>{" "}
                <span>{unit}</span>
              </p>
              <p className="food-target-caption">
                {key === "fiberG"
                  ? "Consumed"
                  : target != null
                    ? `Target ${number(target)} ${unit}`
                    : goals.isPending
                      ? "Loading target…"
                      : goals.error
                        ? "Target unavailable"
                        : "Target not set"}
              </p>
              {target != null && value !== null && (
                <progress
                  aria-label={`${label} consumed against target`}
                  aria-valuetext={`${number(value)} of ${number(target)} ${unit}${total.unknownCount ? ", partial known total" : ""}`}
                  max={target}
                  value={Math.min(target, value)}
                />
              )}
              {total.unknownCount > 0 && (
                <p className="food-nutrition-incomplete">
                  {total.unknownCount}{" "}
                  {total.unknownCount === 1 ? "entry has" : "entries have"}{" "}
                  unknown {label.toLowerCase()}.{" "}
                  {value !== null
                    ? "Partial known total."
                    : "No known amount recorded."}
                </p>
              )}
            </article>
          );
        })}
      </div>
      {goals.error && (
        <ErrorState error={goals.error} retry={() => void goals.refetch()} />
      )}
    </section>
  );
}

export function NutritionGoalsEditor({
  onSaved,
  onCancel,
}: {
  onSaved: () => void;
  onCancel: () => void;
}) {
  const q = useQuery({
    queryKey: ["food", "goals"],
    queryFn: () => foodApi.getNutritionGoals(),
  });
  return q.isPending ? (
    <Loading />
  ) : q.error && !q.data ? (
    <ErrorState error={q.error} retry={() => void q.refetch()} />
  ) : (
    <GoalsForm item={q.data!} onSaved={onSaved} onCancel={onCancel} />
  );
}
function GoalsForm({
  item: loaded,
  onSaved,
  onCancel,
}: {
  item: NutritionGoals;
  onSaved: () => void;
  onCancel: () => void;
}) {
  // Keep the version opened with this draft, so background reads cannot authorize a stale overwrite.
  const [item] = useState(loaded);
  const [busy, setBusy] = useState(false);
  const form = useZodForm(nutritionGoalsInput, {
    calories: item.calories,
    proteinG: item.proteinG,
    carbsG: item.carbsG,
    fatG: item.fatG,
  });
  const cache = useQueryClient();
  const pending = useFoodWritePending();
  useUnsavedChanges(
    form.formState.isDirty || busy || pending,
    "Your unsaved nutrition targets will be discarded.",
    busy || pending,
    () => form.reset(),
  );
  return (
    <FormBusyContext.Provider value={setBusy}>
      <Form
        form={form}
        disabled={pending}
        onSubmit={async (values, key) => {
          await foodApi.saveNutritionGoals(values, item.version, key);
          form.reset(values);
          await invalidateFood(cache);
          onSaved();
        }}
      >
        <section
          className="food-target-group"
          aria-labelledby="food-energy-target-heading"
        >
          <h3 id="food-energy-target-heading">Energy</h3>
          <Field
            name="calories"
            label="Calories (kcal)"
            type="number"
            optional
            min="0.001"
            max={100000}
            step="any"
          />
        </section>
        <section
          className="food-target-group"
          aria-labelledby="food-macro-target-heading"
        >
          <h3 id="food-macro-target-heading">Macronutrients</h3>
          <div className="food-target-fields">
            {(
              [
                ["proteinG", "Protein (g)"],
                ["carbsG", "Carbohydrates (g)"],
                ["fatG", "Fat (g)"],
              ] as const
            ).map(([key, label]) => (
              <Field
                key={key}
                name={key}
                label={label}
                type="number"
                optional
                min="0.001"
                max={100000}
                step="any"
              />
            ))}
          </div>
        </section>
        <div className="food-target-actions">
          <Submit>Save nutrition targets</Submit>
          <button
            type="button"
            className="button"
            disabled={busy || pending}
            onClick={async () => {
              if (await canNavigateAway()) onCancel();
            }}
          >
            Cancel
          </button>
        </div>
      </Form>
    </FormBusyContext.Provider>
  );
}
