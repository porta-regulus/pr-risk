"""Validate the example files against risk-register.schema.json and the NIST IR 8286 Rev. 1 schemas.

Checks, in order:
  1. JSON Schema 2020-12 validation of each example (NIST schemas resolved from vendor/).
  2. Semantic rules V-01 to V-21 of SPEC.md Sec. 7.6 (the subset that needs no simulation).
  3. IR 8286 projection (SPEC.md Sec. 7.4) of every risk, validated against the vendored
     NIST risk_register_schema.json and risk_detail_record_schema.json.
  4. Golden test G4 (Fig. 15). The NIST RDR example fails its own schema. After import and
     export it passes, and its 34 original fields are unchanged.

Usage: python3 -I validate.py            (needs jsonschema >= 4.18 and referencing)
"""

from __future__ import annotations

import json
import pathlib
import sys

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

HERE = pathlib.Path(__file__).resolve().parent
VENDOR = HERE / "vendor" / "nist-ir8286r1"
NIST_REGISTER = json.loads((VENDOR / "risk_register_schema.json").read_text())
NIST_RDR = json.loads((VENDOR / "risk_detail_record_schema.json").read_text())
OURS = json.loads((HERE / "risk-register.schema.json").read_text())

REGISTRY = Registry().with_resources([
    (NIST_REGISTER["$id"], Resource.from_contents(NIST_REGISTER)),
    (NIST_RDR["$id"], Resource.from_contents(NIST_RDR)),
    (OURS["$id"], Resource.from_contents(OURS)),
])
REGISTER_FIELDS = list(NIST_REGISTER["properties"].keys())
NEGATIVE = {"Accept", "Avoid", "Transfer", "Mitigate"}
POSITIVE = {"Realize", "Share", "Enhance", "Accept"}


def scale_names(bands: list) -> set:
    return {b["label"] for b in bands} | {a for b in bands for a in b.get("aliases", [])}


def label_fields(r: dict) -> list:
    """Every label of a risk with the scale it must come from."""
    out = [("riskLikelihoodLabel", "likelihood", r.get("riskLikelihoodLabel")),
           ("riskImpactLabel", "impact", r.get("riskImpactLabel")),
           ("exposureRatingLabel", "exposure", r.get("exposureRatingLabel"))]
    prev = r.get("previousAssessment", {})
    out += [("previousAssessment." + k, s, prev.get(k)) for k, s in
            (("riskLikelihoodLabel", "likelihood"), ("riskImpactLabel", "impact"), ("exposureRatingLabel", "exposure"))]
    for part in ("planned", "measured"):
        blk = r.get("detail", {}).get(part, {})
        out += [(f"detail.{part}." + k, s, blk.get(k)) for k, s in
                (("likelihoodLabel", "likelihood"), ("impactLabel", "impact"), ("exposureRatingLabel", "exposure"))]
    # Schema 1.1.0 adds the impact split of the previous period.
    for prefix, imp in (("impacts", r.get("impacts", {})), ("previousAssessment.impacts", prev.get("impacts", {}))):
        for k in ("opex", "capex"):
            out.append((f"{prefix}.financial.{k}", "impact", imp.get("financial", {}).get(k, {}).get("label")))
        for k in ("reputation", "mission", "safety"):
            out.append((f"{prefix}.{k}", "impact", imp.get(k, {}).get("label")))
    return out


