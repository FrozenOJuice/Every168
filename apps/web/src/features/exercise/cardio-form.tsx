"use client";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { cardioInput, type Cardio } from "@168hours/contracts";
import {
  instantToLocalInput,
  localInputToInstant,
  fromMeters,
  toMeters,
} from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { Form, Field, Submit, useZodForm } from "@/components/ui/form";
import { localTimeField } from "@/lib/format";
import { BlockPicker } from "./block-picker";
import { invalidateExercise } from "./invalidate";
export function CardioForm({
  activity,
  date,
  initialTime,
  onSaved,
  onCreated,
}: {
  date?: string;
  initialTime?: string;
  activity?: Cardio;
  onSaved: () => void;
  onCreated?: (activity: Cardio, key: string) => void;
}) {
  const {
    preferences: { timezone, distanceUnit },
  } = useMe();
  const schema = z.object({
    activityType: cardioInput.shape.activityType,
    title: cardioInput.shape.title,
    startedAt: localTimeField(timezone, activity?.startedAt),
    minutes: z
      .number()
      .finite()
      .min(1 / 60, "Enter at least one second.")
      .max(44640),
    distance: z
      .number()
      .finite()
      .positive()
      .max(fromMeters(10000000, distanceUnit))
      .nullable(),
    notes: cardioInput.shape.notes,
    linkedTimeBlockId: cardioInput.shape.linkedTimeBlockId,
  });
  const form = useZodForm(schema, {
    activityType: activity?.activityType ?? "run",
    title: activity?.title ?? "Cardio activity",
    startedAt: activity
      ? instantToLocalInput(activity.startedAt, timezone)
      : initialTime
        ? initialTime
        : date
          ? date + "T09:00"
          : instantToLocalInput(new Date(), timezone),
    minutes: activity ? activity.durationSeconds / 60 : 30,
    distance: activity?.distanceMeters
      ? fromMeters(activity.distanceMeters, distanceUnit)
      : null,
    notes: activity?.notes ?? null,
    linkedTimeBlockId: activity?.linkedTimeBlockId ?? null,
  });
  const cache = useQueryClient();
  return (
    <Form
      form={form}
      onSubmit={async (v, key) => {
        const input = cardioInput.parse({
          title: v.title,
          activityType: v.activityType,
          startedAt:
            activity &&
            v.startedAt === instantToLocalInput(activity.startedAt, timezone)
              ? activity.startedAt
              : localInputToInstant(v.startedAt, timezone),
          durationSeconds: Math.round(v.minutes * 60),
          distanceMeters:
            v.distance === null ? null : toMeters(v.distance, distanceUnit),
          notes: v.notes,
          linkedTimeBlockId: v.linkedTimeBlockId,
        });
        if (activity)
          await api.updateCardio(activity.id, input, activity.version, key);
        else {
          const saved = await api.logCardio(input, key);
          onCreated?.(saved, key);
        }
        await invalidateExercise(cache);
        onSaved();
      }}
    >
      <Field name="activityType" label="Activity type">
        {["run", "walk", "swim", "cycle", "skip", "other"].map((t) => (
          <option key={t} value={t}>
            {t[0]!.toUpperCase() + t.slice(1)}
          </option>
        ))}
      </Field>
      <Field name="title" label="Activity title" />
      <Field
        name="startedAt"
        label="Started at"
        type="datetime-local"
        help={"In " + timezone}
      />
      <div className="form-grid">
        <Field
          name="minutes"
          label="Duration (minutes)"
          type="number"
          min={1 / 60}
          step="any"
        />
        <Field
          name="distance"
          label={"Distance (" + distanceUnit + ", optional)"}
          type="number"
          min={0.01}
          step="any"
          optional
        />
      </div>
      <BlockPicker existingId={activity?.linkedTimeBlockId} />
      <Field name="notes" label="Notes (optional)" type="textarea" optional />
      <Submit>{activity ? "Save activity" : "Log cardio"}</Submit>
    </Form>
  );
}
