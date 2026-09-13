"use client";
import { useQuery } from "@tanstack/react-query";
import type { Water, Weight } from "@168hours/contracts";
import { fromKilograms, localDate } from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { formatDate, number } from "@/lib/format";
import { MeasurementList } from "./measurement-list";
import { WeightChart } from "./weight-chart";

export function WeightPanel({
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
    preferences: { timezone, weightUnit },
  } = useMe();
  const query = useQuery({
    queryKey: ["weight", "review", date, timezone],
    queryFn: () => api.getWeightReview(date),
  });
  return (
    <section
      className="panel food-weight"
      id="food-weight"
      aria-labelledby="food-weight-heading"
    >
      <div className="row between">
        <h2 id="food-weight-heading">Weight</h2>
        <button className="text-button" onClick={onHistory}>
          Weight history
        </button>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="measurement-total">
            <strong>
              {query.data.latest
                ? number(
                    fromKilograms(query.data.latest.weightKg, weightUnit),
                    2,
                  ) +
                  " " +
                  weightUnit
                : "Not logged"}
            </strong>
            <small>
              {query.data.latest
                ? "Measured " +
                  formatDate(
                    localDate(query.data.latest.measuredAt, timezone),
                    { month: "short", day: "numeric", year: "numeric" },
                  )
                : "No measurements through this day"}
            </small>
          </div>
          {query.data.entries.length === 0 && query.data.latest && (
            <p className="muted text-small">
              No measurement on the selected day.
            </p>
          )}
          {query.data.trend.entries.length > 0 && (
            <>
              <p className="muted text-small">
                {formatDate(query.data.trend.from)} –{" "}
                {formatDate(query.data.trend.to)} · 30 days
              </p>
              <WeightChart entries={query.data.trend.entries} />
              {query.data.trend.truncated && (
                <p className="muted text-small">
                  Showing the latest 200 measurements in this period. All
                  entries are available in history.
                </p>
              )}
            </>
          )}
          <MeasurementList
            kind="weight"
            entries={query.data.entries}
            onEdit={onEdit}
          />
        </>
      )}
      <button className="button" onClick={onLog}>
        Log weight
      </button>
    </section>
  );
}
