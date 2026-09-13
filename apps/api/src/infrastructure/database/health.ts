import type { Pool } from "pg";
import type { Logger } from "pino";
import { AppError } from "../../shared/errors/app-error.js";
export function databaseHealth(
  pool: Pool,
  production: boolean,
  logger: Logger,
) {
  return {
    async ready() {
      try {
        await pool.query("select 1");
      } catch (cause) {
        throw new AppError(
          503,
          "NOT_READY",
          "Database is temporarily unavailable.",
          undefined,
          { cause },
        );
      }
    },
    async startup() {
      const { rows } = await pool.query<{
        elevated: boolean;
        schema_ready: boolean;
      }>(`
        select (rolsuper or rolbypassrls or rolcreatedb or rolcreaterole
          or has_schema_privilege('public', 'CREATE')
          or has_database_privilege(current_database(), 'CREATE')
          or exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
            where n.nspname='public' and c.relowner=pg_roles.oid)) as elevated,
          to_regclass('public.users') is not null and to_regclass('public.write_receipts') is not null
          and exists (select 1 from information_schema.columns where table_schema='public' and table_name='time_entries' and column_name='version')
          and exists (select 1 from pg_trigger where tgname='time_entries_revision' and not tgisinternal)
          and to_regclass('public.calendar_template_entries') is not null
          and exists (select 1 from pg_trigger where tgname='block_series_revision' and not tgisinternal) as schema_ready
        from pg_roles where rolname = current_user`);
      if (!rows[0]?.schema_ready)
        throw new AppError(
          503,
          "SCHEMA_MISSING",
          "Apply database migrations before starting the API.",
        );
      if (rows[0].elevated) {
        if (production)
          throw new AppError(
            503,
            "UNSAFE_DATABASE_ROLE",
            "The production runtime database role must not have administration, ownership or schema-creation privileges.",
          );
        logger.warn(
          { code: "ELEVATED_DATABASE_ROLE" },
          "Use a restricted runtime role; see database setup documentation",
        );
      }
    },
  };
}
