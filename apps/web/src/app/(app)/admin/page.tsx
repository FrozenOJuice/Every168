import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@168hours/api-client";
import { AdminPage } from "@/features/admin/admin-page";
export default async function Page() {
  const client = createClient({
    baseUrl: process.env.API_URL ?? "http://127.0.0.1:3001",
    headers: {
      cookie: (await cookies()).toString(),
      "x-168hours-session-refresh": "skip",
    },
  });
  const me = await client.getCurrentUser();
  if (me.user.accountType !== "admin") redirect("/");
  return <AdminPage />;
}
