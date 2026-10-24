import { FitnessHistoryPage } from "@/features/fitness/progress-overview";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  return <FitnessHistoryPage date={(await searchParams).date} />;
}
