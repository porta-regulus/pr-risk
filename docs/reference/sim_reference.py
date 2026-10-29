"""Reference model for SPEC.md Sec. 8 (risk math). Statistical oracle only.

This script is NOT the release-1 engine. It uses NumPy's PCG64 stream, not the
xoshiro128** and mulberry32 streams of SPEC.md Sec. 8.6, so its numbers agree
with the engine only within Monte Carlo error. Use it to cross-check the
TypeScript engine and to fill the derived NIST fields of the example files.

Usage:
    python3 -I sim_reference.py <document.json>            # print results
    python3 -I sim_reference.py <document.json> --fill     # write derived fields
    python3 -I sim_reference.py <document.json> --budget=60000   # funding rule and fiscal baseline
"""

from __future__ import annotations

import json
import math
import sys

import numpy as np

Z95 = 1.6448536269514722  # Phi^-1(0.95)
LAMBDA_CAP = 700.0        # SPEC.md Sec. 8.5, sampled rates above this are clipped
BATCHES = 10              # SPEC.md Sec. 8.11, batch means for standard errors


def sample(dist: dict, n: int, rng: np.random.Generator) -> np.ndarray:
    t = dist["type"]
    if t == "constant":
        return np.full(n, float(dist["value"]))
    if t == "lognormal":
        lo, hi = float(dist["lower"]), float(dist["upper"])
        mu = (math.log(lo) + math.log(hi)) / 2.0
        sigma = (math.log(hi) - math.log(lo)) / (2.0 * Z95)
        return np.exp(mu + sigma * rng.standard_normal(n))
    if t == "pert":
        a, m, b = float(dist["min"]), float(dist["mode"]), float(dist["max"])
        if b == a:
            return np.full(n, a)
        alpha = 1.0 + 4.0 * (m - a) / (b - a)
        beta = 1.0 + 4.0 * (b - m) / (b - a)
        return a + (b - a) * rng.beta(alpha, beta, n)
    raise ValueError(f"unknown distribution {t}")


def simulate(doc: dict, trials: int, seed: int, overrides: dict, active: set) -> dict:
    """Per-trial event counts, counts above the reportable threshold and annual impact per leaf risk.

    active holds the ids of funded responses. A risk with onlyWithResponse enters only if that response is active.
    """
    rng = np.random.default_rng(seed)
    drivers = {}
    for d in doc.get("drivers", []):
        freq = overrides.get(("driver", d["id"], "frequency"), d["frequency"])
        drivers[d["id"]] = rng.poisson(np.minimum(sample(freq, trials, rng), LAMBDA_CAP))
    out = {"__drivers__": drivers}
    thresholds = {g["id"]: g.get("reportableEventThreshold", 0.0) for g in doc["registers"]}
    for r in doc["risks"]:
        est = r.get("estimate")
        if est is None or r.get("sourceRefs"):
            continue  # SPEC.md Sec. 8.2, summary entries do not enter the simulation
        if r.get("onlyWithResponse") and r["onlyWithResponse"] not in active:
            continue  # SPEC.md Sec. 8.10, risk caused by a response that is not funded
        rid = r["riskId"]
        freq = overrides.get(("risk", rid, "frequency"), est["frequency"])
        imp = overrides.get(("risk", rid, "impactPerEvent"), est["impactPerEvent"])
        n = rng.poisson(np.minimum(sample(freq, trials, rng), LAMBDA_CAP))
        for link in r.get("driverLinks", []):
            n = n + rng.binomial(drivers[link["driverId"]], link["triggerProbability"])
        total = int(n.sum())
        x = sample(imp, total, rng)
        for sec in est.get("secondaryImpacts", []):  # SPEC.md Sec. 8.4
            hit = rng.random(total) < sec["probability"]
            x = x + hit * sample(sec["impactPerEvent"], total, rng)
        trial_idx = np.repeat(np.arange(trials), n)
        annual = np.bincount(trial_idx, weights=x, minlength=trials)
        above = np.bincount(trial_idx, weights=(x >= thresholds[r["registerId"]]).astype(float), minlength=trials)
        out[rid] = {"n": n, "annual": annual, "above": above, "polarity": r["polarity"], "registerId": r["registerId"]}
    return out


