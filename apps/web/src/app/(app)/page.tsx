import { CalendarPage } from "@/features/planning/calendar-page";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    view?: string;
    add?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <CalendarPage
      initialNow={new Date().toISOString()}
      date={params.date}
      view={params.view}
      add={params.add === "1"}
    />
  );
}
