"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { localDate, addDays } from "@168hours/domain-utils";
import { dateSchema, type Food, type FoodEntry } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import {
  PageHeading,
  Loading,
  ErrorState,
  Empty,
} from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/dialog";
import { formatTime, formatDate } from "@/lib/format";
import { FoodForm } from "./food-form";
import { FoodEntryForm } from "./food-entry-form";
import { FoodLibrary } from "./food-library";
import { NutritionSummary } from "./nutrition-totals";
type Editor =
  | { kind: "food"; food?: Food }
  | { kind: "entry"; food?: Food; entry?: FoodEntry; repeat?: boolean };
export function FoodPage({ date }: { date?: string }) {
  const {
    preferences: { timezone },
  } = useMe();
  const router = useRouter();
  const selected = dateSchema.safeParse(date).success
    ? date!
    : localDate(new Date(), timezone);
  const [tab, setTab] = useState<"log" | "library">("log");
  const [editor, setEditor] = useState<Editor | null>(null);
  const daily = useQuery({
    queryKey: ["nutrition", selected, timezone],
    queryFn: () => api.getNutritionDaily(selected),
  });
  const cache = useQueryClient();
  const remove = useMutation({
    mutationFn: api.deleteFoodEntry,
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["nutrition"] });
      await cache.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  return (
    <>
      <PageHeading
        eyebrow="Everyday nourishment"
        title="Food"
        description="A simple log of what you ate, with the details you know."
      >
        <div className="row">
          <button
            className="button"
            onClick={() => setEditor({ kind: "food" })}
          >
            Add food
          </button>
          <button
            className="button primary"
            onClick={() => setEditor({ kind: "entry" })}
          >
            Log food
          </button>
        </div>
      </PageHeading>
      <div className="tabs">
        <button aria-pressed={tab === "log"} onClick={() => setTab("log")}>
          Daily log
        </button>
        <button
          aria-pressed={tab === "library"}
          onClick={() => setTab("library")}
        >
          Food library
        </button>
      </div>
      {tab === "library" ? (
        <FoodLibrary
          onEdit={(food) => setEditor({ kind: "food", food })}
          onLog={(food) => setEditor({ kind: "entry", food })}
        />
      ) : (
        <div className="stack">
          <div className="row date-toolbar">
            <Link
              className="button"
              href={"/food?date=" + addDays(selected, -1)}
              aria-label="Previous day"
            >
              ←
            </Link>
            <div className="field">
              <label htmlFor="food-date">Log date</label>
              <input
                id="food-date"
                type="date"
                value={selected}
                onChange={(e) => {
                  if (e.target.value)
                    router.push("/food?date=" + e.target.value);
                }}
              />
            </div>
            <Link
              className="button"
              href={"/food?date=" + addDays(selected, 1)}
              aria-label="Next day"
            >
              →
            </Link>
            <Link className="button" href="/food">
              Today
            </Link>
          </div>
          {daily.isPending ? (
            <Loading />
          ) : daily.error ? (
            <ErrorState
              error={daily.error}
              retry={() => void daily.refetch()}
            />
          ) : (
            <>
              <NutritionSummary
                totals={daily.data.totals}
                count={daily.data.count}
              />
              <section className="panel">
                <h2>
                  {formatDate(selected, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </h2>
                {!daily.data.entries.length ? (
                  <Empty>
                    Nothing logged yet. Add a food to your library, then log a
                    serving.
                  </Empty>
                ) : (
                  (
                    ["breakfast", "lunch", "dinner", "snack", "other"] as const
                  ).map((meal) => {
                    const entries = daily.data.entries.filter(
                      (e) => e.mealType === meal,
                    );
                    return (
                      entries.length > 0 && (
                        <div key={meal} className="meal-section">
                          <h3>{meal}</h3>
                          <ul className="record-list">
                            {entries.map((e) => (
                              <li key={e.id}>
                                <div>
                                  <strong>{e.nameSnapshot}</strong>
                                  <small>
                                    {formatTime(e.consumedAt, timezone)} ·{" "}
                                    {e.quantity} × {e.servingAmountSnapshot}{" "}
                                    {e.servingUnitSnapshot} ·{" "}
                                    {e.caloriesSnapshot} kcal/serving
                                  </small>
                                </div>
                                <div className="row">
                                  <button
                                    className="button"
                                    onClick={() =>
                                      setEditor({
                                        kind: "entry",
                                        entry: e,
                                        repeat: true,
                                      })
                                    }
                                  >
                                    Log again
                                  </button>
                                  <button
                                    className="button"
                                    onClick={() =>
                                      setEditor({ kind: "entry", entry: e })
                                    }
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="button danger"
                                    disabled={remove.isPending}
                                    onClick={() => {
                                      if (confirm("Delete this food entry?"))
                                        remove.mutate(e.id);
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    );
                  })
                )}
              </section>
            </>
          )}
          {remove.error && (
            <p role="alert" className="error">
              {remove.error.message}
            </p>
          )}
        </div>
      )}
      {editor && (
        <Dialog
          title={
            editor.kind === "food"
              ? editor.food
                ? "Edit food"
                : "Add food"
              : editor.entry && !editor.repeat
                ? "Edit food entry"
                : "Log food"
          }
          onClose={() => setEditor(null)}
        >
          {editor.kind === "food" ? (
            <FoodForm food={editor.food} onSaved={() => setEditor(null)} />
          ) : (
            <FoodEntryForm
              {...editor}
              date={selected}
              onSaved={() => {
                setEditor(null);
                setTab("log");
              }}
            />
          )}
        </Dialog>
      )}
    </>
  );
}
