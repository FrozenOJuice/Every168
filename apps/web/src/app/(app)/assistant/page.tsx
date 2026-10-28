import { notFound } from "next/navigation";
import { features } from "@/lib/release";
import { AssistantWorkspace } from "@/features/assistant/assistant-preview";
export default function Page() {
  if (!features.assistant) notFound();
  return <AssistantWorkspace />;
}
