# ADR-0003 Licence and CRA status

| Item | Value |
|---|---|
| Status | Accepted |
| Date | 2026-10-27 |
| Changed | 2026-11-02 by the product owner. The help text is Apache-2.0, not CC BY 4.0 (Decision item 1). 2026-11-06 by the product owner. Condition C7 from the conclusion of counsel (Annex I self-check, section 5, question 3). |
| Legal sources | Regulation (EU) 2024/2847 (CRA), consolidated text 02024R2847-20241120, https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R2847. Commission guidance C(2026) 5252 of 27.7.2026 (non-binding). Commission CRA FAQ v1.4 of 4.9.2026. |
| Not legal advice | Have counsel confirm before launch. The CJEU has the final word on interpretation. |

## Decision

1. **Licence.** Apache-2.0 for code, for the JSON Schema and for the help text. CC BY 4.0 for the risk catalogue content. No contributor licence agreement. No dual licence and no paid edition, ever. The help text is in the UI source files, so it has the licence of the code. A person who copies the code cannot easily follow 2 licences in 1 file. Apache-2.0 also lets people use the text again with attribution.
2. **CRA position.** PortaRegulus publishes the app so that it is not "placed on the market" under the CRA. The seven conditions below keep it outside. PortaRegulus still applies the open-source steward measures of Art. 24 on a voluntary basis, because they cost little and the acceptance tests need them anyway (SBOM, signed builds, security policy).
3. **Sign-up and leads.** The app asks for no e-mail and has no lead form. Lead capture stays on separate marketing pages of www.portaregulus.com.

## The direct answer to the question

> Does a sign-up e-mail or lead capture make PortaRegulus a CRA manufacturer?

| Design | Result | Basis |
|---|---|---|
| Mandatory sign-up e-mail used for marketing or analytics | **Yes, very likely placed on the market.** PortaRegulus becomes the manufacturer. | Recital 15 lists "requiring as a condition for use the processing of personal data for reasons other than exclusively for improving the security, compatibility or interoperability of the software". Guidance para. 54 and Example 16 (a free FOSS fitness app that requires data for "targeted advertising or analytics") say this is placing on the market. Art. 3(13) covers supply "whether for payment, monetisation or free of charge". |
| Optional newsletter or lead form inside the app | **Unclear. Treat it as a risk.** | The "condition for use" test fails, because the app works without the e-mail. But Recital 15 also lists "an intention to monetise, for instance by providing a software platform through which the manufacturer monetises other services". Guidance Examples 14 and 15 (a marketplace app and a VPN with paid servers) apply this to apps that sell other services through themselves. No example covers an optional lead form. |
| Lead form on separate marketing pages, not in the app | **No effect** on the app's status, on the text as written. | It is not a condition for use, and the app is not the platform that sells. |
| Paid support offered separately and optionally | **No effect**, if access to the app and its maintenance never depends on payment. | Guidance para. 55 and 56 say "The decisive factor is whether access to the FOSS itself ..., including its maintenance, is conditioned on remuneration." Example 18. |

If PortaRegulus ever becomes the manufacturer, these duties apply. Art. 14 reporting of actively exploited vulnerabilities and severe incidents applies already, from 11 September 2026 (Art. 71(2)). Annex I, technical documentation, conformity assessment and CE marking apply from 11 December 2027. The app is in the default class. Annex III has no risk management category. Its nearest entry, Class I item 7 "Security information and event management (SIEM) systems", needs products that "collect data from multiple sources, analyse and correlate that data" (Implementing Regulation (EU) 2025/2392). A manual register does not do this. So the conformity route would be Module A self-assessment (Art. 32(1)(a)). Re-check the class if the app ever collects log data.

## Seven conditions that keep the app outside the CRA

| # | Condition | Why |
|---|---|---|
| C1 | No account, no mandatory e-mail, no lead form in the app. | Recital 15 and Example 16. |
| C2 | No telemetry, analytics, tracking pixels or third-party scripts in the app. | Personal data processing for other reasons is a monetisation sign. ADR-0004 also needs this for security. |
| C3 | No paid edition, no paid licence, no feature gate, no in-app sales link to CVD Portal. A plain "Published by PortaRegulus" line with a link to the source repository is the limit. | Guidance para. 51 and 57 (charging a price). Recital 15 and Examples 14 and 15 (monetising other services through the app). |
| C4 | Paid support only as a separate, optional service. The app and its updates stay free for all. | Guidance para. 55 and 56. |
| C5 | The app is not the free tier of a paid product. Do not brand it "Risklet", because risklet.com sells paid reports under that name. | Guidance para. 52 and 53 (open-core). A shared brand makes the open-core reading easy for a regulator. |
| C6 | Donations, if any, do not exceed the costs of design, development and provision. | Recital 15, last sentences. |
| C7 | PortaRegulus does not market or bundle the app as a feature of CVD Portal or as an inducement to buy it. This covers the CVD Portal website, sales material, offers and contracts, not only the app (C3). A plain statement that both products exist and that the app imports a CVD Portal export is allowed. | The condition of counsel for the conclusion on Recital 15 (2026-11-06). Recital 18 makes the test product by product, so a sales link between the products outside the app can count as monetisation of the app. |

