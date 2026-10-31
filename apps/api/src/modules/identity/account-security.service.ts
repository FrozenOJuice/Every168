import { createHash, randomBytes } from "node:crypto";
import type { Logger } from "pino";
import type { RunInTransaction } from "../../shared/transactions.js";
import type { EmailDelivery } from "../../infrastructure/email/delivery.js";
import { hashPassword, verifyPassword } from "../../shared/auth/password.js";
import { AppError } from "../../shared/errors/app-error.js";
import type {
  accountSecurityRepository,
  AccountTokenKind,
} from "./account-security.repository.js";
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function accountSecurityService(
  repo: ReturnType<typeof accountSecurityRepository>,
  run: RunInTransaction,
  send: EmailDelivery,
  logger: Logger,
) {
  return {
    async request(email: string, kind: AccountTokenKind) {
      const start = Date.now();
      const token = randomBytes(32).toString("base64url");
      const recipient = await run((context) =>
        repo.issue(
          email,
          kind,
          digest(token),
          new Date(Date.now() + (kind === "verify" ? 86400000 : 1800000)),
          context,
        ),
      );
      if (recipient) {
        // Provider latency must not distinguish a registered mailbox from an absent one.
        // Delivery has its own bounded timeout; a restart can require an explicit resend.
        void (async () => {
          try {
            await send({ to: recipient.email, kind, token });
          } catch {
            logger.error(
              { code: "EMAIL_DELIVERY_FAILED" },
              "Account email delivery failed",
            );
          }
        })();
      }
      // Same response for absent, verified, suspended and throttled accounts.
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, 500 - (Date.now() - start))),
      );
    },
    verify: (token: string) =>
      run((context) =>
        repo.consume("verify", digest(token), undefined, context),
      ),
    async reset(token: string, password: string) {
      const next = await hashPassword(password);
      await run((context) =>
        repo.consume("reset", digest(token), next, context),
      );
    },
    async change(userId: string, currentPassword: string, newPassword: string) {
      const previous = await repo.credential(userId);
      if (
        !previous ||
        !(await verifyPassword({ hash: previous, password: currentPassword }))
      )
        throw new AppError(
          400,
          "INVALID_PASSWORD",
          "Your current password is incorrect.",
        );
      const next = await hashPassword(newPassword);
      await run((context) => repo.change(userId, previous, next, context));
    },
  };
}
export type AccountSecurityService = ReturnType<typeof accountSecurityService>;