def risks_of(sim: dict) -> dict:
    return {k: v for k, v in sim.items() if k != "__drivers__"}


def subtree(doc: dict, register_id: str) -> set:
    ids = {register_id}
    changed = True
    while changed:
        changed = False
        for g in doc["registers"]:
            if g.get("parentRegisterId") in ids and g["id"] not in ids:
                ids.add(g["id"])
                changed = True
    return ids


def register_loss(doc: dict, sim: dict, register_id: str, trials: int) -> np.ndarray:
    ids = subtree(doc, register_id)
    s = np.zeros(trials)
    for v in risks_of(sim).values():
        if v["polarity"] == "negative" and v["registerId"] in ids:
            s += v["annual"]
    return s


def tolerance_at(points: list, x: float) -> float:
    """SPEC.md Sec. 8.9. No limit below the first point, log-log interpolation, last-slope extrapolation above."""
    pts = sorted(points, key=lambda p: p["loss"])
    xs = [math.log10(p["loss"]) for p in pts]
    ps = [math.log10(p["maxExceedanceProbability"]) for p in pts]
    lx = math.log10(x)
    if lx < xs[0]:
        return 1.0
    if lx == xs[0]:
        return 10 ** ps[0]
    for i in range(1, len(xs)):
        if lx <= xs[i]:
            w = (lx - xs[i - 1]) / (xs[i] - xs[i - 1])
            return 10 ** (ps[i - 1] + w * (ps[i] - ps[i - 1]))
    slope = (ps[-1] - ps[-2]) / (xs[-1] - xs[-2])
    return max(1e-6, 10 ** (ps[-1] + slope * (lx - xs[-1])))


def _excess(doc: dict, s: np.ndarray):
    """LEC minus tolerance on the SPEC.md Sec. 8.8 grid, and the log10 step of the grid."""
    appetite = doc.get("appetite", {})
    curve = appetite.get("toleranceCurve")
    if not curve:
        return None, 0.0
    cap = appetite.get("capacity", {}).get("amount", max(p["loss"] for p in curve["points"]))
    x_min = max(1.0, 0.001 * cap)
    x_max = max(10.0 * cap, float(s.max()) if s.size else 10.0 * cap)
    grid = np.logspace(math.log10(x_min), math.log10(x_max), 200)
    lec = 1.0 - np.searchsorted(np.sort(s), grid, side="right") / len(s)
    tol = np.array([tolerance_at(curve["points"], x) for x in grid])
    return lec - tol, (math.log10(x_max) - math.log10(x_min)) / 199


def clear_breach(doc: dict, s: np.ndarray) -> bool:
    """True if LEC minus 2 standard errors is above the tolerance curve at some grid point (SPEC.md Sec. 8.9)."""
    ex, _ = _excess(doc, s)
    if ex is None:
        return False
    appetite = doc["appetite"]
    cap = appetite.get("capacity", {}).get("amount", max(p["loss"] for p in appetite["toleranceCurve"]["points"]))
    grid = np.logspace(math.log10(max(1.0, 0.001 * cap)), math.log10(max(10.0 * cap, float(s.max()))), 200)
    lec = 1.0 - np.searchsorted(np.sort(s), grid, side="right") / len(s)
    se = np.sqrt(lec * (1.0 - lec) / len(s))
    return bool(np.any(ex - 2.0 * se > 0))


def tolerance_gap(doc: dict, s: np.ndarray) -> float:
    """Largest excess of the loss exceedance curve over the tolerance curve. Decides breach."""
    ex, _ = _excess(doc, s)
    return 0.0 if ex is None else max(0.0, float(ex.max()))


def tolerance_area(doc: dict, s: np.ndarray) -> float:
    """Excess area above the tolerance curve on a log10 loss axis. Ranks responses (SPEC.md Sec. 8.9)."""
    ex, step = _excess(doc, s)
    return 0.0 if ex is None else float(np.maximum(0.0, ex).sum() * step)


