"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Water, Weight } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { useCommand, CommandError } from "@/lib/use-command";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { number } from "@/lib/format";
import { instantForLogDate } from "./log-time";
import { MeasurementList } from "./measurement-list";

export function WaterPanel({
  date,
  onLog,
  onEdit,
  onHistory,
}: {
  date: string;
  onLog: () => void;
  onEdit: (entry: Water | Weight) => void;
  onHistory: () => void;
}) {
  const {
    preferences: { timezone },
  } = useMe();
  const cache = useQueryClient();
  const daily = useQuery({
    queryKey: ["water", "daily", date, timezone],
    queryFn: () => api.getWaterDaily(date),
  });
  const quick = useCommand({
    mutationFn: (
      input: { amountMl: number; consumedAt: string },
      key: string,
    ) => api.logWater(input, key),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["water"] });
      await cache.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  return (
    <section
      className="panel food-water"
      id="food-water"
      aria-labelledby="food-water-heading"
    >
      <div className="row between">
        <h2 id="food-water-heading">Water</h2>
        <button className="text-button" onClick={onHistory}>
          Water history
        </button>
      </div>
      {daily.isPending ? (
        <Loading />
      ) : daily.error ? (
        <ErrorState error={daily.error} retry={() => void daily.refetch()} />
      ) : (
        <div className="measurement-total">
          <strong>
            {daily.data.totalMl === null
              ? "Not logged"
              : number(daily.data.totalMl, 0) + " ml"}
          </strong>
          <small>Recorded for this day</small>
        </div>
      )}
      <div
        className="row water-quick"
        role="group"
        aria-label="Quick water logging"
      >
        {[250, 500].map((amount) => (
          <button
            className="button"
            key={amount}
            disabled={quick.isPending}
            onClick={() =>
              quick.mutate({
                amountMl: amount,
                consumedAt: instantForLogDate(date, timezone),
              })
            }
          >
            + {amount} ml
          </button>
        ))}
        <button className="button" onClick={onLog}>
          Log water
        </button>
      </div>
      <CommandError command={quick} />
      {quick.isSuccess && (
        <p className="success" role="status">
          Water logged.
        </p>
      )}
      {daily.data && !daily.error && (
        <MeasurementList
          kind="water"
          entries={daily.data.entries}
          onEdit={onEdit}
        />
      )}
    </section>
  );
}