def semantic_errors(doc: dict) -> list[str]:
    errs: list[str] = []
    regs = {g["id"]: g for g in doc["registers"]}
    drivers = {d["id"] for d in doc.get("drivers", [])}
    scales = doc.get("strategy", {}).get("scales", {})
    objectives = {o["id"] for o in doc.get("context", {}).get("objectives", [])}
    functions = {f["id"] for f in doc.get("context", {}).get("functions", [])}
    assets = {a["id"]: a for a in doc.get("assets", [])}
    responses = {o["id"]: o for o in doc.get("responses", [])}
    risk_set = {r["riskId"] for r in doc["risks"]}
    for a in assets.values():
        for fid in a.get("supportsFunctionIds", []):
            if fid not in functions:
                errs.append(f"V-20 asset {a['id']} supports unknown function {fid}")
    for o in responses.values():
        for rid in o.get("introducesRisks", []):
            if rid not in risk_set:
                errs.append(f"V-19 response {o['id']} introduces unknown risk {rid}")
        for e in o["effects"]:
            known = drivers if e["targetKind"] == "driver" else risk_set
            if e["targetId"] not in known:
                errs.append(f"V-14 response {o['id']} targets unknown {e['targetKind']} {e['targetId']}")
    for f in doc.get("forecasts", []):
        if f["riskId"] not in risk_set:
            errs.append(f"V-21 forecast {f['id']} refers to unknown risk")
    risk_ids = [r["riskId"] for r in doc["risks"]]
    keys = {(r["registerId"], r["riskId"]) for r in doc["risks"]}
    if len(set(risk_ids)) != len(risk_ids):
        errs.append("V-01 riskId values are not unique in the document")
    for g in regs.values():
        if g.get("parentRegisterId") and g["parentRegisterId"] not in regs:
            errs.append(f"V-02 register {g['id']} has an unknown parent")
    for r in doc["risks"]:
        rid = r["riskId"]
        if r["registerId"] not in regs:
            errs.append(f"V-03 {rid} has an unknown registerId")
            continue
        allowed = NEGATIVE if r["polarity"] == "negative" else POSITIVE
        if not set(r["riskResponseType"]) <= allowed:
            errs.append(f"V-04 {rid} response type does not match polarity")
        for link in r.get("driverLinks", []):
            if link["driverId"] not in drivers:
                errs.append(f"V-05 {rid} links unknown driver {link['driverId']}")
        for ref in r.get("sourceRefs", []):
            if (ref["registerId"], ref["riskId"]) not in keys:
                errs.append(f"V-06 {rid} has a sourceRef to a missing risk")
        expected = round(r["riskLikelihood"] * r["riskImpact"])
        if abs(expected - r["exposureRating"]) > 1:
            errs.append(f"V-07 {rid} exposureRating {r['exposureRating']} is not riskLikelihood x riskImpact ({expected})")
        method = regs[r["registerId"]]["method"]
        if method == "quantitative" and "estimate" not in r and not r.get("sourceRefs"):
            errs.append(f"V-08 {rid} is in a quantitative register but has no estimate")
        if r["responseDecision"] == "pending" and (r["riskResponseType"] != ["Accept"] or r["riskResponseCost"] != 0):
            errs.append(f"V-09 {rid} is pending but the NIST fields are not an interim Accept with cost 0")
        dists = []
        if "estimate" in r:
            dists += [r["estimate"]["frequency"], r["estimate"]["impactPerEvent"]]
        for d in dists:
            if d["type"] == "lognormal" and not d["lower"] < d["upper"]:
                errs.append(f"V-10 {rid} lognormal lower is not below upper")
            if d["type"] == "pert" and not d["min"] <= d["mode"] <= d["max"]:
                errs.append(f"V-10 {rid} PERT min, mode, max are not in order")
        for field, scale, label in label_fields(r):
            if label and scale in scales:
                if label not in scale_names(scales[scale]):
                    errs.append(f"V-11 {rid} {field} '{label}' is not on the strategy scale")
        for oid in r.get("objectiveIds", []):
            if oid not in objectives:
                errs.append(f"V-16 {rid} refers to unknown objective {oid}")
        for aid in r.get("assetIds", []):
            if aid not in assets:
                errs.append(f"V-17 {rid} refers to unknown asset {aid}")
        for link in r.get("linkedRisks", []):
            if link["riskId"] not in risk_set or link["riskId"] == rid:
                errs.append(f"V-18 {rid} has a linked risk that is missing or itself")
        owr = r.get("onlyWithResponse")
        if owr and (owr not in responses or rid not in responses[owr].get("introducesRisks", [])):
            errs.append(f"V-19 {rid} onlyWithResponse {owr} does not list it in introducesRisks")
    pts = doc.get("appetite", {}).get("toleranceCurve", {}).get("points", [])
    for a, b in zip(pts, pts[1:]):
        if not (a["loss"] < b["loss"] and a["maxExceedanceProbability"] > b["maxExceedanceProbability"]):
            errs.append("V-12 tolerance curve is not ascending in loss and strictly descending in probability")
    return errs


def project_register(r: dict) -> dict:
    return {k: r[k] for k in REGISTER_FIELDS}


