"use client";
import { useState } from "react";
import {
  AccountEmailForm,
  AccountLinkForm,
} from "@/features/identity/account-security-forms";
import { useHydrated } from "@/lib/use-hydrated";
export default function Page() {
  return useHydrated() ? <VerificationChoice /> : null;
}
function VerificationChoice() {
  const [linked] = useState(() => !!window.location.hash);
  return linked === null ? null : linked ? (
    <AccountLinkForm verification />
  ) : (
    <AccountEmailForm verification />
  );
}
