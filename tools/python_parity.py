"""Write the Python reference outputs that the TypeScript schema package must equal.

The output goes to test/fixtures/python-parity.json. CI runs this script and fails
when the committed file differs (build task 2, done criterion 2).

Usage: python3 -I tools/python_parity.py > test/fixtures/python-parity.json
"""

from __future__ import annotations

import json
import pathlib
import random
import struct
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "docs" / "schema"))

import validate  # noqa: E402  (docs/schema/validate.py)


def examples() -> dict:
    out = {}
    for path in sorted((ROOT / "docs" / "schema" / "examples").glob("*.json")):
        doc = json.loads(path.read_text())
        out[path.name] = {
            "semanticErrors": validate.semantic_errors(doc),
            "risks": {r["riskId"]: {"register": validate.project_register(r), "rdr": validate.project_rdr(doc, r)}
                      for r in doc["risks"]},
        }
    return out


def g4() -> dict:
    example = json.loads((validate.VENDOR / "risk_detail_record_example.json").read_text())
    example.pop("$schema", None)
    risk = validate.import_rdr(example, "NE")
    doc = {"schemaVersion": "1.0.0",
           "document": {"id": "G4", "title": "G4", "currency": "USD", "createdOn": "2026-10-27T00:00:00Z"},
           "registers": [{"id": "NE", "title": "Customer Service Portal", "level": "system",
                          "timeframeMonths": 12, "asOf": "2021-04-15", "method": "semi-quantitative"}],
           "risks": [risk]}
    return {"document": doc, "rdr": validate.project_rdr(doc, risk)}


def format_g_cases() -> list:
    rng = random.Random(20261207)
    values = [0.0, -0.0, 1.0, 0.1, 0.5, 2.5, 1e-5, 1.5e-5, 0.0001, 0.00012345678, 123456.0, 1234565.0,
              1234575.0, 999999.5, 9999995.0, 1500000.0, 250000.0, 1e21, 1e-300, 5e-324, 0.25, 0.125, 2.675,
              123456.5, 100000.0, 999999.0, 1000000.0, 0.000099999995]
    for _ in range(600):
        values.append(rng.uniform(-1e7, 1e7))
        # A double from random bits with a binary exponent from -30 to 40. No libm call,
        # so the value is the same on every platform.
        bits = (rng.getrandbits(52)) | ((1023 + rng.randint(-30, 40)) << 52)
        values.append(struct.unpack("<d", struct.pack("<Q", bits))[0])
        values.append(round(rng.uniform(0, 1), rng.randint(1, 8)))
        values.append(float(rng.randint(0, 10 ** 9)))
    return [[v, format(v, "g")] for v in values]


if __name__ == "__main__":
    json.dump({"examples": examples(), "g4": g4(), "formatG": format_g_cases()}, sys.stdout, indent=1, sort_keys=True)
    sys.stdout.write("\n")
