import type { Config } from "../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";
export type AccountEmail = {
  to: string;
  kind: "verify" | "reset";
  token: string;
};
export type EmailDelivery = (message: AccountEmail) => Promise<void>;
export function emailDelivery(config: Config): EmailDelivery {
  return async ({ to, kind, token }) => {
    if (!config.EMAIL_API_KEY || !config.EMAIL_FROM)
      throw new AppError(
        503,
        "EMAIL_UNAVAILABLE",
        "Email delivery is temporarily unavailable. Please try again later.",
      );
    // Fragments keep credentials out of HTTP request URLs, access logs and referrers.
    const url = `${config.WEB_ORIGIN}/${kind === "verify" ? "verify-email" : "reset-password"}#token=${token}`;
    const subject =
      kind === "verify"
        ? "Verify your Every168 email"
        : "Reset your Every168 password";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${config.EMAIL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Every168 <${config.EMAIL_FROM}>`,
        to: [to],
        subject,
        text: `${subject}\n\n${url}\n\n${kind === "verify" ? "This link expires in 24 hours." : "This link expires in 30 minutes."} If you did not request this, you can ignore this email.`,
      }),
    });
    if (!response.ok)
      throw new AppError(
        503,
        "EMAIL_UNAVAILABLE",
        "Email delivery is temporarily unavailable. Please try again later.",
      );
  };
}
