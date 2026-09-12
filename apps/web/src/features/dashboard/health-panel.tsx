"use client";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Droplets, Scale, Utensils, Dumbbell } from "lucide-react";
import type { Dashboard } from "@168hours/contracts";
import { fromKilograms, localDate } from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { number, formatDate } from "@/lib/format";
import { Dialog } from "@/components/ui/dialog";
import { MeasurementForm } from "@/features/measurements/measurement-form";
import { MeasurementHistory } from "@/features/measurements/measurement-history";
import { NutrientValue } from "@/features/nutrition/nutrition-totals";
export function HealthPanel({ data }: { data: Dashboard }) {
  const {
    preferences: { weightUnit, timezone },
  } = useMe();
  const [dialog, setDialog] = useState<{
    kind: "water" | "weight";
    history: boolean;
  } | null>(null);
  const cache = useQueryClient();
  const water = useMutation({
    mutationFn: (amountMl: number) =>
      api.logWater({ amountMl, consumedAt: new Date().toISOString() }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["water"] });
      await cache.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  return (
    <>
      <section className="panel">
        <h2>A quick check-in</h2>
        <p className="muted text-small">The everyday, as you record it.</p>
        <div className="health-section">
          <div className="row between">
            <h3>
              <Droplets size={17} />
              Water today
            </h3>
            <button
              className="text-button"
              onClick={() => setDialog({ kind: "water", history: true })}
            >
              History
            </button>
          </div>
          <p className="health-value">
            {data.water.totalMl === null
              ? "Not logged yet"
              : number(data.water.totalMl, 0) + " ml"}
          </p>
          <div className="row">
            <button
              className="button"
              disabled={water.isPending}
              onClick={() => water.mutate(250)}
            >
              + 250 ml
            </button>
            <button
              className="button"
              disabled={water.isPending}
              onClick={() => water.mutate(500)}
            >
              + 500 ml
            </button>
            <button
              className="button"
              onClick={() => setDialog({ kind: "water", history: false })}
            >
              Log water
            </button>
          </div>
          {water.isSuccess && <small role="status">Water logged.</small>}
          {water.error && (
            <p className="error" role="alert">
              {water.error.message}
            </p>
          )}
        </div>
        <div className="health-section">
          <div className="row between">
            <h3>
              <Scale size={17} />
              Latest weight
            </h3>
            <button
              className="text-button"
              onClick={() => setDialog({ kind: "weight", history: true })}
            >
              History
            </button>
          </div>
          <p className="health-value">
            {data.weight
              ? number(fromKilograms(data.weight.weightKg, weightUnit)) +
                " " +
                weightUnit
              : "Not logged yet"}
          </p>
          {data.weight && (
            <p className="muted text-small">
              Recorded {formatDate(localDate(data.weight.measuredAt, timezone))}
            </p>
          )}
          <button
            className="button"
            onClick={() => setDialog({ kind: "weight", history: false })}
          >
            Log weight
          </button>
        </div>
        <div className="health-section">
          <div className="row between">
            <h3>
              <Utensils size={17} />
              Food today
            </h3>
            <Link href="/food" className="text-small">
              Log food
            </Link>
          </div>
          {data.nutrition.count ? (
            <>
              <p className="health-value">
                <NutrientValue
                  total={data.nutrition.totals.calories}
                  unit="kcal"
                />
              </p>
              <p className="muted text-small">
                Protein:{" "}
                <NutrientValue
                  total={data.nutrition.totals.proteinG}
                  unit="g"
                />
              </p>
            </>
          ) : (
            <p className="muted text-small">No food logged yet.</p>
          )}
        </div>
        <div className="health-section">
          <h3>
            <Dumbbell size={17} />
            Movement
          </h3>
          <div className="movement-recent">
            {data.lastWorkout && (
              <p className="text-small">
                <Link href={"/exercise/workout/" + data.lastWorkout.id}>
                  {data.lastWorkout.title}
                </Link>
                <small>
                  {formatDate(localDate(data.lastWorkout.startedAt, timezone))}{" "}
                  · Strength
                </small>
              </p>
            )}
            {data.lastCardio && (
              <p className="text-small">
                {data.lastCardio.title}
                <small>
                  {formatDate(localDate(data.lastCardio.startedAt, timezone))} ·{" "}
                  {data.lastCardio.activityType}
                </small>
              </p>
            )}
            {!data.lastWorkout && !data.lastCardio && (
              <p className="muted text-small">
                No completed activity logged yet.
              </p>
            )}
          </div>
          <Link className="button" href="/exercise">
            Log a workout or cardio
          </Link>
        </div>
      </section>
      {dialog && (
        <Dialog
          title={
            (dialog.history ? "Your " : "Log ") +
            dialog.kind +
            (dialog.history ? " history" : "")
          }
          onClose={() => setDialog(null)}
        >
          {dialog.history ? (
            <MeasurementHistory kind={dialog.kind} />
          ) : (
            <MeasurementForm
              kind={dialog.kind}
              onSaved={() => setDialog(null)}
            />
          )}
        </Dialog>
      )}
    </>
  );
}
