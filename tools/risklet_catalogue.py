"""Write src/catalogue/risklet.json from the Risklet catalogue workbook of the product owner.

The workbook is not in this repository (SPEC.md Sec. 13). PortaRegulus owns the catalogue
and ships its 119 names under CC BY 4.0 (ADR-0003, open question Q3 answered 2026-10-29).
Only the RISK ID, RISK NAME and CATEGORY columns are read. The side block next to rows 3 to 8
is ignored (SPEC.md Sec. 13). The category map to codes and subcodes is in src/ui/catalogue.ts.

Needs openpyxl, which is not part of tools/requirements-docs.txt, because CI does not run this.

Usage: python3 tools/risklet_catalogue.py "Risklet Risks.xlsx" > src/catalogue/risklet.json
"""

from __future__ import annotations

import hashlib
import json
import pathlib
import sys

import openpyxl


def main() -> None:
    path = pathlib.Path(sys.argv[1])
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    entries = []
    for index, row in enumerate(workbook.worksheets[0].iter_rows(values_only=True)):
        if index == 0 or len(row) < 4 or row[1] is None:
            continue
        entries.append({"id": str(int(row[1])), "name": str(row[2]).strip(), "label": str(row[3]).strip()})
    out = {
        "catalogue": "Risklet",
        "licence": "CC-BY-4.0",
        "attribution": "Risklet catalogue, copyright 2026 PortaRegulus, licensed under CC BY 4.0",
        "source": {"file": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()},
        "entries": entries,
    }
    sys.stdout.write(json.dumps(out, indent=1, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
