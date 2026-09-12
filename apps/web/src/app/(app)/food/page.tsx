import { FoodPage } from "@/features/nutrition/food-page";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  return <FoodPage date={(await searchParams).date} />;
}
