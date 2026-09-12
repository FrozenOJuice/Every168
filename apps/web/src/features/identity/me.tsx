"use client";
import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Me } from "@168hours/contracts";
import { api } from "@/lib/api";
const Context = createContext<Me | null>(null);
export function MeProvider({
  me,
  children,
}: {
  me: Me;
  children: React.ReactNode;
}) {
  return <Context value={me}>{children}</Context>;
}
export function useMe() {
  const initial = useContext(Context);
  if (!initial) throw new Error("Authenticated layout required");
  return useQuery({
    queryKey: ["me"],
    queryFn: api.getCurrentUser,
    initialData: initial,
  }).data;
}
