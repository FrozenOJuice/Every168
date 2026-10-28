import { notFound } from "next/navigation";
import { features } from "@/lib/release";
import { FoodPage } from "@/features/food/food-page";
export default function Page() {
  if (!features.food) notFound();
  return <FoodPage />;
}
