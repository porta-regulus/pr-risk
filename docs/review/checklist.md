# AT-6 checklist

Each reviewer fills in one copy. The 5 items and the expected results come from SPEC.md Sec. 12.6. The expected result is what release 1 claims. Your result is your own judgment of the material. Do not copy the expected result.

| Item | Value |
|---|---|
| Reviewer role | CISO or ISO/IEC 27001 lead auditor |
| Reviewer name | |
| Date | |
| App commit (material.md Sec. 4) | |
| SHA-256 values of the material checked | Yes or no |

## 1. Terms

| Term | Meaning |
|---|---|
| Met | The material gives enough evidence for the item. |
| Partial | The material gives evidence for some parts of the item only. |
| Not met | The material gives no useful evidence for the item. |
| Blocking finding | A finding on a NIS2 item (items 1 to 3) where one of these is true. (a) The item does not reach its expected result. (b) A number or a statement in the material is wrong. (c) A management body or a supervisor would read the material in a way that changes the decision or the evidence. |
| Major finding | A gap that a supervisor or an auditor would ask about, but that does not block the item |
| Minor finding | A problem of wording, layout or clarity |
| Release 2 input | A gap on a CRA item that is there by design (ADR-0001) |
| Claim | A CRA finding where the material says that the app does more for the CRA than ADR-0001 allows. The product owner decides on each claim before the release. |

CRA findings (items 4 and 5) never block AT-6. Write them in the findings log with the severity major, minor or release 2 input, and mark a claim.

## 2. Items

### Item 1. NIS2 risk analysis policy evidence

| | |
|---|---|
| Source | Directive (EU) 2022/2555, Article 21(2), point (a). The measures include "policies on risk analysis and information system security". |
| Claim of the app | The register and the decision record are the evidence for point (a) (ADR-0001, table "Evidence"). |
| Expected result in release 1 | Met |
| Question | Does the material show that the entity has a policy on risk analysis and applies it, in a form that a supervisor can check? |
| Where to look | M1 sections 02 Appetite and 10 Method note. M2 and M3 (ERR and ERP). M4. The screen "Context and strategy" for the method, the scales and the review cycle. |
| Your result | Met, partial or not met |
| Finding IDs | |
| Notes | |

### Item 2. NIS2 management body approval evidence

| | |
|---|---|
| Source | Directive (EU) 2022/2555, Article 20(1). Management bodies "approve the cybersecurity risk-management measures", "oversee its implementation" and "can be held liable". |
| Claim of the app | The management body approves the decision record. The record holds approval lines, the tolerance curve with "approved by" and the date, and the accepted residual risk with a reason for each risk (ADR-0001, SPEC.md Sec. 4). |
| Expected result in release 1 | Met |
| Question | Can a management body approve the measures from the record, and can a supervisor see later who approved what, and when? Does the material help the management body to oversee the implementation? |
| Where to look | M1 sections 02 Appetite, 04 Funded portfolio, 06 Not funded, 08 Accepted residual risk and 09 Approval. The screen "Monitor and adjust" for acceptance records and review triggers. |
| Your result | Met, partial or not met |
| Finding IDs | |
| Notes | |

### Item 3. Implementing Regulation (EU) 2024/2690, Annex points 2.1.1 to 2.1.4

These points bind only the entity types of Article 1 of the Regulation. For other entities, check them as good practice. Example 2 is a manufacturer, so they are good practice for it.

Expected result in release 1. Met, except the review cadence of point 2.1.4, which is a process outside the app.

