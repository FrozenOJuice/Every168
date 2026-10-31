"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandLink } from "@/components/brand";
import { z } from "zod";
import {
  accountEmailInput,
  authInput,
  changePasswordInput,
} from "@168hours/contracts";
import { api } from "@/lib/api";
import { Field, Form, Submit, useZodForm } from "@/components/ui/form";
export function AccountEmailForm({
  verification = false,
}: {
  verification?: boolean;
}) {
  const form = useZodForm(accountEmailInput, { email: "" });
  const [sent, setSent] = useState(false);
  return (
    <main className="account-access-page">
      <section className="auth-card">
        <BrandLink />
        <h1>{verification ? "Verify your email" : "Reset your password"}</h1>
        <Form
          form={form}
          retrySafe={false}
          onSubmit={async ({ email }) => {
            if (verification) await api.sendVerificationEmail(email);
            else await api.requestPasswordReset(email);
            setSent(true);
          }}
        >
          <Field name="email" label="Email" type="email" autoComplete="email" />
          <Submit>
            {verification ? "Send verification email" : "Send reset email"}
          </Submit>
        </Form>
        {sent && (
          <p role="status">
            If this address needs an email, we’ll send one. Check your inbox and
            spam folder. You can request another after a minute.
          </p>
        )}
        <Link href="/login">Back to sign in</Link>
      </section>
    </main>
  );
}
export function AccountLinkForm({
  verification = false,
}: {
  verification?: boolean;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const read = useRef(false);
  const schema = z.object({
    newPassword: verification ? z.string() : authInput.shape.password,
  });
  const form = useZodForm(schema, { newPassword: "" });
  useEffect(() => {
    if (read.current) return;
    read.current = true;
    const value = new URLSearchParams(window.location.hash.slice(1)).get(
      "token",
    );
    setToken(value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : "");
    // The credential remains only in mounted memory; never in browser storage or query strings.
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname,
    );
  }, []);
  return (
    <main className="account-access-page">
      <section className="auth-card">
        <BrandLink />
        <h1>{verification ? "Verify your email" : "Choose a new password"}</h1>
        {done ? (
          <p role="status">
            {verification
              ? "Email verified. You can sign in now."
              : "Password reset. Sign in with your new password."}
          </p>
        ) : token === null ? (
          <p>Loading…</p>
        ) : !token ? (
          <p role="alert">
            Open the link from your email, or request a new one.
          </p>
        ) : (
          <Form
            form={form}
            retrySafe={false}
            onSubmit={async (values) => {
              if (verification) await api.verifyEmail(token);
              else await api.resetPassword(token, values.newPassword);
              setToken("");
              setDone(true);
            }}
          >
            {!verification && (
              <Field
                name="newPassword"
                label="New password"
                type="password"
                autoComplete="new-password"
                help="Use 12–128 characters."
              />
            )}
            <Submit>{verification ? "Verify email" : "Reset password"}</Submit>
          </Form>
        )}
        <p>
          <Link href="/login">Back to sign in</Link>
        </p>
        {!done && (
          <Link href={verification ? "/verify-email" : "/forgot-password"}>
            {verification
              ? "Request verification email"
              : "Request reset email"}
          </Link>
        )}
      </section>
    </main>
  );
}
export function ChangePasswordForm() {
  const form = useZodForm(changePasswordInput, {
    currentPassword: "",
    newPassword: "",
  });
  return (
    <section className="panel">
      <h2>Change password</h2>
      <p>Changing your password signs out every session, including this one.</p>
      <Form
        form={form}
        retrySafe={false}
        onSubmit={async (input) => {
          await api.changePassword(input.currentPassword, input.newPassword);
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Revoke account caches after credential changes.
          window.location.assign("/login");
        }}
      >
        <Field
          name="currentPassword"
          label="Current password"
          type="password"
          autoComplete="current-password"
        />
        <Field
          name="newPassword"
          label="New password"
          type="password"
          autoComplete="new-password"
          help="Use 12–128 characters."
        />
        <Submit>Change password</Submit>
      </Form>
    </section>
  );
}