def options_by_id(doc: dict) -> dict:
    return {r["id"]: r for r in doc.get("responses", [])}


def effects_to_overrides(doc: dict, option_ids: list) -> dict:
    o = {}
    by_id = options_by_id(doc)
    for oid in option_ids:
        for e in by_id[oid]["effects"]:
            for part in ("frequency", "impactPerEvent"):
                if part in e:
                    o[(e["targetKind"], e["targetId"], part)] = e[part]
    return o


def metrics(doc: dict, trials: int, seed: int, option_ids: list) -> dict:
    sim = simulate(doc, trials, seed, effects_to_overrides(doc, option_ids), set(option_ids))
    roots = [g["id"] for g in doc["registers"] if not g.get("parentRegisterId")]
    s = sum(register_loss(doc, sim, rid, trials) for rid in roots)
    gain = np.zeros(trials)
    for v in risks_of(sim).values():
        if v["polarity"] == "positive":
            gain = gain + v["annual"]
    return {"eal": float(s.mean()), "eag": float(gain.mean()), "gap": tolerance_gap(doc, s),
            "area": tolerance_area(doc, s), "s": s, "g": gain, "sim": sim}


def cash(opt: dict) -> float:
    c = opt["costs"]
    return c["oneOff"] + c["annual"] + c.get("reserveAmount", 0.0)


def trigger_probability(opt: dict, m: dict) -> float:
    """P(at least one event of any effect target) in the run with the option funded. SPEC.md Sec. 8.10."""
    hit = None
    for e in opt["effects"]:
        if e["targetKind"] == "driver":
            v = m["sim"]["__drivers__"][e["targetId"]] >= 1
        else:
            r = m["sim"].get(e["targetId"])
            v = r["n"] >= 1 if r is not None else np.zeros(len(m["s"]), dtype=bool)
        hit = v if hit is None else (hit | v)
    return float(hit.mean())


def annualized(opt: dict, m: dict | None = None) -> float:
    c = opt["costs"]
    base = c["oneOff"] / c["lifetimeYears"] + c["annual"]
    if c.get("reserveAmount") and m is not None:
        base += c["reserveAmount"] * trigger_probability(opt, m)
    return base


def _targets(doc: dict) -> dict:
    return {r["id"]: {(e["targetKind"], e["targetId"]) for e in r["effects"]} for r in doc.get("responses", [])}


def feasible_portfolios(doc: dict, budget: float) -> list:
    """All option sets that respect forced choices, alternatives and the first-year cash budget (SPEC.md Sec. 8.11)."""
    by_id = options_by_id(doc)
    targets = _targets(doc)
    pool = [o for o in by_id.values() if o["status"] in ("candidate", "selected") and o.get("forced", {}).get("action") != "exclude"]
    required = [o["id"] for o in pool if o.get("forced", {}).get("action") == "require"]
    free = [o["id"] for o in pool if o["id"] not in required]
    out = []
    for mask in range(1 << len(free)):
        ids = required + [free[i] for i in range(len(free)) if mask >> i & 1]
        if sum(cash(by_id[i]) for i in ids) > budget:
            continue
        if any(targets[a] & targets[b] for i, a in enumerate(ids) for b in ids[i + 1:]):
            continue
        out.append(sorted(ids))
    return out


def _evaluate(doc: dict, base: dict, ids: list, trials: int, seed: int) -> dict:
    by_id = options_by_id(doc)
    m = metrics(doc, trials, seed, ids)
    cost = sum(annualized(by_id[i], m) for i in ids)
    benefit = (base["eal"] - m["eal"]) + (m["eag"] - base["eag"])
    return {"ids": ids, "m": m, "cost": cost, "benefit": benefit, "net": benefit - cost, "gap": m["gap"],
            "clear": clear_breach(doc, m["s"]), "area": m["area"], "cash": sum(cash(by_id[i]) for i in ids)}


