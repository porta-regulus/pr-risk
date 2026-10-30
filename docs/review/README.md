# AT-6 expert review kit (build task 11)

AT-6 passes when both reviewers sign that the NIS2 items have no blocking finding (SPEC.md Sec. 12.6). The CRA findings go into the findings log. They do not change the AT-6 result.

This kit holds no results. The product owner organizes the review, and the reviewers write the results.

| File | Use |
|---|---|
| [material.md](material.md) | How to make the review material in the app, and the list of material files with their SHA-256 values |
| [checklist.md](checklist.md) | The 5 checklist items of Sec. 12.6. Each reviewer fills in one copy. |
| [findings-log.md](findings-log.md) | One log for the findings of both reviewers |
| [sign-off.md](sign-off.md) | Each reviewer signs one copy. |

## 1. The reviewers

AT-6 needs 2 reviewers, 1 for each role.

| Role | Must have | Keep as evidence |
|---|---|---|
| Practising CISO | Works now as CISO, or leads information security in an organization in another role title. Has prepared a risk treatment or budget decision for a management body. An organization in NIS2 scope is preferred. | Role title, organization type and size band. Not the name of the organization. |
| ISO/IEC 27001 lead auditor with NIS2 audit experience | Holds a current ISO/IEC 27001 lead auditor qualification. Has audited the cybersecurity risk-management measures of Directive (EU) 2022/2555 Article 21 at one or more entities, for example as a third-party auditor or for a competent authority. | Certificate number and the issuing body. The number of NIS2 audits and their years, without client names. |

For the CRA items, SPEC.md Sec. 12.6 names a useful profile, the ENISA "Technical Competence Requirements for CRA Notified Bodies" (June 2026, version 1.0). Competence near this profile in one reviewer is preferred. It is not a condition of AT-6.

Both reviewers must also be independent.
1. Not PortaRegulus staff or contractor now, or in the last 12 months.
2. Not a customer, a trial user or a partner of a paid PortaRegulus product.
3. No part in the design or the build of the app.
4. Not the pilot user and not an AT-5 user.
5. The fee does not depend on the result of the review.

Each reviewer confirms these points in [sign-off.md](sign-off.md).

## 2. Steps

1. Select the 2 reviewers. Check the profile and the independence.
2. Fix one app commit for the review. If you can, use the commit after the AT-5 fixes, so that the reviewers see the material that will be released. A later change to a screen or an export of the material makes the review out of date for that part.
3. Make the material of example 2 on that commit (material.md Sec. 2). Write the SHA-256 value of each file in the material list (material.md Sec. 4).
4. Send each reviewer the material, the material list, the checklist, the findings log and the sign-off form. Give access to the app on the same commit, as a local build or as the hosted app.
5. Each reviewer builds one register and makes its material (material.md Sec. 3).
6. Each reviewer fills in the checklist and writes findings alone. Do not show the findings of one reviewer to the other before both are done, so that the two results stay independent.
7. Hold one meeting of about 60 minutes with both reviewers and the product owner. Make each finding clear. Do not change a severity in the meeting without the agreement of the reviewer who wrote it.
8. The product owner answers each finding in the findings log. A blocking finding on a NIS2 item needs a fix, new material for that part, and a new check by the reviewer who wrote the finding.
9. Each reviewer signs sign-off.md, or writes why they do not sign.
10. Write the result into `docs/HANDOFF.md` Sec. 5 row 11, with the date and the number of findings for each severity.

Plan about 7 hours of work for each reviewer. That is about 2 hours to build the register, 4 hours for the review and 1 hour for the meeting. This is an estimate, not a measured value.

## 3. Legal sources

The checklist cites these provisions. Each reference was checked against the English text on EUR-Lex on 2026-10-30. The checklist quotes short phrases only.

| Act | Provisions cited in this kit | EUR-Lex |
|---|---|---|
| Directive (EU) 2022/2555 (NIS 2 Directive) | Article 20(1). Article 21(2), point (a). | <https://eur-lex.europa.eu/eli/dir/2022/2555/oj/eng> |
| Commission Implementing Regulation (EU) 2024/2690 | Article 1. Annex, points 2.1.1, 2.1.2, 2.1.3 and 2.1.4. | <https://eur-lex.europa.eu/eli/reg_impl/2024/2690/oj/eng> |
| Regulation (EU) 2024/2847 (Cyber Resilience Act) | Article 13(2) and (3). Annex I, Part I, point (1). Annex I, Part I, point (2), introductory words. Annex I, Part II, points (1) and (2). | <https://eur-lex.europa.eu/eli/reg/2024/2847/oj/eng> |
| Regulation (EU) 2016/679 (GDPR), for the consent text of AT-5 | Article 6(1), point (a). Article 13. | <https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng> |

Two limits apply to the NIS2 items.
1. A directive binds the Member States. An entity must comply with the national law that transposes Directive (EU) 2022/2555. A reviewer can name a national rule in a finding, but the AT-6 result uses the text of the Directive.
2. Implementing Regulation (EU) 2024/2690 binds only the entity types that its Article 1 lists, for example cloud computing service providers and managed service providers. Example 2 is a manufacturer, so the Annex points are good practice for it, not law. SPEC.md Sec. 12.6 says this too.

ISO/IEC standards are not quoted. Where a reviewer cites one, cite the clause number only, for example ISO/IEC 27001:2022 clause 6.1.2 or 6.1.3.