def analysis_text(doc: dict, r: dict) -> str:
    reg = next(g for g in doc["registers"] if g["id"] == r["registerId"])
    if "estimate" in r:
        e = r["estimate"]

        def fmt(d: dict) -> str:
            if d["type"] == "lognormal":
                return f"lognormal 90% interval {d['lower']:g} to {d['upper']:g}"
            if d["type"] == "pert":
                return f"PERT {d['min']:g}, {d['mode']:g}, {d['max']:g}"
            return f"constant {d['value']:g}"
        links = ", ".join(f"{l['driverId']} ({l['triggerProbability']:g})" for l in r.get("driverLinks", []))
        secs = "".join(f" Secondary impact '{s['description']}' with probability {s['probability']:g}, {fmt(s['impactPerEvent'])}."
                       for s in e.get("secondaryImpacts", []))
        sim = doc.get("simulation", {})
        return (f"Quantitative, {reg['timeframeMonths']} months. Frequency per year {fmt(e['frequency'])}. "
                f"Impact per event {fmt(e['impactPerEvent'])} {doc['document']['currency']}. "
                f"Drivers {links or 'none'}.{secs} Seed {sim.get('seed')}, {sim.get('trials')} trials.")
    parts = [f"{n} {r[k]}" for n, k in (("likelihood", "riskLikelihoodLabel"), ("impact", "riskImpactLabel"),
                                         ("exposure", "exposureRatingLabel")) if r.get(k)]
    if parts:
        return f"{reg['method'].capitalize()}. Labels on the strategy scale, " + ", ".join(parts) + "."
    if "riskLikelihood" in r.get("defaultedFields", []) or "/riskLikelihood" in r.get("defaultedFields", []):
        return "Not estimated. Numeric fields are placeholders."
    return f"{reg['method'].capitalize()}. Point values as entered."


def project_rdr(doc: dict, r: dict) -> dict:
    """SPEC.md Sec. 7.4. Build a full NIST RDR from the risk entry."""
    reg = next(g for g in doc["registers"] if g["id"] == r["registerId"])
    d = r.get("detail", {})
    planned = d.get("planned", {})
    measured = d.get("measured", {})
    drivers = {x["id"]: x["name"] for x in doc.get("drivers", [])}
    deps = "; ".join(f"Shared driver {l['driverId']} {drivers.get(l['driverId'], '')}".strip() for l in r.get("driverLinks", []))
    ids = r["riskId"]
    if r.get("sourceRefs"):
        ids += "; sources " + ", ".join(s.get("label") or f"{s['registerId']}-{s['riskId']}" for s in r["sourceRefs"])
    rdr = {
        "riskIdNumbers": ids,
        "systemAffected": d.get("systemAffected", reg["title"]),
        "organizationOrBusinessUnit": d.get("organizationOrBusinessUnit", doc["document"].get("organization", "")),
        "riskScenarioDescription": d.get("riskScenarioDescription", r["riskDescription"]),
        "assetsAffected": d.get("assetsAffected", ""),
        "threatSourcesActors": d.get("threatSourcesActors", ""),
        "threatVectors": d.get("threatVectors", ""),
        "threatEvents": d.get("threatEvents", ""),
        "vulnerabilityPredisposingConditions": d.get("vulnerabilityPredisposingConditions", ""),
        "primaryAdverseImpact": d.get("primaryAdverseImpact", ""),
        "secondaryAdverseImpacts": d.get("secondaryAdverseImpacts", ""),
        "otherScenarioDetails": d.get("otherScenarioDetails", ""),
        "riskCategory": r["riskCategory"],
        "currentRiskAnalysis": d.get("currentRiskAnalysis", analysis_text(doc, r)),
        "likelihoodBeforeControls": r["riskLikelihood"],
        "impactBeforeControls": r["riskImpact"],
        "exposureRatingBeforeControls": r["exposureRating"],
        "plannedRiskResponse": r["riskResponseType"],
        "plannedRiskResponseDescription": r["riskResponseDescription"],
        "resourceRequirementsForPlannedRisk": d.get("resourceRequirementsForPlannedRisk", ""),
        "plannedResponseCost": r["riskResponseCost"],
        "likelihoodAfterControlsWillBe": planned.get("likelihood", r["riskLikelihood"]),
        "impactAfterControls": planned.get("impact", r["riskImpact"]),
        "expectedExposureRating": planned.get("exposureRating", r["exposureRating"]),
        "actualResponseCost": measured.get("actualResponseCost", 0),
        "likelihoodAfterControlsAreInPlaceWillBe": measured.get("likelihood", r["riskLikelihood"]),
        "impactAfterControlsAreInPlace": measured.get("impact", r["riskImpact"]),
        "finalExposureRating": measured.get("exposureRating", r["exposureRating"]),
        "riskOwnerPointOfContact": r["riskOwnerPointOfContact"],
        "dateOfRiskIdentification": d.get("dateOfRiskIdentification", reg["asOf"]),
        "sourceOfRiskInformation": d.get("sourceOfRiskInformation", "Risk register entry"),
        "currentStatusDate": d.get("currentStatusDate", reg["asOf"]),
        "dependencies": d.get("dependencies", deps),
        "followUpDate": d.get("followUpDate", r.get("reviewDue", "")),
    }
    if "comments" in d:
        rdr["comments"] = d["comments"]
    return rdr