def _rank_key(e: dict) -> tuple:
    # No clear breach first, then highest net benefit. With a clear breach, smallest excess area first.
    return (0, -e["net"]) if not e["clear"] else (1, e["area"], -e["net"])


def _paired_se(base: dict, a: dict, b: dict) -> float:
    """Batch-means standard error of net(a) - net(b). Costs are treated as constants."""
    d = (b["m"]["s"] - a["m"]["s"]) + (a["m"]["g"] - b["m"]["g"])
    parts = [x.mean() for x in np.array_split(d, BATCHES)]
    return float(np.std(parts, ddof=1) / math.sqrt(BATCHES))


def optimize(doc: dict, budget: float, trials: int, seed: int, confirm_trials: int = 100000, limit: int = 256) -> dict:
    """SPEC.md Sec. 8.11 algorithmic optimization. Exact search over feasible portfolios."""
    sets = feasible_portfolios(doc, budget)
    if len(sets) > limit:
        raise SystemExit(f"{len(sets)} portfolios, above the limit {limit}. The engine uses the greedy fallback here.")
    base = metrics(doc, trials, seed, [])
    evals = sorted((_evaluate(doc, base, ids, trials, seed) for ids in sets), key=_rank_key)
    # Confirm candidates in rank order at confirm_trials. A candidate that breaches tolerance there is dropped.
    big = metrics(doc, confirm_trials, seed, [])
    confirmed, dropped = [], []
    for e in evals:
        c = _evaluate(doc, big, e["ids"], confirm_trials, seed)
        if not e["clear"] and c["gap"] > 0:
            dropped.append(e["ids"])
            continue
        confirmed.append(c)
        if len(confirmed) == 2:
            break
    note = f"confirmed at {confirm_trials} trials" + (f", dropped {dropped} for a breach" if dropped else "")
    if len(confirmed) == 2 and _rank_key(confirmed[0])[0] == _rank_key(confirmed[1])[0] == 0:
        confirmed.sort(key=_rank_key)
        if confirmed[0]["net"] - confirmed[1]["net"] < 2 * _paired_se(big, confirmed[0], confirmed[1]):
            confirmed.sort(key=lambda e: (e["cash"], e["ids"]))
            note += ", too close to call, lower first-year cash wins"
    evals = confirmed + [e for e in evals if e["ids"] not in [c["ids"] for c in confirmed] and e["ids"] not in dropped]
    best = evals[0]
    # Marginal value of each funded option: drop it and compare net benefit.
    marginal = {}
    for i in best["ids"]:
        rest = [x for x in best["ids"] if x != i]
        e = _evaluate(doc, base, rest, trials, seed)
        marginal[i] = {"netLossIfDropped": round(best["net"] - e["net"]), "gapIfDropped": round(e["gap"], 4)}
    return {"count": len(sets), "best": best, "runnersUp": evals[1:4], "note": note, "marginal": marginal}


def fiscal(doc: dict, budget: float, trials: int, seed: int) -> list:
    """SPEC.md Sec. 8.12 fiscal optimization baseline (SP 800-221r1 Sec. 5.3.2).

    Rank leaf negative risks by expected annual loss, highest first. For each risk, fund the options that act on
    the risk or on one of its drivers, cheapest first, until the budget is exhausted.
    """
    base = metrics(doc, trials, seed, [])
    targets = _targets(doc)
    by_id = options_by_id(doc)
    eal = {k: float(v["annual"].mean()) for k, v in risks_of(base["sim"]).items() if v["polarity"] == "negative"}
    links = {r["riskId"]: {l["driverId"] for l in r.get("driverLinks", [])} for r in doc["risks"]}
    chosen: list = []
    spent = 0.0
    for rid in sorted(eal, key=lambda k: -eal[k]):
        acts = [o for o in by_id.values() if o["status"] in ("candidate", "selected")
                and any((k == "risk" and t == rid) or (k == "driver" and t in links.get(rid, set())) for k, t in targets[o["id"]])]
        for opt in sorted(acts, key=lambda o: (cash(o), o["id"])):
            if opt["id"] in chosen or any(targets[opt["id"]] & targets[c] for c in chosen):
                continue
            if spent + cash(opt) <= budget:
                chosen.append(opt["id"])
                spent += cash(opt)
    return chosen


