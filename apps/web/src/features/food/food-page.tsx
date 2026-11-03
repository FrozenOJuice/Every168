"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Plus,
  SlidersHorizontal,
  Utensils,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  type CalendarActivity,
  type Food,
  type CatalogueFood,
  type FoodEntry,
  type FoodEntryDetail,
  type Water,
  type Weight,
} from "@168hours/contracts";
import { localDate } from "@168hours/domain-utils";
import { canNavigateAway } from "@/lib/use-unsaved-changes";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { ErrorState, Loading, PageHeading } from "@/components/ui/feedback";
import { WaterPanel } from "@/features/measurements/water-panel";
import { WeightPanel } from "@/features/measurements/weight-panel";
import { MeasurementForm } from "@/features/measurements/measurement-form";
import { MeasurementHistory } from "@/features/measurements/measurement-history";
import { FoodDialog } from "./food-shared";
import { Dialog } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { DomainDayPanel } from "@/features/workspace/domain-day-panel";
import { useDomainDay } from "@/features/workspace/domain-day-context";
import { FoodEditor } from "./food-editor";
import { PreparationEditor } from "./preparation-editor";
import { FoodLog } from "./food-log";
import { FoodLibrary } from "./food-library";
import { FoodNutrition, NutritionGoalsEditor } from "./food-nutrition";
import { FoodEntries, FoodHistory } from "./food-entries";
import { FoodWriteProvider, useFoodWritePending } from "./food-write-provider";

type Modal =
  | { type: "editFood"; kind: Food["kind"]; food?: Food }
  | { type: "entry"; id: string }
  | {
      type: "log";
      food?: Food;
      catalogue?: CatalogueFood;
      entry?: FoodEntry;
      repeat?: boolean;
      mealType?: FoodEntry["mealType"];
    }
  | { type: "measurement"; kind: "water" | "weight"; item?: Water | Weight }
  | { type: "measurementHistory"; kind: "water" | "weight" };
