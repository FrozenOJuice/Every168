import { redirect } from "next/navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; add?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (typeof params.date === "string") query.set("date", params.date);
  if (params.add === "1") query.set("add", "1");
  redirect("/" + (query.size ? "?" + query.toString() : ""));
}
