"use client";
import { useQuery } from "@tanstack/react-query";
import { useFormContext } from "react-hook-form";
import { localDate, localInputToInstant } from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { Field } from "@/components/ui/form";
import { formatDate } from "@/lib/format";
export function BlockPicker({ existingId }: { existingId?: string | null }) {
  const {
    preferences: { timezone },
  } = useMe();
  const form = useFormContext();
  const start = form.watch("startedAt") as string | undefined;
  let date = localDate(new Date(), timezone);
  try {
    if (start) date = localDate(localInputToInstant(start, timezone), timezone);
  } catch {
    /* The date field shows its validation error. */
  }
  const week = useQuery({
    queryKey: ["week", "picker", date, timezone],
    queryFn: () => api.getWeek(date),
  });
  return (
    <Field
      name="linkedTimeBlockId"
      label="Planned block (optional)"
      optional
      help="A linked block supplies the category. Completed activity is recorded in your week once."
    >
      <option value="">No planned block</option>
      {existingId && !week.data?.blocks.some((b) => b.id === existingId) && (
        <option value={existingId}>Previously linked block</option>
      )}
      {week.data?.blocks.map((b) => (
        <option key={b.id} value={b.id}>
          {formatDate(localDate(b.startsAt, timezone))} · {b.title}
        </option>
      ))}
    </Field>
  );
}
