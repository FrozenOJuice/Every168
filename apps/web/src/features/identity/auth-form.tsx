"use client";
import { useState } from "react";
import Link from "next/link";
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
  return (
    <div className="auth-page">
      <div className="auth-intro">
        <Link href="/" className="brand">
          168<span>Hours</span>
        </Link>
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
        <p className="muted">168 hours. Yours to spend.</p>
      </div>
      <section className="auth-card">
        <h2>{signUp ? "Create your account" : "Welcome back"}</h2>
        <p className="muted">
          {signUp
            ? "A fresh page for your next week."
            : "Pick up where you left off."}
        </p>
        {registered && (
          <p role="status" className="success">
            Check your email to verify your account before signing in. If you
            already have an account, sign in or reset your password.
          </p>
        )}
        <Form
          retrySafe={false}
          form={form}
          onSubmit={async (input) => {
            if (signUp) {
              await api.signUp(input);
              setRegistered(true);
              form.reset();
              return;
            } else await api.signIn(input);
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
        {!signUp && (
          <p>
            <Link href="/forgot-password">Forgot password?</Link> ·{" "}
            <Link href="/verify-email">Resend verification email</Link>
          </p>
        )}
        <p className="auth-switch">
          {signUp ? "Already have an account?" : "New to 168Hours?"}{" "}
          <Link href={signUp ? "/login" : "/signup"}>
            {signUp ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </div>
  );
}
