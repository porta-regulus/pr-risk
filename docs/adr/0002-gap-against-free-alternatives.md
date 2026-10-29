# ADR-0002 Gap against free alternatives

| Item | Value |
|---|---|
| Status | Accepted, with a stop rule |
| Date | 2026-10-27 |
| Checked versions | CISO Assistant Community v4.1.5 (tag 2026-10-24, main 3516677), SimpleRisk 20261020-001, Eramba Community 3.31.2, pyfair 0.1a13, Evaluator 0.4.4, riskquant 0.1.0 |

## Decision

There is a gap, but it is narrow. Build the app only for the gap, and make it work with CISO Assistant instead of against it.

The gap in one sentence.

> No free tool lets an SME rank candidate risk responses by their effect on a register-wide loss exceedance curve against a tolerance curve, where shared drivers make risks occur together, where opportunities compete for the same budget, with no server, and with the result exported as valid NIST IR 8286 JSON and OSCAL POA&M.

**Stop rule.** Stop the build and contribute upstream instead if one of these is true before the release 1 beta.
1. CISO Assistant ships shared-driver aggregation and positive risks in its quantitative module.
2. In the usability test, 3 of 5 users cannot name one reason to use this app instead of CISO Assistant.

## Evidence

The full matrix and the clones are from the competitor review of 2026-10-27. I checked the CISO Assistant claims myself in `backend/crq/utils.py` and `backend/crq/models.py`.

| Release 1 claim | CISO Assistant Community | SimpleRisk | Eramba CE | pyfair, Evaluator, riskquant |
|---|---|---|---|---|
| 1. 90% ranges, lognormal or PERT, seeded Monte Carlo | Partial. Loss is lognormal from a 90% interval. Frequency is one annual probability with at most one event per year. Seeds are fixed at 41, 42 and 43 (`crq/models.py` L233, L297, L361). | Partial and paid. Monte Carlo only in the AI Extra. | No. Matrix only. | Yes in all three. pyfair uses a non-standard PERT. |
| 2. Shared drivers, correlated aggregation | **No.** `simulate_portfolio_with_correlation` exists (`crq/utils.py` L227), but `run_combined_simulation` never receives a correlation matrix from any caller. The product docs still claim the feature. | No | No | No. All sum independent scenarios. |
| 3. Loss exceedance curve and tolerance curve | **Yes.** LEC per scenario and per study. Tolerance curve fitted from 2 points (`crq/models.py` L62 to L148). | No | No | LEC only, no tolerance curve. |
| 4. Positive risks | No. Only an audit result "opportunity for improvement". | No | No | No |
| 5. IR 8286 JSON and OSCAL POA&M exchange | No. CSV, XLSX, own JSON dump and library YAML. | No. Import-Export is a paid Extra (USD 5 000 per year). | No. CSV import only. | No |
| 6. Forecast and outcome log, Brier score | No | No | No | No |
| 7. NIS2, Reg. 2024/2690 and CRA mappings (removed from release 1 on 2026-10-27, see below) | **Yes.** Library files `nis2-directive.yaml`, the 2024/2690 annex with ENISA guidance, and `cra-regulation-annexes.yaml`. | No in core | Not verified | No |
| 8. No server, works offline in a browser | No. Django server with login. | No. PHP server. | No. Docker, and not open source (own-use licence). | Partial. Local Python or R, no register. |

CISO Assistant also computes return on security investment per treatment (`crq/models.py` L815 to L910). So the core decision "which responses to fund" is partly covered already. That changes how release 1 must rank (see below).

## What the evidence means

1. **Claims 1, 3 and 7 are not a gap.** Do not market them as new. CISO Assistant does them for free under AGPL-3.0. On 2026-10-27 the product owner narrowed release 1 to the risk components of the SP 800-221r1 table of contents, so claim 7 (regulation mappings) is no longer a release 1 feature.
2. **Claim 2 is a real gap, but its value is in structure more than in the tail.** I ran the reference model (`docs/reference/sim_reference.py`) on example 2 (`docs/schema/examples/example-2-sme-quantitative.json`) twice, once with shared drivers and once with independent copies of each driver that keep every risk's marginal distribution. With the example's estimates, P99 of annual loss changed by less than 1%, which is within Monte Carlo noise. With strong coupling (trigger probability 0.9, driver rate 0.1 to 0.6 per year) P99 rose 17% and P(loss above EUR 3 M) rose from 0.115 to 0.135. So for a typical SME register, the main value of a driver is that **one response on one driver changes several risks at once**. The tail effect matters only when one driver links several high-impact risks with high trigger probability.
3. **Correlation does not change expected loss.** The mean of a sum is the sum of the means. A ranking by expected-loss ROSI per treatment, as in CISO Assistant, gets no benefit from drivers and cannot see options that compete for one budget. Release 1 searches all affordable portfolios for the highest net benefit within tolerance (SPEC.md Sec. 8.11). In example 2 it funds insurance (O-4) and an opportunity (O-5), and it shows that the fiscal method of SP 800-221r1 Sec. 5.3.2 gives EUR 17 860 less net benefit per year with the same budget.
4. **Claims 4, 5 and 6 are real gaps.** No checked tool has them.
5. **Claim 8 is a gap only together with claims 1 to 3.** Many tools run locally, but none gives a register with an LEC and a tolerance curve in a browser.

## Consequences

1. Release 1 contains only the gap plus the minimum shared base that the gap needs (estimate entry, simulation, LEC).
2. Release 1 imports and exports OSCAL POA&M. A CISO Assistant adapter for its quantitative studies (`parameters.impact.distribution = "LOGNORMAL-CI90"`, `risk_tolerance.points`) is release 2.
3. PortaRegulus offers the shared-driver model to CISO Assistant upstream as a pull request after release 1. This costs little and builds goodwill. It also tests the stop rule.
4. The app reuses no CISO Assistant code or library YAML. Those files are AGPL-3.0 and this app is Apache-2.0 (ADR-0003). Users can load CISO Assistant library files at run time from their own disk in release 2.

## Alternatives rejected

| Alternative | Reason |
|---|---|
| Contribute everything to CISO Assistant now | It needs a Django server and a login, which fails claim 8 and the local-first decision (ADR-0004). Its frequency model allows at most one event per year. Positive risks need a data model change across its core. Do the driver part upstream, but not the whole product. |
| Fork CISO Assistant | AGPL-3.0 and a large GRC suite. The SME user needs one decision, not a suite. |
| Build a general GRC tool | No gap. CISO Assistant, SimpleRisk and Eramba already exist. |

## Assumptions

1. Eramba code was not inspected because it ships only inside Docker images under an own-use licence. Its cells are from vendor documentation.
2. FAIR-U, the OpenFAIR spreadsheet and the Hubbard spreadsheets were not opened. None of them is a register tool, so the conclusion does not depend on them.
