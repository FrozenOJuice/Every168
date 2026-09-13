import type { NutritionTotals } from "@168hours/contracts";
import { number } from "@/lib/format";
export function NutrientValue({
  total,
  unit,
}: {
  total: { value: number | null; unknownCount: number };
  unit: string;
}) {
  return (
    <>
      {total.value === null ? "Unknown" : number(total.value) + " " + unit}
      {total.unknownCount > 0 && (
        <small>
          {" "}
          + unknown from {total.unknownCount} item
          {total.unknownCount === 1 ? "" : "s"}
        </small>
      )}
    </>
  );
}
export function NutritionSummary({
  totals,
  count,
}: {
  totals: NutritionTotals;
  count: number;
}) {
  return (
    <section className="panel" aria-label="Daily nutrition">
      <h2>Daily nutrition</h2>
      {count === 0 ? (
        <p className="muted text-small">No food logged for this day yet.</p>
      ) : (
        <div className="nutrition-grid">
          {(
            [
              ["calories", "Calories", "kcal"],
              ["proteinG", "Protein", "g"],
              ["carbsG", "Carbs", "g"],
              ["fatG", "Fat", "g"],
              ["fiberG", "Fibre", "g"],
            ] as const
          ).map(([key, label, unit]) => (
            <div key={key}>
              <span>{label}</span>
              <strong>
                <NutrientValue total={totals[key]} unit={unit} />
              </strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
