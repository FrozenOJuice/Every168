import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, createClient } from "@168hours/api-client";
import { AppShell } from "@/components/app-shell";
export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const client = createClient({
    baseUrl: process.env.API_URL ?? "http://127.0.0.1:3001",
    headers: {
      cookie: (await cookies()).toString(),
      "x-168hours-session-refresh": "skip",
    },
  });
  let me;
  try {
    me = await client.getCurrentUser();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login");
    throw error;
  }
  return <AppShell me={me}>{children}</AppShell>;
}
