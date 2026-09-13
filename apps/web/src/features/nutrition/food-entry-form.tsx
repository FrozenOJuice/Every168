"use client";
import { useState } from "react";
import { z } from "zod";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { foodEntryInput, type Food, type FoodEntry } from "@168hours/contracts";
import {
  instantToLocalInput,
  localInputToInstant,
} from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { api } from "@/lib/api";
import { Field, Form, Submit, useZodForm } from "@/components/ui/form";
import { localTimeField } from "@/lib/format";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { timeForLogDate } from "@/features/measurements/log-time";
export function FoodEntryForm({
  food,
  entry,
  date,
  repeat = false,
  meal,
  onCreateFood,
  onRecent,
  onSaved,
}: {
  food?: Food;
  entry?: FoodEntry;
  date: string;
  repeat?: boolean;
  meal?: FoodEntry["mealType"];
  onCreateFood?: () => void;
  onRecent?: () => void;
  onSaved: (entry: FoodEntry) => void;
}) {
  const {
    preferences: { timezone },
  } = useMe();
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState(food);
  const foods = useInfiniteQuery({
    queryKey: ["foods", "picker", search],
    queryFn: ({ pageParam }) =>
      api.getFoods({ search, cursor: pageParam, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    enabled: !entry,
  });
  const options = foods.data?.pages.flatMap((p) => p.items) ?? [];
  if (chosen && !options.some((f) => f.id === chosen.id))
    options.unshift(chosen);
  const schema = z.object({
    ...foodEntryInput.shape,
    foodId: entry ? z.string() : foodEntryInput.shape.foodId,
    consumedAt: localTimeField(timezone),
  });
  const form = useZodForm(schema, {
    foodId: entry?.foodId ?? food?.id ?? "",
    quantity: entry?.quantity ?? 1,
    mealType: meal ?? entry?.mealType ?? "other",
    consumedAt:
      entry && !repeat
        ? instantToLocalInput(entry.consumedAt, timezone)
        : timeForLogDate(date, timezone),
  });
  const cache = useQueryClient();
  return (
    <Form
      form={form}
      onSubmit={async (v, key) => {
        const input = {
          quantity: v.quantity,
          mealType: v.mealType,
          consumedAt: localInputToInstant(v.consumedAt, timezone),
        };
        const saved = entry
          ? repeat
            ? await api.repeatFoodEntry(entry.id, input, key)
            : await api.updateFoodEntry(entry.id, input, entry.version, key)
          : await api.logFood({ ...input, foodId: v.foodId }, key);
        await cache.invalidateQueries({ queryKey: ["nutrition"] });
        await cache.invalidateQueries({ queryKey: ["dashboard"] });
        onSaved(saved);
      }}
    >
      {entry ? (
        <div className="food-serving-note">
          <p>
            {entry.nameSnapshot} · {entry.servingAmountSnapshot}{" "}
            {entry.servingUnitSnapshot} per serving
          </p>
          <small>
            {repeat
              ? "Uses the nutrition saved with this entry, even if the library food has changed."
              : "Changing quantity or time keeps the original food and nutrition."}
          </small>
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="food-search">Search your foods</label>
            <input
              id="food-search"
              type="search"
              maxLength={100}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Field
            name="foodId"
            label="Saved food"
            onChange={(id) => setChosen(options.find((item) => item.id === id))}
          >
            <option value="">Choose a food</option>
            {options.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · {f.servingAmount} {f.servingUnit}
              </option>
            ))}
          </Field>
          {chosen && (
            <p className="food-serving-note">
              One serving: {chosen.servingAmount} {chosen.servingUnit} ·{" "}
              {chosen.calories} kcal
            </p>
          )}
          {foods.isPending && <Loading />}
          {!foods.isPending && !foods.error && !options.length && (
            <p className="muted text-small">
              {search
                ? "No matching foods. Try another search or add a food."
                : "Your library is empty. Add your first food using its label."}
            </p>
          )}
          {foods.hasNextPage && (
            <button
              className="button"
              type="button"
              onClick={() => void foods.fetchNextPage()}
              disabled={foods.isFetchingNextPage}
            >
              Load more foods
            </button>
          )}
          {foods.error && (
            <ErrorState
              error={foods.error}
              retry={() => void foods.refetch()}
            />
          )}
          {(onCreateFood || onRecent) && (
            <div className="row">
              {onCreateFood && (
                <button className="button" type="button" onClick={onCreateFood}>
                  Create a food
                </button>
              )}
              {onRecent && (
                <button className="button" type="button" onClick={onRecent}>
                  Use a recent entry
                </button>
              )}
            </div>
          )}
        </>
      )}
      <div className="form-grid">
        <Field
          name="quantity"
          label="Quantity (servings)"
          type="number"
          min={0.01}
          step="any"
          help="For example, 0.5 is half of the serving shown above."
        />
        <Field name="mealType" label="Meal">
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snack">Snack</option>
          <option value="other">Other</option>
        </Field>
      </div>
      <Field
        name="consumedAt"
        label="Eaten at"
        type="datetime-local"
        help={"In " + timezone}
      />
      <Submit>{entry && !repeat ? "Save entry" : "Log food"}</Submit>
    </Form>
  );
}
