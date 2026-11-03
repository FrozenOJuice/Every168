import { and, eq, ilike, asc, count } from "drizzle-orm";
import type { CatalogueQuery } from "@168hours/contracts";
import type { Database } from "../../infrastructure/database/client.js";
import { databaseFor } from "../../infrastructure/database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
import { catalogueFoods } from "./catalogue.table.js";
export const normalizeFoodSearch = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
export function catalogueRepository(db: Database) {
  return {
    async get(id: string, context?: TransactionContext) {
      const q = databaseFor(db, context)
        .select()
        .from(catalogueFoods)
        .where(eq(catalogueFoods.id, id));
      return (await (context ? q.for("share") : q))[0];
    },
    async search(q: CatalogueQuery) {
      if (q.search.length < 2) return { items: [], nextOffset: null, total: 0 };
      const where = and(
        ...normalizeFoodSearch(q.search)
          .split(/\s+/)
          .filter(Boolean)
          .map((term) =>
            ilike(
              catalogueFoods.searchText,
              "%" + term.replace(/[\\%_]/g, "\\$&") + "%",
            ),
          ),
      );
      return db.transaction(
        async (tx) => {
          const items = await tx
            .select()
            .from(catalogueFoods)
            .where(where)
            .orderBy(asc(catalogueFoods.name), asc(catalogueFoods.id))
            .offset(q.offset)
            .limit(q.limit);
          const total = (
            await tx
              .select({ total: count() })
              .from(catalogueFoods)
              .where(where)
          )[0]!.total;
          return {
            items,
            total,
            nextOffset: q.offset + q.limit < total ? q.offset + q.limit : null,
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
  };
}