def main() -> None:
    path = sys.argv[1]
    fill = "--fill" in sys.argv
    budget = next((float(a.split("=", 1)[1]) for a in sys.argv if a.startswith("--budget=")), None)
    doc = json.load(open(path, encoding="utf-8"))
    sim_cfg = doc.get("simulation", {"seed": 1, "trials": 100000})
    trials, seed = sim_cfg["trials"], sim_cfg["seed"]
    m = metrics(doc, trials, seed, [])
    print(f"trials={trials} seed={seed} EAL={m['eal']:.0f} EAG={m['eag']:.0f} gap={m['gap']:.4f} area={m['area']:.5f}")
    for r in doc["risks"]:
        v = m["sim"].get(r["riskId"])
        if v is None and r.get("onlyWithResponse") and r.get("estimate"):
            v = metrics(doc, trials, seed, [r["onlyWithResponse"]])["sim"].get(r["riskId"])
        if v is None:
            continue
        p = float((v["n"] >= 1).mean())
        eal = float(v["annual"].mean())
        cond = eal / p if p > 0 else 0.0
        print(f"{r['riskId']:6} p={p:.4f} p_thr={float((v['above'] >= 1).mean()):.4f} E[S|N>=1]={cond:,.0f} EAL={eal:,.0f}")
        if fill:
            r["riskLikelihood"] = round(p, 4)
            r["riskImpact"] = round(cond)
            r["exposureRating"] = round(round(p, 4) * round(cond))
    s = m["s"]
    for q in (0.5, 0.9, 0.95, 0.99, 0.996):
        print(f"  total loss P{q * 100:g} = {np.quantile(s, q):,.0f}")
    cap = doc.get("appetite", {}).get("capacity", {}).get("amount")
    if cap:
        print(f"  P(total loss > capacity {cap:,.0f}) = {(s > cap).mean():.4f}")
    for pt in doc.get("appetite", {}).get("toleranceCurve", {}).get("points", []):
        print(f"  LEC({pt['loss']:,.0f}) = {(s > pt['loss']).mean():.4f} vs tolerance {pt['maxExceedanceProbability']}")
    if fill:
        for f in doc.get("forecasts", []):
            f["probability"] = round(float((m["sim"][f["riskId"]]["above"] >= 1).mean()), 4)
        json.dump(doc, open(path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
        open(path, "a", encoding="utf-8").write("\n")
    if budget:
        res = optimize(doc, budget, 20000, seed)
        b = res["best"]
        print(f"algorithmic optimization, budget {budget:,.0f}, {res['count']} feasible portfolios, 20000 ranking trials")
        print(f"   best {b['ids']} cash={b['cash']:,.0f} annualCost={b['cost']:,.0f} benefit={b['benefit']:,.0f} "
              f"net={b['net']:,.0f} gap={b['gap']:.4f} {res['note']}")
        for e in res["runnersUp"]:
            print(f"   next {e['ids']} cash={e['cash']:,.0f} net={e['net']:,.0f} gap={e['gap']:.4f}")
        print("   marginal", res["marginal"])
        fm = metrics(doc, trials, seed, b["ids"])
        print(f"   after ({trials} trials): EAL={fm['eal']:,.0f} EAG={fm['eag']:,.0f} gap={fm['gap']:.4f}")
        for pt in doc.get("appetite", {}).get("toleranceCurve", {}).get("points", []):
            print(f"     LEC({pt['loss']:,.0f}) = {(fm['s'] > pt['loss']).mean():.4f} vs {pt['maxExceedanceProbability']}")
        fz = fiscal(doc, budget, trials, seed)
        f2 = metrics(doc, trials, seed, fz)
        print(f"fiscal baseline funds {fz}: EAL={f2['eal']:,.0f} EAG={f2['eag']:,.0f} gap={f2['gap']:.4f}")


if __name__ == "__main__":
    main()
