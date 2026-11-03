import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { cataloguePortion, nutrientInput } from "@168hours/contracts";
import type { Database } from "../../infrastructure/database/client.js";
import { catalogueFoods, catalogueReleases } from "./catalogue.table.js";
import { normalizeFoodSearch } from "./catalogue.repository.js";
export const cnfDatasetSchema = z.object({
  formatVersion: z.literal(2),
  release: z.literal("2026"),
  archiveSha256: z.string().regex(/^[a-f0-9]{64}$/),
  basis: z.object({ amount: z.literal(100), unit: z.literal("g") }),
  nutrientDefinitions: z.record(
    z.string(),
    z.object({ name: z.string(), unit: z.string() }),
  ),
  foods: z
    .array(
      z.object({
        code: z.string().regex(/^[1-9]\d*$/),
        name: z.string().trim().min(1).max(160),
        nameFr: z.string(),
        aliases: z.string(),
        updatedAt: z.string(),
        calories: nutrientInput,
        proteinG: nutrientInput,
        carbsG: nutrientInput,
        fatG: nutrientInput,
        fiberG: nutrientInput,
        nutrients: z.record(z.string(), nutrientInput),
        portions: z.array(cataloguePortion),
      }),
    )
    .length(5993),
});
export const cnfDataPath = new URL("./data/cnf-2026.json", import.meta.url);
export async function readCnfDataset(file: string | URL = cnfDataPath) {
  const data = cnfDatasetSchema.parse(JSON.parse(await readFile(file, "utf8")));
  if (new Set(data.foods.map((f) => f.code)).size !== data.foods.length)
    throw new Error("Duplicate CNF food codes");
  const units = {
    "208": "kilocalorie",
    "203": "Gram",
    "204": "Gram",
    "205": "Gram",
    "291": "Gram",
  };
  const keys = {
    "208": "calories",
    "203": "proteinG",
    "204": "fatG",
    "205": "carbsG",
    "291": "fiberG",
  } as const;
  for (const [code, unit] of Object.entries(units))
    if (data.nutrientDefinitions[code]?.unit !== unit)
      throw new Error("Unexpected CNF nutrient units");
  for (const food of data.foods) {
    if (new Set(food.portions.map((p) => p.id)).size !== food.portions.length)
      throw new Error("Duplicate CNF portion codes");
    for (const [code, key] of Object.entries(keys))
      if (food[key] !== (food.nutrients[code] ?? null))
        throw new Error("Inconsistent normalized nutrient");
    if (
      Object.keys(food.nutrients).some(
        (code) => !data.nutrientDefinitions[code],
      )
    )
      throw new Error("Unknown nutrient definition");
  }
  return data;
}
export async function importCnf(
  db: Database,
  data: Awaited<ReturnType<typeof readCnfDataset>>,
  batchSize = 200,
) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500)
    throw new Error("Batch size must be 1–500");
  return db.transaction(async (tx) => {
    // Concurrent imports serialize, while readers keep the previous complete release until commit.
    await tx.execute(sql`select pg_advisory_xact_lock(1682026)`);
    const release = (
      await tx
        .insert(catalogueReleases)
        .values({
          provider: "cnf",
          release: data.release,
          metadata: {
            archiveSha256: data.archiveSha256,
            nutrientDefinitions: data.nutrientDefinitions,
            basis: data.basis,
          },
        })
        .onConflictDoUpdate({
          target: [catalogueReleases.provider, catalogueReleases.release],
          set: {
            metadata: {
              archiveSha256: data.archiveSha256,
              nutrientDefinitions: data.nutrientDefinitions,
              basis: data.basis,
            },
          },
        })
        .returning()
    )[0]!;
    const existing = new Map(
      (
        await tx
          .select({
            code: catalogueFoods.code,
            hash: catalogueFoods.contentHash,
          })
          .from(catalogueFoods)
          .where(
            and(
              eq(catalogueFoods.provider, "cnf"),
              eq(catalogueFoods.release, data.release),
            ),
          )
      ).map((r) => [r.code, r.hash]),
    );
    const stats = {
      total: data.foods.length,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      portions: 0,
      nutrientValues: 0,
      unknownValues: 0,
      batches: 0,
    };
    const pending = [];
    for (const food of data.foods) {
      stats.portions += food.portions.length;
      stats.nutrientValues += Object.keys(food.nutrients).length;
      stats.unknownValues +=
        Object.keys(data.nutrientDefinitions).length -
        Object.values(food.nutrients).filter((v) => v !== null).length;
      const hash = createHash("sha256")
        .update(JSON.stringify(food))
        .digest("hex");
      if (existing.get(food.code) === hash) {
        stats.unchanged++;
        continue;
      }
      if (existing.has(food.code)) stats.updated++;
      else stats.inserted++;
      const { aliases, updatedAt, ...values } = food;
      pending.push({
        ...values,
        provider: "cnf",
        release: data.release,
        releaseId: release.id,
        sourceUpdatedAt: updatedAt,
        basisAmount: data.basis.amount,
        basisUnit: data.basis.unit,
        searchText: normalizeFoodSearch(
          `${food.name} ${food.nameFr} ${aliases}`,
        ),
        contentHash: hash,
      });
    }
    for (let i = 0; i < pending.length; i += batchSize) {
      await tx
        .insert(catalogueFoods)
        .values(pending.slice(i, i + batchSize))
        .onConflictDoUpdate({
          target: [
            catalogueFoods.provider,
            catalogueFoods.release,
            catalogueFoods.code,
          ],
          set: {
            name: sql`excluded.name`,
            nameFr: sql`excluded.name_fr`,
            searchText: sql`excluded.search_text`,
            sourceUpdatedAt: sql`excluded.source_updated_at`,
            basisAmount: sql`excluded.basis_amount`,
            basisUnit: sql`excluded.basis_unit`,
            calories: sql`excluded.calories`,
            proteinG: sql`excluded.protein_g`,
            carbsG: sql`excluded.carbs_g`,
            fatG: sql`excluded.fat_g`,
            fiberG: sql`excluded.fiber_g`,
            portions: sql`excluded.portions`,
            nutrients: sql`excluded.nutrients`,
            contentHash: sql`excluded.content_hash`,
            version: sql`${catalogueFoods.version}+1`,
          },
        });
      stats.batches++;
    }
    return stats;
  });
}
