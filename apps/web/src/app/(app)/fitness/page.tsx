import { FitnessPage } from "@/features/fitness/fitness-page";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  return <FitnessPage tab={(await searchParams).tab} />;
}
