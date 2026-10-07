import type {
  AdminUser,
  AdminUsersQuery,
  AdminAudit,
  AdminStatistics,
  AdminHealth,
  Page,
  PageQuery,
} from "@168hours/contracts";
import { body, query, writeHeaders, type Http } from "./http";
export function adminClient(http: Http) {
  return {
    getAdminUsers: (q: Partial<AdminUsersQuery> = {}) =>
      http<Page<AdminUser>>("/api/v1/admin/users" + query(q)),
    getAdminAudit: (q: Partial<PageQuery> = {}) =>
      http<AdminAudit>("/api/v1/admin/audit" + query(q)),
    getAdminStatistics: () => http<AdminStatistics>("/api/v1/admin/statistics"),
    getAdminHealth: () => http<AdminHealth>("/api/v1/admin/health"),
    setUserSuspended: (user: AdminUser, suspended: boolean, key: string) =>
      http<AdminUser>(`/api/v1/admin/users/${user.id}/status`, {
        method: "PUT",
        headers: writeHeaders(key, user.version),
        body: body({ suspended }),
      }),
    deleteUserAccount: (
      user: AdminUser,
      confirmationEmail: string,
      key: string,
    ) =>
      http<{ ok: true }>(`/api/v1/admin/users/${user.id}`, {
        method: "DELETE",
        headers: writeHeaders(key, user.version),
        body: body({ confirmationEmail }),
      }),
    revokeUserSessions: (user: AdminUser, key: string) =>
      http<AdminUser>(`/api/v1/admin/users/${user.id}/revoke-sessions`, {
        method: "POST",
        headers: writeHeaders(key, user.version),
        body: "{}",
      }),
  };
}
