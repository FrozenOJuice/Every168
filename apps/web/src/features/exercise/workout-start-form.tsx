"use client";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { workoutStartInput } from "@168hours/contracts";
import {
  instantToLocalInput,
  localInputToInstant,
} from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { Form, Field, Submit, useZodForm } from "@/components/ui/form";
import { localTimeField } from "@/lib/format";
import { BlockPicker } from "./block-picker";
export function WorkoutStartForm() {
  const {
    preferences: { timezone },
  } = useMe();
  const schema = z.object({
    ...workoutStartInput.shape,
    startedAt: localTimeField(timezone),
  });
  const form = useZodForm(schema, {
    title: "Strength workout",
    startedAt: instantToLocalInput(new Date(), timezone),
    notes: null,
    linkedTimeBlockId: null,
  });
  const router = useRouter();
  const cache = useQueryClient();
  return (
    <Form
      form={form}
      onSubmit={async (v) => {
        const workout = await api.startWorkout({
          ...v,
          startedAt: localInputToInstant(v.startedAt, timezone),
        });
        await cache.invalidateQueries({ queryKey: ["workouts"] });
        router.push("/exercise/workout/" + workout.id);
      }}
    >
      <Field name="title" label="Workout title" />
      <Field
        name="startedAt"
        label="Started at"
        type="datetime-local"
        help={"In " + timezone}
      />
      <BlockPicker />
      <Field
        name="notes"
        label="Workout notes (optional)"
        type="textarea"
        optional
      />
      <Submit>Start workout</Submit>
    </Form>
  );
}
