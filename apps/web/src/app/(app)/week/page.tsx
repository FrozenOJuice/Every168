import { WeekPage } from "@/features/planning/week-page";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; add?: string }>;
}) {
  const params = await searchParams;
  return <WeekPage date={params.date} add={params.add === "1"} />;
}
