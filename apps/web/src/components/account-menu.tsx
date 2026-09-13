"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronUp, LogOut, Settings } from "lucide-react";
import type { Me } from "@168hours/contracts";
import { api } from "@/lib/api";

export function AccountMenu({ user }: { user: Me["user"] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const cache = useQueryClient();
  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await api.signOut();
      cache.clear();
      // Clear the document and router cache across account changes.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign out failed");
      setBusy(false);
    }
  }
  return (
    <div
      className="account-menu"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        className="account-trigger"
        aria-label="Account menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="avatar" aria-hidden="true">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="account-name">
          <strong>{user.name}</strong>
          <small>Personal account</small>
        </span>
        <ChevronUp size={16} aria-hidden="true" />
      </button>
      <div className="account-popover" id={id} hidden={!open}>
        <div className="account-identity">
          <strong>{user.name}</strong>
          <small>{user.email}</small>
        </div>
        <Link href="/settings" onClick={() => setOpen(false)}>
          <Settings size={18} aria-hidden="true" />
          Settings
        </Link>
        <button disabled={busy} onClick={() => void signOut()}>
          <LogOut size={18} aria-hidden="true" />
          {busy ? "Signing out…" : "Sign out"}
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
