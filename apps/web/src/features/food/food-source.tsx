import type { FoodSource } from "@168hours/contracts";
export function FoodSourceNote({ source }: { source?: FoodSource | null }) {
  if (!source) return null;
  return (
    <p className="muted text-small">
      {source.modified ? "Adapted from " : "Source: "}
      <a
        href="https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/canadian-nutrient-file-about-us.html"
        target="_blank"
        rel="noreferrer"
      >
        Health Canada · Canadian Nutrient File {source.release}
      </a>{" "}
      · Food {source.code}
    </p>
  );
}