## Hosted build, self-hosted build and repository

| Distribution | Product with digital elements? | Placed on the market? |
|---|---|---|
| Hosted web app, accessed only through a browser | **No**, on that basis alone. Guidance para. 21 and Example 5. "This is typically the case for web applications, including progressive web apps, where they are accessed exclusively through a web browser." | Not applicable |
| Static bundle (zip) or container image for self-hosting | **Yes.** Guidance para. 20 says that software "supplied for local execution" is a product. | Only if supplied in the course of a commercial activity. Under C1 to C7, it is not. |
| Public source repository | Guidance para. 23 says sharing FOSS "on publicly accessible repositories is generally not considered to be placing that code on the EU market". Recital 20 agrees. | No |

There is one grey zone. The hosted app runs fully on the client, so a regulator could read it as "supplied for local execution" (para. 20). Conditions C1 to C7 also cover this reading, so the conclusion does not change.

## Steward status

Art. 3(14) defines a steward as a legal person that systematically supports FOSS "intended for commercial activities". Recital 19 includes "entities that develop and publish free and open-source software in a business context". Guidance Example 29 shows a company that publishes a free FOSS component and "does not charge for its use or monetise in other ways". That company "is not its manufacturer, but is its steward". In Example 29, other companies integrate the component into their products. Here, companies only use the app internally. So steward status is possible, not certain. Act as if it applies.

Steward duties (Art. 24) are a documented cybersecurity policy, cooperation with market surveillance authorities, and Art. 14(1) reporting "to the extent that they are involved in the development". Art. 24 applies from 11 December 2027 (Art. 71(2)). The Commission FAQ v1.4 item 5.5 reportedly confirms that date for steward reporting. I did not re-check that item. Art. 64(10)(b) excludes administrative fines for "any infringement of this Regulation by open-source software stewards". Release 1 meets the steward duties early (SPEC.md Sec. 11).

## Why Apache-2.0 and not AGPL-3.0

| Factor | Apache-2.0 | AGPL-3.0 |
|---|---|---|
| CRA status | No effect. Both meet Art. 3(48). Guidance para. 44 names no licence. | No effect by itself. But the usual AGPL business model, selling an exception licence, is "charging a price" (para. 51) and makes PortaRegulus a manufacturer. |
| Exchange format adoption (the goal of the schema) | Anyone can embed the schema and the adapters, including closed GRC tools and CISO Assistant (Apache-2.0 code may go into AGPL-3.0 code). | Closed tools cannot embed it. The schema spreads less. |
| Patent grant | Explicit (section 3) | Implicit under GPLv3 section 11 |
| SME legal review | Usually approved without a meeting | Often blocked by company policy |
| Risk of a closed hosted fork | Possible | Blocked by section 13 |

The last row is the only argument for AGPL. The app has no server, so a hosted fork adds little value to a competitor. Apache-2.0 wins.

**Consequence.** The repository cannot copy CISO Assistant library YAML (AGPL-3.0) or VCDB data (CC BY-SA 4.0). Release 1 needs neither, because it ships no regulation mappings (SPEC.md Sec. 3.2). Cyentia IRIS numbers appear only as cited ranges in help text, not as shipped tables, until Cyentia grants permission.

## Assumptions

1. PortaRegulus is an EU legal person.
2. PortaRegulus owns the Risklet catalogue (`Risklet Risks.xlsx`, 119 names). If not, it cannot ship under CC BY 4.0 (open question Q3).
3. The guidance C(2026) 5252 stays as published. It is not binding.

## Review triggers

1. Any plan for a paid feature, a hosted sync service, a sign-up or analytics.
2. A new Commission guidance version or a CJEU ruling on Recital 15.
3. The app starts to collect log data (Annex III Class I item 7).
