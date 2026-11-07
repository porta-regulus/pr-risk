# Pilot session kit (build task 5, done criterion 5)

Done criterion 5 says that a pilot session with one target user finds no blocker. This kit holds what the facilitator needs. The pilot uses the AT-5 task and rules of SPEC.md Sec. 12.5, with one user.

| File | Use |
|---|---|
| [consent.md](consent.md) | Read it with the participant, then get a signature before the session starts. |
| [task-sheet.md](task-sheet.md) | Give it to the participant on paper. It holds the task and the fictitious company profile. |
| [log.md](log.md) | The facilitator fills it in during and after the session. |

The AT-5 kit in [`docs/usability/`](../usability/README.md) uses the same consent text and task sheet, with a stricter help rule.

## 1. The participant

1. The person matches ADR-0001. They prepare the NIS2 risk analysis, usually as IT lead or part-time CISO, in an EU company with 50 to 249 staff.
2. The person is not PortaRegulus staff and not a customer of a paid PortaRegulus product.
3. The person is not one of the 5 later AT-5 users. A pilot user can never be an AT-5 user.
4. Record the role, the company size band and the sector only. Do not record the name in the log.

## 2. Before the session

1. Build main on the facilitator laptop. Do not use https://risk.portaregulus.com before the release tag. It deploys only on a `v*` tag, so until then it has rc.3, without the guided mode and the help on click (docs/ux/redesign-plan.md).

```bash
npm ci --ignore-scripts && GITHUB_SHA=$(git rev-parse HEAD) npm run build && npm run preview
```

   `GITHUB_SHA` puts the commit on the start screen. Without it, the start screen shows "build local".

2. Open the app at `http://localhost:4173` in a new browser profile, so no document and no service worker from an earlier run exists.
3. Start the screen recording. Record the screen and the voice, not the face.
4. Have a printer or "Save as PDF" ready. The task ends with the printed decision record.
5. Put a clock where the facilitator can see it, not the participant.

## 3. During the session

1. Read this text to the participant. "Please do the task on the sheet. Say aloud what you think and what you look for. I cannot help you. The help text in the app is allowed. Stop when the decision record is printed."
2. Start the clock when the participant first sees the start screen. The participant starts in the guided mode and may open the full editor (SPEC.md Sec. 12.5).
3. Do not answer questions about the app and do not explain a word. If the participant asks, say "What would you do if I was not here?" Write each word that the participant asks about in the log.
4. Any help from the facilitator makes the session a fail (SPEC.md Sec. 12.5). Write the moment and the reason in the log. Help only when the participant is stuck for 4 minutes, and then give the smallest hint that lets them continue. The session then goes on, so it can find more blockers, but it stays a fail.
5. Stop the clock when the print dialog or the PDF of the decision record shows. Stop the task at 45 minutes and write the step where the participant stopped.
6. Fill in the step table of the log. Mark each "?" explanation that the participant opens.

## 4. What a blocker is

A finding is a blocker when one of these is true.

1. The participant cannot finish a step of the task without help.
2. The app shows an error, stops, or loses data that the participant entered.
3. A number on a screen or in the record is wrong. Compare it with the Python reference if in doubt (`docs/reference/sim_reference.py`).
4. The participant reads the decision record in a way that would change the decision, for example funds the wrong option or misses the accepted residual risk.
5. The participant says that the decision framing is wrong for their company (ADR-0001 assumption 2). This is a blocker for the ADR, not only for the app.

All other findings are major or minor. A major finding costs the participant more than 2 minutes or makes them doubt a number. A minor finding is a wording or layout problem.

## 5. After the session

1. Ask the 3 questions at the end of the log, and write the answers down.
2. Fill in the result table of the log.
3. For each blocker, open an issue with the log line, the screen and the fix proposal. Fix it before the 5 AT-5 sessions start.
4. Write the result into done criterion 5 of `docs/HANDOFF.md` and into docs/ux/redesign-plan.md Sec. 5.5 (phase 6), with the date, the role of the participant, the time and the blocker count.
5. Delete the recording after 90 days (SPEC.md Sec. 12.5).
