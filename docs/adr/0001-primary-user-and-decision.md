# ADR-0001 Primary user and the one decision

| Item | Value |
|---|---|
| Status | Accepted for release 1 |
| Date | 2026-10-27 |
| Deciders | PortaRegulus (product owner) |
| Supersedes | The "who" part of `RMS-PLAN-NIST-800-221r1.md` |

## Decision

The primary user prepares the NIS2 risk analysis in an EU company with 50 to 249 staff. The company is an essential or important entity under NIS2, or it supplies one and must show NIS2-grade risk management. This person is usually the IT lead or a part-time CISO. The management body makes the decision. The app prepares it.

The app supports one decision.

> Which candidate risk responses do we fund in the next budget cycle, with budget B, so that our loss exceedance curve stays under our risk tolerance curve? Which residual risk do we accept, and why?

The output is one funding decision record. It holds the funded responses, the rejected responses with the reason for each, the accepted residual risk, and the loss exceedance curve before and after, compared with the tolerance curve. The management body approves this record.

## Why the proposal changed

The proposal was "an EU SME owner or IT lead with NIS2 or CRA duties decides which risk responses to fund next". Two parts were weak.

1. **"SME" is too wide.** NIS2 Art. 2(1) applies to entities that "qualify as medium-sized enterprises" or exceed the ceilings. Commission Recommendation 2003/361 sets medium at fewer than 250 persons and turnover up to EUR 50 M or a balance sheet up to EUR 43 M. Micro and small companies are in scope only through the Art. 2(2) exceptions. So the realistic user works in a company with 50 to 249 staff.
2. **"NIS2 or CRA" mixes two decisions.** The NIS2 decision trades cost against risk. NIS2 Art. 21(1) asks for measures that are "appropriate and proportionate", and Implementing Regulation (EU) 2024/2690 Annex point 2.1.3 weighs cost against benefit. The CRA product risk assessment of Art. 13(2) and (3) does not allow this trade-off. Commission guidance C(2026) 5252 para. 158 says that "the manufacturer's internal risk tolerance, commercial strategy or mere cost considerations are not relevant" to it. A tool that ranks responses by value for money must not claim to do the CRA product assessment.
3. **The owner does not decide alone.** NIS2 Art. 20(1) says management bodies "approve the cybersecurity risk-management measures", "oversee its implementation" and "can be held liable". So the record must be readable by a management body, not only by the IT lead.

## Evidence

| Source | What it says | Effect on the decision |
|---|---|---|
| NIS2 Art. 21(2)(a) | "policies on risk analysis and information system security" | The register and the decision record are the evidence for point (a). |
| Reg. 2024/2690 Annex 2.1.2(b) | "establish the risk tolerance level in accordance with the risk appetite" | A tolerance curve is a first-class input. |
| Reg. 2024/2690 Annex 2.1.2(g) and 2.1.3 | Prioritise treatment options. Weigh cost against benefit. | Ranking by value for money is legitimate for NIS2. |
| Reg. 2024/2690 Annex 2.1.1 and 2.1.2(j) | Residual risks are accepted by the management body. Document "the reasons justifying the acceptance of residual risks". | The record lists accepted residual risk with a reason. |
| Reg. 2024/2690 Art. 1 | Binds only DNS, TLD, cloud, data centre, CDN, MSP, MSSP, marketplaces, search engines, social networks and trust services. | For other entities, these points are good practice, not law. The app says so. |
| CRA guidance C(2026) 5252 para. 158 | Risk tolerance and cost are not relevant to CRA product risk. | CRA product assessment is out of scope (SPEC.md Sec. 3). |
| ENISA NIS360 (May 2026) | "SMEs in sectors of high criticality consistently report greater difficulties than their larger counterparts across all dimensions of cybersecurity assessed." | The target user needs a narrow, guided tool. |
| ENISA NIS Investments, cited in NIS360 footnote 9 | Most challenging areas are vulnerability and patch management (50%), business continuity (49%) and supply-chain risk management (37%). | Shared suppliers and shared controls are real drivers. Drivers are in release 1. |

## Consequences

1. The app has no compliance checklist screens. CISO Assistant already does checklists well (ADR-0002).
2. CRA enters only as evidence. CVD Portal vulnerability exports become evidence on entity-level risks (SPEC.md Sec. 9.5).
3. Every screen serves the decision. A screen that does not change the funding decision record is out of scope for release 1.
4. The record is printable. The management body reads paper or PDF.

## Alternatives rejected

| Alternative | Reason |
|---|---|
| A CRA manufacturer doing the Art. 13(2) product risk assessment | Guidance para. 158 removes the cost trade-off, which is the core of this app. A different tool. |
| An MSSP or consultant who runs registers for many clients | Needs multi-tenant storage and sync. Release 1 is local-first (ADR-0004). Revisit for release 2. |
| A board member as the primary user | Board members read the record. They do not enter estimates. |

## Assumptions

1. The IT lead, not the owner, enters the estimates. The usability test (SPEC.md Sec. 12.5) checks this with 5 real users.
2. Budget for risk responses is set once a year. If 3 of the 5 test users say budget is set by auditor findings only, the decision framing is wrong and this ADR must be reopened.
3. The company has one currency and one risk appetite.

## Review triggers

1. COM(2026) 13 (NIS2 amendment for small mid-caps) is adopted and changes Art. 2.
2. The usability test fails the assumption in point 2 above.
