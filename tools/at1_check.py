"""AT-1 second half (SPEC.md Sec. 12.1). Check the corpus of generated documents that
test/at1.test.ts writes with docs/schema/validate.py, and compare the projections.

Usage: python3 -I tools/at1_check.py at1-corpus.json
"""

from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "docs" / "schema"))

import validate  # noqa: E402
from jsonschema import Draft202012Validator  # noqa: E402


def main(path: str) -> int:
    corpus = json.loads(pathlib.Path(path).read_text())
    ours = Draft202012Validator(validate.OURS, registry=validate.REGISTRY)
    nist_register = Draft202012Validator(validate.NIST_REGISTER)
    nist_rdr = Draft202012Validator(validate.NIST_RDR)
    failures: list[str] = []
    risks = 0
    for index, item in enumerate(corpus):
        doc = item["doc"]
        errors = [e.message for e in ours.iter_errors(doc)] or validate.semantic_errors(doc)
        if errors:
            failures.append(f"document {index}: {errors[:3]}")
            continue
        for risk in doc["risks"]:
            risks += 1
            register = validate.project_register(risk)
            rdr = validate.project_rdr(doc, risk)
            errors = [e.message for e in nist_register.iter_errors(register)] + [e.message for e in nist_rdr.iter_errors(rdr)]
            if errors:
                failures.append(f"document {index} risk {risk['riskId']}: {errors[:3]}")
            ts = item["projections"][risk["riskId"]]
            if ts["register"] != register or ts["rdr"] != rdr:
                diff = [k for k in rdr if ts["rdr"].get(k) != rdr[k]]
                failures.append(f"document {index} risk {risk['riskId']}: projection differs from TypeScript in {diff or 'register'}")
    print(f"AT-1 Python: {len(corpus)} documents, {risks} risks, {len(failures)} failures")
    for failure in failures[:20]:
        print("   ", failure)
    return 1 if failures or not corpus else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
