# AT-5 session log

Copy this file for each session, for example as `session-U1.md`. Do not write the name of the user here. The rules are in [README.md](README.md).

## 1. Session

| Item | Value |
|---|---|
| User code | |
| Date | |
| Facilitator | |
| User role (screener S4) | |
| Company staff band (screener S2) | |
| Sector | |
| NIS2 status (screener S3, entity or supplier) | |
| App version on the start screen, and commit | |
| Same commit as in results.md | Yes or no |
| Browser and operating system | |
| Local build or hosted app | |
| New browser profile | Yes or no |
| Consent signed | Yes or no |
| Recording file name | |

## 2. Time

Read T0 and T1 from the recording (README.md Sec. 4).

| Item | Value |
|---|---|
| T0, recording time when the start screen first shows | |
| T1, recording time when the print dialog with the decision record first shows (last print) | |
| T1 minus T0, in minutes and seconds | |
| Stopwatch time, backup only | |

## 3. Interventions, other help and fixed sentences

Write one line for each event. An intervention or other help fails the session (README.md Sec. 3). A fixed sentence is not an intervention, but write it down.

| Recording time | Event (intervention, other help, or fixed sentence 1 or 2) | What occurred |
|---|---|---|
| | | |
| | | |
| | | |

## 4. Task check

Check each item after the session, on the screens and in the exported app file. Do not change the document. Every item must be "yes" for the session to pass.

| No. | Task item (SPEC.md Sec. 12.5) | Where to check | Done (yes or no) |
|---|---|---|---|
| 1 | The user created a new document for Example Valves GmbH, with its first register. | S1 document list. Fields `document` and `registers` | |
| 2 | The context has 2 or more objectives. | S2. Field `context.objectives` | |
| 3 | 5 or more risks each have a frequency range, an impact range, an owner and an objective. | S3 risk editor. In `risks`, the fields `estimate.frequency` and `estimate.impactPerEvent` (lower and upper, or min and max for PERT), `riskOwnerPointOfContact` and `objectiveIds` | |
| 4 | Of the risks of item 3, 1 or more come from the catalogue. | Field `catalogueRef` is present. | |
| 5 | Of the risks of item 3, 1 or more are the user's own. | Field `catalogueRef` is absent. | |
| 6 | Of the risks of item 3, 1 or more are positive. | Field `polarity` is `positive`. | |
| 7 | 1 or more drivers each have links from 2 or more risks. | S3 tab Drivers, or S5. Two risks have the same `driverLinks[].driverId`. | |
| 8 | The tolerance curve has 3 or more points. | S2. Field `appetite.toleranceCurve.points` | |
| 9 | The document has 2 or more response options. | S5. Field `responses` | |
| 10 | The optimization ran. | Recording. S5 showed the ranked portfolios. | |
| 11 | The decision record is printed. | Recording at T1, and the paper or the PDF | |

## 5. Observations

Write one line for each finding. Severity is blocker, major or minor (`docs/pilot/README.md` Sec. 4).

| Recording time | Screen | What occurred | What the user said | Severity | Fix proposal |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |

## 6. Questions after the task

Ask these questions after the session ends. Write the answers in the words of the user.

1. Who sets the budget for risk responses in your company, and how often? Is it set only by auditor findings? (ADR-0001 assumption 2)
2. Who enters the estimates of the risk analysis in your company? (ADR-0001 assumption 1)
3. Would your management body accept this decision record as it is? What would they ask?
4. Which step was the hardest, and why?
5. Does your company use more than one currency, or more than one risk appetite? (ADR-0001 assumption 3)

| Question | Answer |
|---|---|
| 1 | |
| 2 | |
| 3 | |
| 4 | |
| 5 | |

## 7. Result

| Item | Value |
|---|---|
| Every task item of Sec. 4 done | Yes or no |
| T1 minus T0 is 29:59 or less | Yes or no |
| No intervention | Yes or no |
| No other help | Yes or no |
| Session result (pass when all 4 rows above are yes) | Pass or fail |
| Cause of a fail | |
| Blockers | |
| Major findings | |
| Minor findings | |
| Issue links for blockers | |
| Recording deletion date (90 days at most) | |
