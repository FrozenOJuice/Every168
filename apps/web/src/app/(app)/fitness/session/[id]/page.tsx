import { SessionPage } from "@/features/fitness/session-editor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <SessionPage id={(await params).id} />;
}
