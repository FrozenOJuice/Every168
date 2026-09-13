import { FoodPage } from "@/features/nutrition/food-page";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; tab?: string }>;
}) {
  const params = await searchParams;
  return <FoodPage date={params.date} section={params.tab} />;
}
