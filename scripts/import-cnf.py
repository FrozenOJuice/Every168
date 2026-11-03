"""Normalize the official CNF 2026 ZIP. Usage: python3 scripts/import-cnf.py /path/to/cnf2026.zip"""
import csv
import hashlib
import io
import json
from pathlib import Path
import sys
import zipfile

archive = Path(sys.argv[1])
with zipfile.ZipFile(archive) as source:
    def rows(name):
        return csv.DictReader(io.StringIO(source.read(name).decode("utf-8-sig")))

    keys = {"208": "calories", "203": "proteinG", "205": "carbsG", "204": "fatG", "291": "fiberG"}
    definitions = {r["Nutrient_Code"]: {"name": r["Nutrient_Name_EN"], "unit": r["Nutrient_Unit"]} for r in rows("Nutrient_Name.csv")}
    expected_units = {"208": "kilocalorie", "203": "Gram", "204": "Gram", "205": "Gram", "291": "Gram"}
    for code, unit in expected_units.items():
        if definitions[code]["unit"] != unit:
            raise ValueError(f"Unexpected nutrient unit: {code}")
    measures = {r["Measure_Code"]: r["Measure_Description_and_Unit_EN"] for r in rows("Measure_Name.csv")}
    portions = {}
    for r in rows("Measure_Weight_Conversion.csv"):
        # Type 3 is refuse and type 9 is yield, not an edible serving weight.
        if r["Measure_Type_Code"] != "6":
            continue
        grams = float(r["Measure_Weight_Conversion"])
        if grams <= 0:
            continue
        portions.setdefault(r["Food_Code"], []).append({"id": r["Measure_Code"], "label": measures.get(r["Measure_Code"], "CNF measure " + r["Measure_Code"]), "grams": grams})
    nutrients = {}
    for row in rows("Nutrient_Amount.csv"):
        code, key = row["Food_Code"], row["Nutrient_Code"]
        target = nutrients.setdefault(code, {})
        if key in target:
            raise ValueError(f"Duplicate nutrient: {code}/{key}")
        raw = row["Nutrient_Amount"].strip()
        value = float(raw) if raw else None
        if value is not None and not 0 <= value <= 100000:
            raise ValueError(f"Invalid nutrient: {code}/{key}")
        target[key] = value
    foods = []
    for row in rows("Food_Name.csv"):
        foods.append({
            "code": row["Food_Code"],
            "name": row["Food_Description_EN"],
            "nameFr": row["Food_Description_FR"],
            "aliases": " ".join([row["Alternate_Description_EN"], row["Alternate_Description_FR"]]),
            "updatedAt": row["Food_Last_Updated_Date"],
            **{key: nutrients.get(row["Food_Code"], {}).get(code) for code, key in keys.items()},
            "nutrients": nutrients.get(row["Food_Code"], {}),
            "portions": sorted(portions.get(row["Food_Code"], []), key=lambda p: int(p["id"])),
        })
    foods.sort(key=lambda f: int(f["code"]))
    if len(foods) != 5993 or len({f["code"] for f in foods}) != len(foods):
        raise ValueError("Unexpected CNF 2026 food count or duplicate codes")
    data = {"formatVersion": 2, "basis": {"amount": 100, "unit": "g"}, "nutrientDefinitions": definitions, "release": "2026", "archiveSha256": hashlib.sha256(archive.read_bytes()).hexdigest(), "foods": foods}
    output = Path(__file__).resolve().parents[1] / "apps/api/src/modules/nutrition/data/cnf-2026.json"
    output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n")
    print(f"Normalized {len(foods)} foods into {output.relative_to(Path(__file__).resolve().parents[1])}")
