"use client";
import { useState } from "react";
import Link from "next/link";
import { BrandLink } from "@/components/brand";
import { ApiError } from "@168hours/api-client";
import { authInput } from "@168hours/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Field, Form, Submit, useZodForm } from "@/components/ui/form";
export function AuthForm({ signUp = false }: { signUp?: boolean }) {
  const form = useZodForm(authInput, {
    name: signUp ? "" : "Member",
    email: "",
    password: "",
  });
  const cache = useQueryClient();
  const [registered, setRegistered] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(true);
  return (
    <main className="auth-page">
      <div className="auth-intro">
        <BrandLink />
        <p className="eyebrow">Make room for what matters</p>
        <h1>
          Your week.
          <br />
          With intention.
        </h1>
        <p>
          Plan your time, record the everyday, and find a rhythm that works for
          you.
        </p>
        <div className="week-mark" aria-hidden="true">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <p className="muted">Every week. Room for what matters.</p>
      </div>
      <section className="auth-card">
        <h2>{signUp ? "Create your account" : "Welcome back"}</h2>
        {registered && (
          <p role="status" className="success">
            {verificationRequired
              ? "Check your email to verify your account before signing in. If you already have an account, sign in or reset your password."
              : "You can now sign in with your email and password."}
          </p>
        )}
        <Form
          retrySafe={false}
          form={form}
          onSubmit={async (input) => {
            if (signUp) {
              const result = await api.signUp(input);
              setVerificationRequired(result.verificationRequired);
              setRegistered(true);
              form.reset();
              return;
            }
            setNeedsVerification(false);
            try {
              await api.signIn(input);
            } catch (error) {
              setNeedsVerification(
                error instanceof ApiError &&
                  error.code === "EMAIL_NOT_VERIFIED",
              );
              throw error;
            }
            cache.clear();
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Clear the document and router cache across account changes.
            window.location.assign("/");
          }}
        >
          {signUp && <Field name="name" label="Name" autoComplete="name" />}
          <Field name="email" label="Email" type="email" autoComplete="email" />
          <Field
            name="password"
            label="Password"
            type="password"
            autoComplete={signUp ? "new-password" : "current-password"}
            help="Use 12–128 characters."
          />
          <Submit>{signUp ? "Create account" : "Sign in"}</Submit>
        </Form>
        {(!signUp || (registered && verificationRequired)) && (
          <div className="auth-assistance">
            {!signUp && <Link href="/forgot-password">Forgot password?</Link>}
            {(needsVerification || (registered && verificationRequired)) && (
              <Link href="/verify-email">Resend verification email</Link>
            )}
          </div>
        )}
        <div className="auth-switch">
          <Link className="button" href={signUp ? "/login" : "/signup"}>
            {signUp ? "Sign in" : "Create an account"}
          </Link>
        </div>
      </section>
    </main>
  );
}
