# Canadian Nutrient File 2026

Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).

Source: Health Canada, **Canadian Nutrient File, 2026**. Every168 is not endorsed by Health Canada.

- [Official dataset](https://open.canada.ca/data/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109)
- [Health Canada overview and documentation](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/canadian-nutrient-file-about-us.html)
- Official ZIP resource: `019f2a90-e3a9-489d-b6e1-f74f4ba1d006`, archive SHA-256 `f5faad8977ee6bbdd9d69c8649077cacd87d8658ad200509a4047db1e29edcdd`.

The local JSON was inspected before the Phase 1 importer was designed. Its earlier format retained only five nutrients and no portions. Format 2 restores available nutrients/portions from the original official ZIP: 5,993 food records, 173 nutrient definitions with source units, 565,409 available values, and 21,207 positive edible portion weights. Root fields are `formatVersion`, `release`, `archiveSha256`, `basis`, `nutrientDefinitions`, and `foods`. Each food retains code, names, aliases, source update date, five mapped nutrients, a sparse nutrient-code/value dictionary and portion code/label/gram weights.

CNF nutrition describes **100 g of edible food**, including liquids, as documented in the archive's database-structure guide. Mappings are 208 (kcal), 203 (protein g), 205 (carbohydrate g), 204 (fat g) and 291 (fibre g). The normalizer and importer verify these source units. Other nutrients keep their original units in the release metadata. Missing dictionary entries/blank values mean unknown; reported zero stays zero. No volume density is inferred. Measure type 6 supplies actual gram weights; type 3 (refuse) and type 9 (yield) are excluded from selectable portions. Some supplied measure codes have no description in Measure_Name.csv; their positive weights are retained with an explicit CNF measure-code label.

Reproduce the normalized JSON using the Python standard library:

```sh
python3 scripts/import-cnf.py /path/to/cnf_fcen_all-files-data_2026.zip
```

Apply migrations and explicitly import into local PostgreSQL:

```sh
pnpm db:migrate
pnpm food:import:cnf
```

Repeat the import command safely. It validates the entire dataset before connecting/writing, validates IDs/units/values/portions, then commits a single transaction in batches of 200. An advisory lock serializes simultaneous imports. Food identity is `(provider, release, source code)`; IDs remain stable, unchanged rows retain versions, and changed rows advance versions. Statistics report inserted, updated, unchanged, batches, portions, available nutrient values and unknown/missing nutrient slots. The local command uses MIGRATION_DATABASE_URL when configured and rejects production or non-local/non-dev/test databases. Runtime API roles have catalogue SELECT only. No normal server startup imports data; the isolated browser test executable explicitly provisions its catalogue fixture.

The JSON is import input and is not loaded by API search or the frontend. PostgreSQL holds shared read-only catalogue rows and release metadata. User custom foods remain private. Explicit `foodId`/`catalogueId` reference variants support logging and ingredients without personal catalogue copies. Grams/source portions normalize to basis quantities in the canonical service, and recorded nutrition/source snapshots survive reimports. Source updates do not delete catalogue IDs or rewrite consumption. New provider adapters can reuse the provider/release/code model; this phase imports CNF only.
