"""Write the independent reference values for the TypeScript engine tests.

1. Bit vectors of xoshiro128**, mulberry32 and the stream seeding of SPEC.md Sec. 8.6,
   from a separate Python implementation.
2. Normal quantiles from statistics.NormalDist (Python standard library).
3. The statistical oracle docs/reference/sim_reference.py (NumPy PCG64) on example 2,
   seed 20261207, 100 000 trials. The engine must agree within 4 standard errors.

The NumPy streams can change between NumPy versions, so CI does not compare this file
byte for byte. The test checks the SHA-256 of example 2 instead.

Usage: python3 -I tools/engine_reference.py > test/fixtures/engine-reference.json
"""

from __future__ import annotations

import hashlib
import json
import math
import pathlib
import statistics
import struct
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "docs" / "reference"))

import numpy as np  # noqa: E402
import sim_reference as ref  # noqa: E402

MASK = 0xFFFFFFFF


def xoshiro(state: list[int], count: int) -> list[int]:
    s = list(state)
    out = []
    rotl = lambda x, k: ((x << k) | (x >> (32 - k))) & MASK  # noqa: E731
    for _ in range(count):
        out.append((rotl((s[1] * 5) & MASK, 7) * 9) & MASK)
        t = (s[1] << 9) & MASK
        s[2] ^= s[0]
        s[3] ^= s[1]
        s[1] ^= s[2]
        s[0] ^= s[3]
        s[2] ^= t
        s[3] = rotl(s[3], 11)
    return out


def mulberry(seed: int, count: int) -> list[int]:
    a = seed & MASK
    out = []
    for _ in range(count):
        a = (a + 0x6D2B79F5) & MASK
        t = ((a ^ (a >> 15)) * (1 | a)) & MASK
        t = (t + ((t ^ (t >> 7)) * (61 | t)) & MASK) & MASK ^ t
        out.append((t ^ (t >> 14)) & MASK)
    return out


def stream_state(seed: int, key: str) -> list[int]:
    digest = hashlib.sha256(f"{seed}|{key}".encode()).digest()
    state = list(struct.unpack("<4I", digest[:16]))
    if state == [0, 0, 0, 0]:
        state[0] = 0x9E3779B9
    return state


def rng_vectors() -> dict:
    keys = ["risk|R-01|rate", "risk|R-01|impact", "driver|D-MSP|count", "risk|R-03|thin|D-MSP"]
    return {
        "xoshiro1234": xoshiro([1, 2, 3, 4], 12),
        "mulberry": {str(seed): mulberry(seed, 12) for seed in (0, 1, 0xDEADBEEF, 0xFFFFFFFF)},
        "streams": {key: {"state": stream_state(20261207, key), "words": xoshiro(stream_state(20261207, key), 6)} for key in keys},
    }


def normal_vectors() -> list:
    dist = statistics.NormalDist()
    ps = [1e-300, 1e-100, 1e-20, 1e-10, 1e-6, 0.001, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.4, 0.45, 0.5, 0.55,
          0.6, 0.75, 0.9, 0.95, 0.975, 0.99, 0.999, 1 - 1e-6, 1 - 1e-10, 0.07, 0.075, 0.925, 0.93]
    return [[p, dist.inv_cdf(p)] for p in ps]


def oracle() -> dict:
    path = ROOT / "docs" / "schema" / "examples" / "example-2-sme-quantitative.json"
    doc = json.loads(path.read_text())
    trials, seed = 100000, 20261207
    m = ref.metrics(doc, trials, seed, [])
    s = m["s"]
    risks = {}
    for rid, v in ref.risks_of(m["sim"]).items():
        p = float((v["n"] >= 1).mean())
        risks[rid] = {"p": p, "pSe": math.sqrt(p * (1 - p) / trials),
                      "eal": float(v["annual"].mean()), "ealSe": float(v["annual"].std(ddof=1) / math.sqrt(trials))}
    lec = {}
    for pt in doc["appetite"]["toleranceCurve"]["points"]:
        q = float((s > pt["loss"]).mean())
        lec[str(pt["loss"])] = {"p": q, "se": math.sqrt(q * (1 - q) / trials)}
    return {
        "exampleSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "trials": trials, "seed": seed, "numpy": np.__version__,
        "eal": m["eal"], "ealSe": float(s.std(ddof=1) / math.sqrt(trials)),
        "eag": m["eag"], "eagSe": float(m["g"].std(ddof=1) / math.sqrt(trials)),
        "gap": m["gap"], "risks": risks, "lec": lec,
    }


if __name__ == "__main__":
    json.dump({"rng": rng_vectors(), "normal": normal_vectors(), "oracle": oracle()}, sys.stdout, indent=1, sort_keys=True)
    sys.stdout.write("\n")
