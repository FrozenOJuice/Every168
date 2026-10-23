import { FitnessProgressPage } from "@/features/fitness/progress-overview";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  return <FitnessProgressPage date={date} />;
}
