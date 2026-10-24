"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { QueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/dialog";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
const Context = createContext<(dirty: boolean, busy: boolean) => void>(
  () => {},
);
export function useTaskForm(dirty: boolean, busy: boolean) {
  const report = useContext(Context);
  useEffect(() => {
    report(dirty, busy);
    return () => report(false, false);
  }, [dirty, busy, report]);
}
export function TaskDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [form, setForm] = useState({ dirty: false, busy: false });
  const [report] = useState(
    () => (dirty: boolean, busy: boolean) => setForm({ dirty, busy }),
  );
  useUnsavedChanges(
    form.dirty || form.busy,
    "Leave without saving your task changes?",
  );
  return (
    <Dialog
      title={title}
      onClose={() => {
        if (!form.busy && (!form.dirty || confirm("Discard unsaved changes?")))
          onClose();
      }}
    >
      <Context.Provider value={report}>{children}</Context.Provider>
    </Dialog>
  );
}
export async function invalidateTasks(cache: QueryClient) {
  await Promise.all(
    ["tasks", "week", "calendar-activity", "calendar-search", "dashboard"].map(
      (key) => cache.invalidateQueries({ queryKey: [key] }),
    ),
  );
}
export function FieldError({ message }: { message?: string }) {
  return message ? <span className="error text-small">{message}</span> : null;
}
