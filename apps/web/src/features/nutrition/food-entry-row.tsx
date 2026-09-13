import type { FoodEntryDetail } from "@168hours/contracts";
import { localDate } from "@168hours/domain-utils";
import { formatDate, formatTime, number } from "@/lib/format";

export function FoodEntryRow({
  entry,
  timezone,
  showDate = false,
  children,
}: {
  entry: FoodEntryDetail;
  timezone: string;
  showDate?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="food-entry-row">
      <div className="food-entry-detail">
        <strong>{entry.nameSnapshot}</strong>
        <small>
          {showDate &&
            formatDate(localDate(entry.consumedAt, timezone), {
              month: "short",
              day: "numeric",
              year: "numeric",
            }) + " · "}
          {formatTime(entry.consumedAt, timezone)} · {number(entry.quantity, 3)}{" "}
          × {number(entry.servingAmountSnapshot, 3)} {entry.servingUnitSnapshot}
        </small>
        <span className="food-entry-nutrients">
          Energy:{" "}
          {entry.nutrition.calories.value === null
            ? "unknown"
            : number(entry.nutrition.calories.value) + " kcal"}{" "}
          · Protein:{" "}
          {entry.nutrition.proteinG.value === null
            ? "unknown"
            : number(entry.nutrition.proteinG.value) + " g"}
        </span>
      </div>
      <div className="row food-entry-actions">{children}</div>
    </li>
  );
}
