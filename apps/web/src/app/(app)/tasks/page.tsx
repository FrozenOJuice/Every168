import { notFound } from "next/navigation";
import { features } from "@/lib/release";
import { TasksPage } from "@/features/tasks/tasks-page";
export default function Page() {
  if (!features.tasks) notFound();
  return <TasksPage />;
}
