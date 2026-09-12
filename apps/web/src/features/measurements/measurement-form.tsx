"use client";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import type { Water, Weight } from "@168hours/contracts";
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
export function MeasurementForm({
  kind,
  item,
  onSaved,
}: {
  kind: "water" | "weight";
  item?: Water | Weight;
  onSaved: () => void;
}) {
  const {
    preferences: { timezone, weightUnit },
  } = useMe();
  const weight = kind === "weight";
  const schema = z.object({
    amount: z
      .number()
      .finite()
      .positive()
      .max(weight ? (weightUnit === "lb" ? 2204 : 1000) : 10000),
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
    at: instantToLocalInput(time, timezone),
  });
  const cache = useQueryClient();
  return (
    <Form
      form={form}
      onSubmit={async (v) => {
        const at = localInputToInstant(v.at, timezone);
        if (weight) {
          const input = {
            weightKg: toKilograms(v.amount, weightUnit),
            measuredAt: at,
          };
          if (item) await api.updateWeight(item.id, input);
          else await api.logWeight(input);
        } else {
          const input = { amountMl: v.amount, consumedAt: at };
          if (item) await api.updateWater(item.id, input);
          else await api.logWater(input);
        }
        await cache.invalidateQueries({ queryKey: [kind] });
        await cache.invalidateQueries({ queryKey: ["dashboard"] });
        onSaved();
      }}
    >
      <Field
        name="amount"
        label={weight ? "Weight (" + weightUnit + ")" : "Water (ml)"}
        type="number"
        min={weight ? 1 : 1}
        step={weight ? "any" : 1}
      />
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
