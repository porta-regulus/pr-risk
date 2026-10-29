# ADR-0005 Release 1 scope by the SP 800-221r1 table of contents

| Item | Value |
|---|---|
| Status | Accepted |
| Date | 2026-10-27 |
| Deciders | PortaRegulus (product owner) |
| Changes | Narrows ADR-0002 (claim 7 removed). Widens the original "go deep, not wide" brief. |

## Decision

Release 1 covers the risk components of NIST SP 800-221r1 ipd as its table of contents names them. SPEC.md Sec. 3.1 is the binding list. All 37 modules marked In and all 6 modules marked Partial are in release 1, with the limits stated there. The 2 modules marked Out (3.2 Risk Culture, Appendix C) and the items in SPEC.md Sec. 3.2 are not.

Release 1 has no per-risk regulation or framework mappings. Responses can name informative references (Sec. 3.6).

## Why

The product owner asked to focus exclusively on risk and its components as in the SP 800-221r1 table of contents, and then confirmed that all 37 In modules stay in release 1.

## Consequences

1. Release 1 is wider than the first brief. Most added modules are data fields and views on the same model (context, strategy, assets, ERP, acceptance records), so the engine and the schema stay one design.
2. Build tasks 6 and 7 (screens S6 and S7) are release 1 work, not optional (HANDOFF.md Sec. 5).
3. The usability test AT-5 keeps its task and its 30-minute limit. The task uses screens S1 to S5 only. S6 and S7 are reviewed in AT-6.
4. A feature that does not trace to a ToC entry in SPEC.md Sec. 3.1 needs a new ADR before it enters release 1.
5. When NIST publishes the final SP 800-221r1, the concept id table (SPEC.md Sec. 3.1) is updated and every changed entry is checked against this scope.

## Risk of this decision

More modules means a longer path to the first usable release. Mitigation is the build order in HANDOFF.md. The funding decision (screens S1 to S5) ships first and is tested with users before S6 and S7.