def import_rdr(rdr: dict, register_id: str) -> dict:
    """SPEC.md Sec. 9.3. NIST RDR to native risk. Fields the RDR does not hold are defaulted and listed."""
    detail_keys = ["systemAffected", "organizationOrBusinessUnit", "riskScenarioDescription", "assetsAffected",
                   "threatSourcesActors", "threatVectors", "threatEvents", "vulnerabilityPredisposingConditions",
                   "primaryAdverseImpact", "secondaryAdverseImpacts", "otherScenarioDetails",
                   "resourceRequirementsForPlannedRisk", "dateOfRiskIdentification", "sourceOfRiskInformation",
                   "currentStatusDate", "dependencies", "followUpDate", "comments", "currentRiskAnalysis"]
    detail = {k: rdr[k] for k in detail_keys if k in rdr}
    detail["planned"] = {"likelihood": rdr["likelihoodAfterControlsWillBe"], "impact": rdr["impactAfterControls"],
                         "exposureRating": rdr["expectedExposureRating"]}
    detail["measured"] = {"actualResponseCost": rdr["actualResponseCost"],
                          "likelihood": rdr["likelihoodAfterControlsAreInPlaceWillBe"],
                          "impact": rdr["impactAfterControlsAreInPlace"],
                          "exposureRating": rdr["finalExposureRating"]}
    return {
        "riskId": rdr["riskIdNumbers"], "registerId": register_id, "polarity": "negative",
        "riskDescription": rdr["riskScenarioDescription"], "riskCategory": rdr["riskCategory"],
        "category": {"code": "ict"},
        "riskLikelihood": rdr["likelihoodBeforeControls"], "riskImpact": rdr["impactBeforeControls"],
        "exposureRating": rdr["exposureRatingBeforeControls"],
        "riskResponseType": rdr.get("plannedRiskResponse", ["Accept"]),
        "riskResponseCost": rdr["plannedResponseCost"],
        "riskResponseDescription": rdr["plannedRiskResponseDescription"],
        "riskOwnerPointOfContact": rdr["riskOwnerPointOfContact"], "status": "Open",
        "responseDecision": "decided", "detail": detail,
        "defaultedFields": ["/polarity", "/category", "/status"],
    }


def main() -> int:
    ours = Draft202012Validator(OURS, registry=REGISTRY)
    nist_reg = Draft202012Validator(NIST_REGISTER)
    nist_rdr = Draft202012Validator(NIST_RDR)
    failed = 0
    for path in sorted((HERE / "examples").glob("*.json")):
        doc = json.loads(path.read_text())
        errs = [f"schema {'/'.join(map(str, e.absolute_path))} {e.message}" for e in ours.iter_errors(doc)]
        if not errs:
            errs += semantic_errors(doc)
            for r in doc["risks"]:
                errs += [f"IR8286 register {r['riskId']} {e.message}" for e in nist_reg.iter_errors(project_register(r))]
                errs += [f"IR8286 RDR {r['riskId']} {e.message}" for e in nist_rdr.iter_errors(project_rdr(doc, r))]
        print(("PASS " if not errs else "FAIL ") + path.name + f"  ({len(doc.get('risks', []))} risks)")
        for e in errs[:20]:
            print("   ", e)
        failed += bool(errs)

    # G4. Fig. 15 / NIST RDR example round trip.
    nist_example = json.loads((VENDOR / "risk_detail_record_example.json").read_text())
    nist_example.pop("$schema", None)
    before = [e.message for e in nist_rdr.iter_errors(nist_example)]
    doc = {"schemaVersion": "1.0.0",
           "document": {"id": "G4", "title": "G4", "currency": "USD", "createdOn": "2026-10-27T00:00:00Z"},
           "registers": [{"id": "NE", "title": "Customer Service Portal", "level": "system",
                          "timeframeMonths": 12, "asOf": "2021-04-15", "method": "semi-quantitative"}],
           "risks": [import_rdr(nist_example, "NE")]}
    errs = [e.message for e in ours.iter_errors(doc)] + semantic_errors(doc)
    out = project_rdr(doc, doc["risks"][0])
    after = [e.message for e in nist_rdr.iter_errors(out)]
    changed = [k for k in nist_example if nist_example[k] != out.get(k)]
    ok = before and not after and not changed and not errs
    print(("PASS " if ok else "FAIL ") + "G4 Fig. 15 RDR round trip")
    print(f"    NIST example against NIST schema before import: {before}")
    print(f"    after export: {after or 'valid'}; changed original fields: {changed or 'none'}; added: "
          f"{sorted(set(out) - set(nist_example))}")
    for e in errs:
        print("   ", e)
    failed += not ok
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