const foodSections = [
  ["food", "Foods"],
  ["recipe", "Recipes"],
  ["meal", "Saved Meals"],
] as const;
export function FoodPage() {
  const { user } = useMe();
  return (
    <FoodWriteProvider key={user.id}>
      <FoodWorkspace />
    </FoodWriteProvider>
  );
}
function FoodWorkspace() {
  const writePending = useFoodWritePending();
  const {
    preferences: { timezone },
  } = useMe();
  const params = useSearchParams();
  const router = useRouter();
  const today = localDate(new Date(), timezone);
  const { date } = useDomainDay();
  const selected = params.get("view") ?? "day";
  const view =
    selected === "history" ||
    selected === "targets" ||
    foodSections.some(([v]) => v === selected)
      ? selected
      : "day";
  const myFoods = foodSections.some(([v]) => v === view);
  const [dayOpen, setDayOpen] = useState(false);
  const [dayBusy, setDayBusy] = useState(false);
  const [modal, setModal] = useState<Modal | null>(null);
  const url = (nextView = view, nextDate = date) =>
    `/food?view=${nextView}&date=${nextDate}`;
  const q = useQuery({
    queryKey: ["nutrition", "daily", date, timezone],
    queryFn: () => api.getNutritionDaily(date),
    enabled: view === "day",
  });
  const actions = {
    onEdit: (entry: FoodEntryDetail) => setModal({ type: "log", entry }),
    onRepeat: (entry: FoodEntryDetail) =>
      setModal({ type: "log", entry, repeat: true }),
  };
  const logged = (entry: FoodEntry) => {
    setModal(null);
    const savedDate = localDate(entry.consumedAt, timezone);
    if (view !== "day" || date !== savedDate)
      router.push(url("day", savedDate));
  };
  const openLog = async () => {
    if (writePending || !(await canNavigateAway())) return;
    setDayOpen(false);
    setModal({ type: "log" });
  };
  const openActivity = async (activity: CalendarActivity) => {
    if (writePending || !(await canNavigateAway())) return;
    setDayOpen(false);
    if (activity.source.type === "food_entry")
      setModal({ type: "entry", id: activity.source.id });
    else if (["water_entry", "weight_entry"].includes(activity.source.type))
      router.push(
        url("day") +
          (activity.source.type === "water_entry"
            ? "#food-water"
            : "#food-weight"),
      );
    else router.push(activity.href);
  };
  const dayPanel = (
    <DomainDayPanel
      domain="Food"
      onBusyChange={setDayBusy}
      sources={["food_entry", "water_entry", "weight_entry"]}
      sourceLabels={["Food", "Water", "Weight"]}
      date={date}
      onDate={(value) => router.push(url(view, value))}
      action={{ label: "Add food", onClick: openLog }}
      onActivity={openActivity}
      onCalendar={() => router.push(`/?date=${date}&view=day`)}
    />
  );
  return (
    <div className="food-workspace domain-workspace">
      <div className="food-main domain-main">
        <h1 className="sr-only">Food</h1>
        <div className="domain-workspace-tools">
          <nav className="food-nav" aria-label="Food navigation">
            {(
              [
                ["day", "Today"],
                ["food", "Library"],
              ] as const
            ).map(([v, label]) => (
              <Link
                key={v}
                href={url(v)}
                aria-current={
                  (v === "food" ? myFoods : !myFoods) ? "page" : undefined
                }
              >
                {label}
              </Link>
            ))}
          </nav>
          <button
            className="button domain-mobile-day"
            disabled={writePending}
            onClick={() => setDayOpen(true)}
            aria-haspopup="dialog"
          >
            <CalendarDays size={17} aria-hidden="true" />
            Day
          </button>
        </div>
        <div className="food-content">
          {view === "targets" ? (
            <section
              className="food-target-editor form-stack"
              aria-label="Nutrition targets"
            >
              <Link className="food-editor-back" href={url("day")}>
                <ArrowLeft size={18} aria-hidden="true" />
                Back to Today
              </Link>
              <PageHeading
                level={2}
                title="Nutrition targets"
                description="Choose your daily targets. Leave a field blank to track without a target."
              />
              <NutritionGoalsEditor
                onSaved={() => router.push(url("day"))}
                onCancel={() => router.push(url("day"))}
              />
            </section>
          ) : view === "day" ? (
            <div className="food-daily-grid">
              <div className="food-daily-main">
                <section className="food-daily-section">
                  <div className="food-section-heading">
                    <div>
                      <h2>
                        {date === today
                          ? "Today’s nutrition"
                          : `Nutrition for ${formatDate(date, { month: "short", day: "numeric", year: "numeric" })}`}
                      </h2>
                    </div>
                    <div className="food-log-actions">
                      <Link
                        className="button"
                        href={url("targets")}
                        aria-label="Edit nutrition targets"
                      >
                        <SlidersHorizontal size={17} aria-hidden="true" />
                        Targets
                      </Link>
                      <button
                        className="button primary"
                        disabled={writePending}
                        onClick={() => setModal({ type: "log" })}
                      >
                        <Plus size={17} aria-hidden="true" /> Log food
                      </button>
                    </div>
                  </div>
                  {q.isPending ? (
                    <Loading />
                  ) : q.error ? (
                    <ErrorState
                      error={q.error}
                      retry={() => void q.refetch()}
                    />
                  ) : (
                    <>
                      <FoodNutrition daily={q.data} />
                      {q.data.entries.length ? (
                        <>
                          <div className="food-log-heading">
                            <h2>Food log</h2>
                            <span>
                              {q.data.entries.length}{" "}
                              {q.data.entries.length === 1
                                ? "entry"
                                : "entries"}
                            </span>
                          </div>
                          <FoodEntries entries={q.data.entries} {...actions} />
                        </>
                      ) : (
                        <>
                          <div className="food-empty">
                            <Utensils size={28} aria-hidden="true" />
                            <h3>Start with something you ate</h3>
                            <p>No food recorded for this day.</p>
                            <p className="muted">
                              Choose a saved food, meal or recipe, or make a
                              quick entry without tracking nutrition.
                            </p>
                          </div>
                        </>
                      )}
                    </>
                  )}
                  <div className="food-log-tools">
                    <Link className="text-button" href={url("history")}>
                      Search past entries
                    </Link>
                  </div>
                </section>
              </div>
              <aside
                className="food-measurements"
                aria-label="Water and weight"
              >
                <WaterPanel
                  date={date}
                  onLog={() => setModal({ type: "measurement", kind: "water" })}
                  onEdit={(item) =>
                    setModal({ type: "measurement", kind: "water", item })
                  }
                  onHistory={() =>
                    setModal({ type: "measurementHistory", kind: "water" })
                  }
                />
                <WeightPanel
                  date={date}
                  onLog={() =>
                    setModal({ type: "measurement", kind: "weight" })
                  }
                  onEdit={(item) =>
                    setModal({ type: "measurement", kind: "weight", item })
                  }
                  onHistory={() =>
                    setModal({ type: "measurementHistory", kind: "weight" })
                  }
                />
              </aside>
            </div>
          ) : view === "history" ? (
            <div className="form-stack">
              <Link className="text-button" href={url("day")}>
                Back to Today
              </Link>
              <p className="muted">
                Copy an entry to{" "}
                {formatDate(date, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
                , or choose another time when logging.
              </p>
              <FoodHistory {...actions} />
            </div>
          ) : (
            <div className="food-saved-area form-stack">
              <div>
                <h2>Library</h2>
                <p className="muted">
                  Keep the foods, drinks and meals you use again.
                </p>
              </div>
              <nav className="food-sections" aria-label="Library sections">
                {foodSections.map(([kind, label]) => (
                  <Link
                    key={kind}
                    href={url(kind)}
                    aria-current={view === kind ? "page" : undefined}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
              <FoodLibrary
                key={view}
                kind={view as Food["kind"]}
                onCreate={() =>
                  setModal({ type: "editFood", kind: view as Food["kind"] })
                }
                onEdit={(food) =>
                  setModal({ type: "editFood", kind: food.kind, food })
                }
                onCatalogue={(catalogue) =>
                  setModal({ type: "log", catalogue })
                }
                onLog={(food) => setModal({ type: "log", food })}
              />
            </div>
          )}
        </div>
      </div>
      <aside className="domain-calendar-rail" aria-label="Food day panel">
        {dayPanel}
      </aside>
      {dayOpen && (
        <Dialog
          title="Your day"
          busy={dayBusy}
          onClose={() => setDayOpen(false)}
        >
          {dayPanel}
        </Dialog>
      )}
      {modal && (
        <FoodDialog
          title={
            modal.type === "entry"
              ? "Edit food entry"
              : modal.type === "editFood"
                ? `${modal.food ? "Edit" : "Create"} ${modal.kind}`
                : modal.type === "log"
                  ? modal.entry && !modal.repeat
                    ? "Edit food entry"
                    : modal.repeat
                      ? "Copy food entry"
                      : "Log food"
                  : `${modal.kind === "water" ? "Water" : "Weight"}${modal.type === "measurementHistory" ? " history" : " entry"}`
          }
          onClose={() => setModal(null)}
        >
          {modal.type === "entry" ? (
            <RecordedFood id={modal.id} date={date} onSaved={logged} />
          ) : modal.type === "editFood" ? (
            modal.kind === "food" ? (
              <FoodEditor item={modal.food} onSaved={() => setModal(null)} />
            ) : (
              <PreparationEditor
                kind={modal.kind}
                item={modal.food}
                onSaved={() => setModal(null)}
              />
            )
          ) : modal.type === "log" ? (
            <FoodLog
              date={date}
              initialFood={modal.food}
              initialCatalogue={modal.catalogue}
              initialMeal={modal.mealType}
              entry={modal.entry}
              repeat={modal.repeat}
              onSaved={logged}
            />
          ) : modal.type === "measurementHistory" ? (
            <MeasurementHistory kind={modal.kind} through={date} />
          ) : (
            <MeasurementForm
              kind={modal.kind}
              item={modal.item}
              date={date}
              onSaved={(item) => {
                setModal(null);
                router.push(
                  url(
                    "day",
                    localDate(
                      "consumedAt" in item ? item.consumedAt : item.measuredAt,
                      timezone,
                    ),
                  ),
                );
              }}
            />
          )}
        </FoodDialog>
      )}
    </div>
  );
}

function RecordedFood({
  id,
  date,
  onSaved,
}: {
  id: string;
  date: string;
  onSaved: (entry: FoodEntry) => void;
}) {
  const q = useQuery({
    queryKey: ["food", "entry", id],
    queryFn: () => api.getFoodEntry(id),
  });
  return q.isPending ? (
    <Loading />
  ) : q.error ? (
    <ErrorState error={q.error} retry={() => void q.refetch()} />
  ) : (
    <FoodLog date={date} entry={q.data} onSaved={onSaved} />
  );
}