| Point | Short content (own words, with short quotes) | Where to look | Your result | Finding IDs |
|---|---|---|---|---|
| 2.1.1 | A risk management framework. Risk assessments are done and documented. A risk treatment plan is made, applied and monitored. Assessment results and residual risks are "accepted by management bodies", or by accountable persons with reports to the management body. | M1, M2, M3, M4 | | |
| 2.1.2 (a) | A risk management methodology | M1 section 10. Screen "Context and strategy" | | |
| 2.1.2 (b) | The "risk tolerance level in accordance with the risk appetite" | M1 section 02 | | |
| 2.1.2 (c) | Risk criteria | Screen "Context and strategy" (scales and thresholds) | | |
| 2.1.2 (d) | Risks are identified and documented with an all-hazards approach, also risks from third parties and single points of failure. | M2, M3, M4. Drivers in the app | | |
| 2.1.2 (e) | Risks are analysed, with threat, likelihood, impact and risk level, and with threat intelligence and vulnerabilities. | M2, M3, M4. Risk editor tabs Scenario, Estimate and Evidence | | |
| 2.1.2 (f) | Risks are evaluated against the risk criteria. | M1 section 03. Screen "Prioritize" | | |
| 2.1.2 (g) | Treatment options are identified and prioritised. | M1 sections 04, 05 and 06 | | |
| 2.1.2 (h) | The implementation of the treatment measures is monitored. | Screen "Monitor and adjust" | | |
| 2.1.2 (i) | Who implements each treatment measure, and when | M1 section 04 (owner and date of each funded response) | | |
| 2.1.2 (j) | A risk treatment plan, and "the reasons justifying the acceptance of residual risks" | M1 sections 04, 06 and 08 | | |
| 2.1.3 | Treatment options are prioritised with the risk assessment results, the effectiveness of the measures, "the cost of implementation in relation to the expected benefit", the asset classification (point 12.1) and the business impact analysis (point 4.1.3). | M1 sections 04 and 05. Assets in the app | | |
| 2.1.4 | Assessment results and the treatment plan are reviewed "at least annually", and after significant changes or significant incidents. | Screen "Context and strategy" (review cycle). Screen "Monitor and adjust" (review triggers) | | |

| | |
|---|---|
| Your result for item 3 | Met, partial or not met |
| Notes | |

### Item 4. CRA Article 13(2) and (3)

| | |
|---|---|
| Source | Regulation (EU) 2024/2847, Article 13(2) and (3). The manufacturer does "an assessment of the cybersecurity risks" of a product with digital elements. The manufacturer uses the outcome in the planning, design, development, production, delivery and maintenance phases. The assessment is documented and updated during the support period. It says whether and how Annex I, Part I, point (2) applies, and how the manufacturer applies Part I, point (1) and Part II. |
| Claim of the app | Partial by design. The app does not do the CRA product risk assessment of Article 13(2) and (3), because cost and risk tolerance are not relevant to it (ADR-0001, Commission guidance C(2026) 5252 para. 158). |
| Expected result in release 1 | Partial by design (ADR-0001). Gaps go into the log as release 2 input. |
| Questions | (a) Does the material say anywhere that it is the Article 13(2) assessment? If so, write a claim finding. (b) Which parts of Article 13(3) can the material support, for example the documentation and the updates during the support period? (c) Which gaps must release 2 close? |
| Where to look | M1 section 10 and the risks of the product register in M3 and M4. The help text in the app. |
| Your result | Met, partial or not met |
| Finding IDs | |
| Notes | |

### Item 5. CRA Annex I, Part I, point (1), Part I, point (2), introductory words, and Part II, points (1) and (2)

| | |
|---|---|
| Source | Regulation (EU) 2024/2847, Annex I. Part I, point (1), an "appropriate level of cybersecurity based on the risks". Part I, point (2), introductory words, the requirements apply on the basis of the risk assessment of Article 13(2). Part II, point (1), identify and document vulnerabilities and components, with a software bill of materials. Part II, point (2), address and remediate vulnerabilities "without delay". |
| Claim of the app | Partial by design. Each risk can hold CVD Portal vulnerability evidence (SPEC.md Sec. 9.5). |
| Expected result in release 1 | Partial by design. CVD Portal evidence per risk. |
| Questions | (a) Does the evidence on a risk let a reader trace a vulnerability to the risk and to its response? (b) Does the material say anywhere that it covers more of Annex I than this? If so, write a claim finding. (c) Which gaps must release 2 close? |
| Where to look | Example 2 risk R-08 in the register "Product line A controller firmware and update service", tab Evidence. M3 and M4. |
| Your result | Met, partial or not met |
| Finding IDs | |
| Notes | |

## 3. Summary

| Item | Expected result (SPEC.md Sec. 12.6) | Your result | Blocking findings |
|---|---|---|---|
| 1. NIS2 Art. 21(2)(a) risk analysis policy evidence | Met | | |
| 2. NIS2 Art. 20(1) management body approval evidence | Met | | |
| 3. Reg. 2024/2690 Annex 2.1.1 to 2.1.4, as good practice where not binding | Met, except the 2.1.4 review cadence, which is a process outside the app | | |
| 4. CRA Art. 13(2) and (3) | Partial by design (ADR-0001). Gaps logged as release 2 input. | | Not applicable |
| 5. CRA Annex I Part I point 1, point 2 introduction, Part II points 1 and 2 | Partial by design. CVD Portal evidence per risk. | | Not applicable |
