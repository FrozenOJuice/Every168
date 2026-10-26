export function formatRestDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [
    hours ? `${hours}h` : "",
    minutes ? `${minutes}m` : "",
    remainder || (!hours && !minutes) ? `${remainder}s` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function formatFitnessDuration(
  seconds: number,
  unit: import("@168hours/domain-utils").DurationUnit = "min_sec",
) {
  if (unit === "min_sec") return formatRestDuration(seconds);
  const divisor = unit === "h" ? 3600 : unit === "min" ? 60 : 1;
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(seconds / divisor)} ${unit}`;
}
