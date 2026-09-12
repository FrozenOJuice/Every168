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
export function FoodEntryForm({
  food,
  entry,
  date,
  repeat = false,
  onSaved,
}: {
  food?: Food;
  entry?: FoodEntry;
  date: string;
  repeat?: boolean;
  onSaved: () => void;
}) {
  const {
    preferences: { timezone },
  } = useMe();
  const [search, setSearch] = useState("");
  const foods = useInfiniteQuery({
    queryKey: ["foods", "picker", search],
    queryFn: ({ pageParam }) =>
      api.getFoods({ search, cursor: pageParam, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    enabled: !entry,
  });
  const options = foods.data?.pages.flatMap((p) => p.items) ?? [];
  if (food && !options.some((f) => f.id === food.id)) options.unshift(food);
  const schema = z.object({
    ...foodEntryInput.shape,
    foodId: entry ? z.string() : foodEntryInput.shape.foodId,
    consumedAt: localTimeField(timezone),
  });
  const form = useZodForm(schema, {
    foodId: entry?.foodId ?? food?.id ?? "",
    quantity: entry?.quantity ?? 1,
    mealType: entry?.mealType ?? "other",
    consumedAt:
      entry && !repeat
        ? instantToLocalInput(entry.consumedAt, timezone)
        : date + "T12:00",
  });
  const cache = useQueryClient();
  return (
    <Form
      form={form}
      onSubmit={async (v) => {
        const input = {
          quantity: v.quantity,
          mealType: v.mealType,
          consumedAt: localInputToInstant(v.consumedAt, timezone),
        };
        if (entry) {
          if (repeat) await api.repeatFoodEntry(entry.id, input);
          else await api.updateFoodEntry(entry.id, input);
        } else await api.logFood({ ...input, foodId: v.foodId });
        await cache.invalidateQueries({ queryKey: ["nutrition"] });
        await cache.invalidateQueries({ queryKey: ["dashboard"] });
        onSaved();
      }}
    >
      {entry ? (
        <p>
          {entry.nameSnapshot} · {entry.servingAmountSnapshot}{" "}
          {entry.servingUnitSnapshot} per serving
        </p>
      ) : (
        <>
          <div className="field">
            <label htmlFor="food-search">Search your foods</label>
            <input
              id="food-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Field name="foodId" label="Saved food">
            <option value="">Choose a food</option>
            {options.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · {f.servingAmount} {f.servingUnit}
              </option>
            ))}
          </Field>
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
            <p className="error" role="alert">
              {foods.error.message}
            </p>
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
