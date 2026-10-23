"use client";
import { useState } from "react";
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { AdminUser } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { useCommand, CommandError } from "@/lib/use-command";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, PageHeading } from "@/components/ui/feedback";

function date(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not recorded";
}
type Action = {
  user: AdminUser;
  kind: "suspend" | "reactivate" | "revoke" | "delete";
};
function ManagementDialog({
  action,
  close,
}: {
  action: Action;
  close: () => void;
}) {
  const cache = useQueryClient();
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const title =
    action.kind === "suspend"
      ? "Suspend account"
      : action.kind === "reactivate"
        ? "Reactivate account"
        : action.kind === "delete"
          ? "Delete account"
          : "Revoke all sessions";
  const command = useCommand<AdminUser | { ok: true }, string>({
    mutationFn: (confirmation: string, key: string) =>
      action.kind === "delete"
        ? api.deleteUserAccount(action.user, confirmation, key)
        : action.kind === "revoke"
          ? api.revokeUserSessions(action.user, key)
          : api.setUserSuspended(action.user, action.kind === "suspend", key),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["admin"] });
      close();
    },
  });
  return (
    <Dialog
      title={title}
      onClose={() => {
        if (!command.isPending) close();
      }}
    >
      <p>
        <strong>{action.user.name}</strong>
        <br />
        {action.user.email}
      </p>
      <p>
        {action.kind === "suspend"
          ? "This account will be blocked from signing in and all its sessions will be revoked. Its personal records will be kept."
          : action.kind === "reactivate"
            ? "This account will be able to sign in again. Previous sessions will remain revoked."
            : action.kind === "delete"
              ? "This permanently deletes the account, all its personal records and every session. This cannot be undone. The administrative audit history will be retained."
              : "This user will need to sign in again on every device."}
      </p>
      {action.kind === "delete" && (
        <label className="field">
          Confirm account email
          <input
            type="email"
            autoComplete="off"
            value={confirmationEmail}
            disabled={command.isPending}
            onChange={(event) => setConfirmationEmail(event.target.value)}
          />
        </label>
      )}
      <CommandError command={command} />
      <div className="row">
        <button
          className="button secondary"
          disabled={command.isPending}
          onClick={close}
        >
          Cancel
        </button>
        <button
          className={
            action.kind === "delete" ? "button danger" : "button primary"
          }
          disabled={
            command.isPending ||
            (action.kind === "delete" &&
              confirmationEmail !== action.user.email)
          }
          onClick={() => command.mutate(confirmationEmail)}
        >
          {command.isPending ? "Saving…" : title}
        </button>
      </div>
    </Dialog>
  );
}
export function AdminPage() {
  const me = useMe();
  const enabled = me.user.accountType === "admin";
  const [section, setSection] = useState<"overview" | "users" | "audit">(
    "overview",
  );
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"" | "active" | "suspended">("");
  const [action, setAction] = useState<Action | null>(null);
  const statistics = useQuery({
    queryKey: ["admin", "statistics"],
    queryFn: api.getAdminStatistics,
    enabled: enabled && section === "overview",
  });
  const health = useQuery({
    queryKey: ["admin", "health"],
    queryFn: api.getAdminHealth,
    enabled: enabled && section === "overview",
  });
  const users = useInfiniteQuery({
    queryKey: ["admin", "users", search, status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getAdminUsers({
        search,
        status: status || undefined,
        cursor: pageParam,
        limit: 30,
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: enabled && section === "users",
  });
  const audit = useInfiniteQuery({
    queryKey: ["admin", "audit"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getAdminAudit({ cursor: pageParam, limit: 30 }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: enabled && section === "audit",
  });
  if (!enabled) return <p role="alert">Administrator access required.</p>;
  const stats = statistics.data;
  const system = health.data;
  return (
    <div className="admin-page">
      <PageHeading
        eyebrow="Platform"
        title="Admin"
        description="Manage accounts and review platform activity. Personal records remain private."
      />
      <nav className="row admin-sections" aria-label="Admin sections">
        {(["overview", "users", "audit"] as const).map((value) => (
          <button
            key={value}
            className={`button ${section === value ? "primary" : "secondary"}`}
            aria-pressed={section === value}
            onClick={() => setSection(value)}
          >
            {value === "overview"
              ? "Overview"
              : value === "users"
                ? "Users"
                : "Audit history"}
          </button>
        ))}
      </nav>
      {section === "overview" && (
        <>
          <section className="panel" aria-labelledby="statistics-heading">
            <h2 id="statistics-heading">Platform statistics</h2>
            {statistics.isPending && <p role="status">Loading statistics…</p>}
            {statistics.error && (
              <ErrorState
                error={statistics.error}
                retry={() => void statistics.refetch()}
              />
            )}
            {stats && (
              <>
                <dl className="admin-metrics">
                  {Object.entries({
                    "Total accounts": stats.users.total,
                    "Admin accounts": stats.users.admins,
                    "Suspended accounts": stats.users.suspended,
                    "New accounts · 7 days": stats.users.new7Days,
                    "Active accounts · 7 days": stats.users.active7Days,
                    "Active accounts · 30 days": stats.users.active30Days,
                    "Planned blocks": stats.usage.plannedBlocks,
                    "Food logs": stats.usage.foodEntries,
                    Workouts: stats.usage.strengthWorkouts,
                    "Legacy cardio activities": stats.usage.cardioActivities,
                    Goals: stats.usage.goals,
                  }).map(([label, count]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{count.toLocaleString()}</dd>
                    </div>
                  ))}
                </dl>
                <p className="muted">
                  Activity means a successful login or authenticated API
                  request, recorded at most hourly. Counts include all accounts;
                  usage is the number of stored records, including workout
                  drafts.
                </p>
                <p className="muted">Updated {date(stats.asOf)}</p>
              </>
            )}
            <button
              className="button secondary"
              disabled={statistics.isFetching}
              onClick={() => void statistics.refetch()}
            >
              Refresh statistics
            </button>
          </section>
          <section className="panel" aria-labelledby="health-heading">
            <h2 id="health-heading">System health</h2>
            {health.isPending && <p role="status">Checking health…</p>}
            {health.error && (
              <ErrorState
                error={health.error}
                retry={() => void health.refetch()}
              />
            )}
            {system && (
              <>
                <dl className="admin-metrics">
                  {Object.entries({
                    API: system.api,
                    Database: system.database,
                    "API version": system.version,
                    "Process uptime (seconds)": system.uptimeSeconds,
                    Requests: system.requests.total,
                    "Server errors": system.requests.serverErrors,
                    "Aborted requests": system.requests.aborted,
                  }).map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="muted">
                  Counters cover this API process since{" "}
                  {date(system.requests.since)} and reset when it restarts.
                  Checked {date(system.checkedAt)}.
                </p>
              </>
            )}
            <button
              className="button secondary"
              disabled={health.isFetching}
              onClick={() => void health.refetch()}
            >
              Refresh health
            </button>
          </section>
        </>
      )}
      {section === "users" && (
        <section aria-labelledby="users-heading">
          <h2 id="users-heading">Users</h2>
          <form
            className="row admin-search"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(draft.trim());
            }}
          >
            <label className="field">
              Name, email or account ID
              <input
                value={draft}
                maxLength={100}
                onChange={(event) => setDraft(event.target.value)}
              />
            </label>
            <label className="field">
              Status
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as typeof status)
                }
              >
                <option value="">All accounts</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
            <button className="button primary" type="submit">
              Search users
            </button>
          </form>
          {users.isPending && <p role="status">Loading accounts…</p>}
          {users.error && (
            <ErrorState
              error={users.error}
              retry={() => void users.refetch()}
            />
          )}
          {users.data?.pages
            .flatMap((page) => page.items)
            .map((user) => (
              <article className="panel" key={user.id}>
                <div className="row between">
                  <h3>{user.name}</h3>
                  <span>
                    {user.accountType === "admin"
                      ? "Admin"
                      : user.suspendedAt
                        ? "Suspended"
                        : "Active"}
                  </span>
                </div>
                <p className="admin-email">{user.email}</p>
                <dl className="admin-user-dates">
                  <div>
                    <dt>Joined</dt>
                    <dd>{date(user.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Last active</dt>
                    <dd>{date(user.lastActiveAt)}</dd>
                  </div>
                  {user.suspendedAt && (
                    <div>
                      <dt>Suspended</dt>
                      <dd>{date(user.suspendedAt)}</dd>
                    </div>
                  )}
                </dl>
                {user.accountType === "user" && (
                  <div className="row">
                    <button
                      className="button secondary"
                      onClick={() =>
                        setAction({
                          user,
                          kind: user.suspendedAt ? "reactivate" : "suspend",
                        })
                      }
                    >
                      {user.suspendedAt ? "Reactivate" : "Suspend"}
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setAction({ user, kind: "revoke" })}
                    >
                      Revoke sessions
                    </button>
                    <button
                      className="button danger"
                      onClick={() => setAction({ user, kind: "delete" })}
                    >
                      Delete account
                    </button>
                  </div>
                )}
              </article>
            ))}
          {users.data?.pages[0]?.items.length === 0 && (
            <p className="empty">No matching accounts.</p>
          )}
          {users.hasNextPage && (
            <button
              className="button secondary"
              disabled={users.isFetchingNextPage}
              onClick={() => void users.fetchNextPage()}
            >
              Load more users
            </button>
          )}
        </section>
      )}
      {section === "audit" && (
        <section aria-labelledby="audit-heading">
          <h2 id="audit-heading">Audit history</h2>
          <p className="muted">
            Immutable action history. Operator-created admins have no acting
            account. Account IDs are retained after account deletion.
          </p>
          {audit.isPending && <p role="status">Loading history…</p>}
          {audit.error && (
            <ErrorState
              error={audit.error}
              retry={() => void audit.refetch()}
            />
          )}
          {audit.data?.pages
            .flatMap((page) => page.items)
            .map((entry) => (
              <article className="panel admin-audit" key={entry.id}>
                <h3>
                  {
                    {
                      admin_created: "Admin created",
                      suspended: "Account suspended",
                      reactivated: "Account reactivated",
                      sessions_revoked: "Sessions revoked",
                      account_deleted: "Account deleted",
                    }[entry.action]
                  }
                </h3>
                <p>{date(entry.createdAt)}</p>
                <dl>
                  <dt>Performed by</dt>
                  <dd>{entry.actorId ?? "Local operator command"}</dd>
                  <dt>Account</dt>
                  <dd>{entry.targetId}</dd>
                </dl>
              </article>
            ))}
          {audit.data?.pages[0]?.items.length === 0 && (
            <p className="empty">No administrative actions yet.</p>
          )}
          <div className="row">
            <button
              className="button secondary"
              disabled={audit.isFetching}
              onClick={() => void audit.refetch()}
            >
              Refresh history
            </button>
            {audit.hasNextPage && (
              <button
                className="button secondary"
                disabled={audit.isFetchingNextPage}
                onClick={() => void audit.fetchNextPage()}
              >
                Load more actions
              </button>
            )}
          </div>
        </section>
      )}
      {action && (
        <ManagementDialog action={action} close={() => setAction(null)} />
      )}
    </div>
  );
}
