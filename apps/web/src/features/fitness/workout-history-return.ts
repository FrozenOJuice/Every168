import { dateSchema } from "@168hours/contracts";
export function historyHref(search: string, date?: string | null) {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim().slice(0, 160));
  if (date && dateSchema.safeParse(date).success) params.set("date", date);
  return `/fitness/history${params.size ? `?${params}` : ""}`;
}
export function parseHistoryReturn(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    value.length > 1500 ||
    !value.startsWith("/fitness/history")
  )
    return;
  const url = new URL(value, "https://168hours.invalid");
  if (
    url.origin !== "https://168hours.invalid" ||
    url.pathname !== "/fitness/history"
  )
    return;
  return historyHref(
    url.searchParams.get("search") ?? "",
    url.searchParams.get("date"),
  );
}
