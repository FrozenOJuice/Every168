"use client";
import { useQuery } from "@tanstack/react-query";
import { useFormContext } from "react-hook-form";
import { localDate } from "@168hours/domain-utils";
import { dateSchema } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { Field } from "@/components/ui/form";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { formatDate } from "@/lib/format";
export function BlockPicker({ existingId }: { existingId?: string | null }) {
  const {
    preferences: { timezone },
  } = useMe();
  const form = useFormContext();
  const start = form.watch("startedAt") as string | undefined;
  const value = form.watch("linkedTimeBlockId") as string | null | undefined;
  const selected = value === undefined ? existingId : value;
  const parsedDate = dateSchema.safeParse(start?.slice(0, 10));
  const date = parsedDate.success
    ? parsedDate.data
    : localDate(new Date(), timezone);
  const week = useQuery({
    queryKey: ["week", "picker", date, timezone],
    queryFn: () => api.getWeek(date),
  });
  return (
    <>
      <Field
        name="linkedTimeBlockId"
        label="Planned block (optional)"
        optional
        help="Plans from the start date's week. A link supplies the category; completed activity records its real time once, with or without a plan."
      >
        <option value="">No planned block</option>
        {selected && !week.data?.blocks.some((b) => b.id === selected) && (
          <option value={selected}>Selected block outside this week</option>
        )}
        {week.data?.blocks.map((b) => (
          <option key={b.id} value={b.id}>
            {formatDate(localDate(b.startsAt, timezone))} · {b.title}
          </option>
        ))}
      </Field>
      {week.isPending && <Loading />}
      {week.error && (
        <ErrorState error={week.error} retry={() => void week.refetch()} />
      )}
    </>
  );
}
