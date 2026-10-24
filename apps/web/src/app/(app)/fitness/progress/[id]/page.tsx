import { redirect } from "next/navigation";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { id } = await params;
  const { mode } = await searchParams;
  redirect(
    `/fitness/exercises/${encodeURIComponent(id)}${mode ? `?mode=${encodeURIComponent(mode)}` : ""}`,
  );
}
