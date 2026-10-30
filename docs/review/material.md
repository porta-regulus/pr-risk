# AT-6 review material

SPEC.md Sec. 12.6 names the material. It is the decision record, the ERR and ERP views and the IR 8286 export of example 2, and the same outputs of one register that each reviewer builds.

## 1. The app

1. Use the commit that is fixed for the review (README.md Sec. 2 step 2).
2. Build the app on that commit. `GITHUB_SHA` puts the commit on the start screen, so that the material shows which build made it. Without it, the start screen shows "build local".

```bash
git switch --detach <commit> && npm ci --ignore-scripts && GITHUB_SHA=$(git rev-parse HEAD) npm run build && npm run preview
```

3. Open `http://localhost:4173` in a new browser profile, so that no document of an earlier run exists. The hosted app is also correct if its start screen shows the build of the fixed commit.
4. In the print dialog, use "Save as PDF" and A4 paper.

## 2. Example 2 material (the product owner makes it)

Example 2 is a fictitious company, Example Machinery GmbH, with 120 staff and NIS2 status important entity (Annex II, manufacturing). It has 2 registers, "Company ICT and business risks" and "Product line A controller firmware and update service". The document sets the seed 20261207, 100 000 trials and a first-year cash budget of EUR 60 000. The source file is `docs/schema/examples/example-2-sme-quantitative.json`.

### M1. Decision record

1. On the start screen, under "Or open an example", select "SME with numbers (example 2)".
2. Select the document, then "Respond and optimize".
3. Select "Find the best portfolio". Wait until the ranked portfolios show.
4. Select "Print the decision record". Save it as `M1-decision-record-example-2.pdf`.
5. Write the seed, the trials, the engine version and the document hash from the record into the material list (Sec. 4).

### M2 and M3. ERR, ERP and portfolio

1. Open the document of example 2, then "Enterprise view".
2. In the section "Register in the layout of Fig. 10", set the field "Register" to "Company ICT and business risks". In the field "Registers in the profile", keep "All registers".
3. Wait until the portfolio shows its values and no run is in progress.
4. Select "Print the register, the profile and the portfolio". Save it as `M2-enterprise-view-example-2-CORP.pdf`.
5. Set the field "Register" to "Product line A controller firmware and update service". Print again and save it as `M3-enterprise-view-example-2-PROD-A.pdf`. M3 also holds the profile and the portfolio again. That is correct.

### M4. NIST IR 8286 export

1. On the start screen, select the document of example 2.
2. Under "Export", select "NIST IR 8286 JSON". The browser saves 2 files. Their names end in `.ir8286-register.json` and `.ir8286-rdr.json`.
3. If the app says that risks with placeholder numbers are left out (rule E-02), write the number in the material list.

### M5. App file, for reference

On the start screen, under "Export", select "App file (JSON)". The reviewers can open this file in the app to see the inputs behind M1 to M4.

## 3. The register that each reviewer builds

Each reviewer builds one register in the app, then makes the same outputs as M1 to M5. Use the prefix `C-` for the CISO and `A-` for the auditor, for example `C-M1-decision-record.pdf`.

1. Use a fictitious company or a case from your practice with all names removed. Do not enter confidential data. The app keeps the data in your browser only, but you send the outputs to PortaRegulus.
2. If an output holds confidential data after all, do not send it. Send the findings and the SHA-256 value of the output only.
3. You can use the help text in the app. You can ask the product owner questions. Write a question that the help text does not answer as a finding.

The register must have enough content to test each checklist item. Include at least these parts.

| Part | Screen | Checklist item |
|---|---|---|
| Context with objectives, roles and the management body | Context and strategy | 1, 2 |
| Capacity and a tolerance curve, with "approved by" and the date | Context and strategy | 2, 3 |
| 5 or more risks with estimates, owners and objectives | Identify and analyze | 1, 3 |
| 1 or more drivers, for example a supplier | Identify and analyze, or Respond and optimize | 3 |
| 2 or more response options with costs and effects, and a budget | Respond and optimize | 3 |
| 1 or more accepted risks, each with an acceptance record and a reason | Respond and optimize, or Monitor and adjust | 2, 3 |
| A review cycle and a review date | Context and strategy, Monitor and adjust | 3 |
| A register for one product, with vulnerability evidence on 1 or more risks (for example a CVD Portal export, SPEC.md Sec. 9.5) | Identify and analyze, tab Evidence | 4, 5 |

## 4. Material list

The product owner fills in the rows for example 2. Each reviewer adds the rows for their own register. Calculate each SHA-256 value with `shasum -a 256 <file>` on macOS or `sha256sum <file>` on Linux.

| Item | Value |
|---|---|
| App commit | |
| App version on the start screen | |
| Date the material was made | |
| Made by | |
| Seed, trials, engine version and document hash in M1 | |
| Risks left out of M4 (rule E-02) | |

| ID | File name | SHA-256 | Made by |
|---|---|---|---|
| M1 | | | |
| M2 | | | |
| M3 | | | |
| M4 register | | | |
| M4 RDR | | | |
| M5 | | | |
| C-M1 | | | |
| C-M2 | | | |
| C-M4 register | | | |
| C-M4 RDR | | | |
| C-M5 | | | |
| A-M1 | | | |
| A-M2 | | | |
| A-M4 register | | | |
| A-M4 RDR | | | |
| A-M5 | | | |
