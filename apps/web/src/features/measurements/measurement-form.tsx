"use client";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  waterInput,
  weightInput,
  type Water,
  type Weight,
} from "@168hours/contracts";
import {
  fromKilograms,
  toKilograms,
  instantToLocalInput,
  localInputToInstant,
} from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { Field, Form, Submit, useZodForm } from "@/components/ui/form";
import { localTimeField } from "@/lib/format";
import { timeForLogDate } from "./log-time";
export function MeasurementForm({
  kind,
  date,
  initialTime,
  item,
  onSaved,
}: {
  date?: string;
  initialTime?: string;
  kind: "water" | "weight";
  item?: Water | Weight;
  onSaved: (item: Water | Weight) => void;
}) {
  const {
    preferences: { timezone, weightUnit },
  } = useMe();
  const weight = kind === "weight";
  const schema = z.object({
    amount: weight
      ? z
          .number()
          .finite()
          .refine(
            (value) =>
              weightInput.shape.weightKg.safeParse(
                toKilograms(value, weightUnit),
              ).success,
            "Enter a weight between " +
              fromKilograms(1, weightUnit).toFixed(2) +
              " and " +
              fromKilograms(1000, weightUnit).toFixed(2) +
              " " +
              weightUnit +
              ".",
          )
      : waterInput.shape.amountMl,
    at: localTimeField(timezone),
  });
  const value = item
    ? "weightKg" in item
      ? fromKilograms(item.weightKg, weightUnit)
      : item.amountMl
    : weight
      ? undefined
      : 250;
  const time = item
    ? "measuredAt" in item
      ? item.measuredAt
      : item.consumedAt
    : new Date().toISOString();
  const form = useZodForm(schema, {
    amount: value,
    at:
      !item && (date || initialTime)
        ? (initialTime ?? timeForLogDate(date!, timezone))
        : instantToLocalInput(time, timezone),
  });
  const cache = useQueryClient();
  return (
    <Form
      form={form}
      onSubmit={async (v, key) => {
        const at = localInputToInstant(v.at, timezone);
        let saved: Water | Weight;
        if (weight) {
          const input = {
            weightKg: toKilograms(v.amount, weightUnit),
            measuredAt: at,
          };
          saved = item
            ? await api.updateWeight(item.id, input, item.version, key)
            : await api.logWeight(input, key);
        } else {
          const input = { amountMl: v.amount, consumedAt: at };
          saved = item
            ? await api.updateWater(item.id, input, item.version, key)
            : await api.logWater(input, key);
        }
        await cache.invalidateQueries({ queryKey: [kind] });
        await cache.invalidateQueries({ queryKey: ["dashboard"] });
        await cache.invalidateQueries({ queryKey: ["calendar-activity"] });
        onSaved(saved);
      }}
    >
      <Field
        name="amount"
        label={weight ? "Weight (" + weightUnit + ")" : "Water (ml)"}
        type="number"
        min={weight ? fromKilograms(1, weightUnit) : 1}
        max={weight ? fromKilograms(1000, weightUnit) : 10000}
        step={weight ? "any" : 1}
      />
      {!weight && (
        <div className="row" role="group" aria-label="Water amounts">
          {[250, 500, 1000].map((amount) => (
            <button
              className="button"
              type="button"
              key={amount}
              onClick={() =>
                form.setValue("amount", amount, { shouldValidate: true })
              }
            >
              {amount} ml
            </button>
          ))}
        </div>
      )}
      <Field
        name="at"
        label={weight ? "Measured at" : "Drank at"}
        type="datetime-local"
        help={"In " + timezone}
      />
      <Submit>
        {item ? "Save changes" : weight ? "Log weight" : "Log water"}
      </Submit>
    </Form>
  );
}
