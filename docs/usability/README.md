# AT-5 usability test kit (build task 10)

AT-5 passes when 5 target users each finish the task in under 30 minutes without help (SPEC.md Sec. 12.5). This kit holds what the facilitator needs. It reuses the consent text and the task sheet of the pilot kit in [`docs/pilot/`](../pilot/README.md). In this kit, the facilitator is the moderator of Sec. 12.5.

This kit holds no results. The product owner runs the sessions and writes the results.

| File | Use |
|---|---|
| [screener.md](screener.md) | Select the users with it. |
| [../pilot/consent.md](../pilot/consent.md) | Read it with the user, then get a signature before the session starts. |
| [../pilot/task-sheet.md](../pilot/task-sheet.md) | Give it to the user on paper. It holds the task and the fictitious company profile. |
| [session-log.md](session-log.md) | Copy it for each session. The facilitator fills it in during and after the session. |
| [results.md](results.md) | One sheet for all sessions. It gives the AT-5 result. |

## 1. Differences from the pilot

| Item | Pilot (`docs/pilot/`) | AT-5 (this kit) |
|---|---|---|
| Users | 1 | 5, and 1 new user for each failed session |
| Help rule | Help from the facilitator ends the session as a fail. | Any intervention of the facilitator fails the session (Sec. 3). A gesture or a touch of the computer is also an intervention. |
| Time | Stopwatch | Read from the screen recording. The stopwatch is a backup only. |
| Task check | Not written down | The facilitator checks each task item in the document after the session (session-log.md Sec. 4). |
| Pass | No blocker | All 5 users finish in under 30 minutes without help. |
| App version | Not fixed | One commit for all sessions, written in results.md |

## 2. The task sheet covers Sec. 12.5

The task sheet stays as it is. Each item of the Sec. 12.5 task has a step on the sheet.

| Sec. 12.5 task item | Step on the task sheet | Note |
|---|---|---|
| Create a first register | 1 | A new document always has one register (`newDocument` in `src/ui/files.ts`). |
| Context with at least 2 objectives | 2 | |
| At least 5 risks | 3 | |
| At least 1 risk from the catalogue | 3.1 | |
| At least 1 own risk | 3.2 | |
| At least 1 positive risk | 3.3 | History item 5 (the supplier portal) gives a candidate. |
| Each risk with frequency range, impact range, owner and objective | 3.4 | |
| At least 1 driver with 2 links | 4 | History item 4 (the MSP) gives a candidate. |
| A tolerance curve with 3 or more points | 5 | The company table gives the capacity of EUR 2 M. |
| At least 2 response options | 6 | The sheet also asks for costs and effects. Sec. 12.5 does not, but an option without them does not change a risk. |
| Run the optimization | 7 | The company table gives the budget of EUR 70 000. |
| Print the decision record | 8 | "Save as PDF" in the print dialog is also a print. |

## 3. The help rule

Sec. 12.5 says "Any moderator intervention fails the session". Use these definitions in each session.

After the app opens (T0, Sec. 4), each of these is an intervention. An intervention fails the session.
1. An answer to a question, a hint, praise or a warning, for example "nearly done" or "look on the left".
2. A nod, a gesture, or a look at one part of the screen.
3. A touch of the computer, the mouse, the keyboard, the printer or the browser. This includes a reload after a crash.
4. A stop of the session by the facilitator, for any cause. Examples are a crash of the app or of the computer, a fire alarm, or a user who becomes ill. Write the cause in the session log.

These are not interventions.
1. Silence.
2. The two fixed sentences below, in these words only. The start text tells the user about them, so they give no new information.
   1. "Please keep talking." Say it when the user is silent for about 15 seconds.
   2. "I cannot answer. Please continue as if I was not here." Say it when the user asks a question or asks for help.
3. Notes and the recording.

Other help also fails the session, because Sec. 12.5 allows no help apart from the help text in the app. The user can use the task sheet, paper, a pen, the app and its help text. A phone, another browser tab, a web search or another person is help.

When the user says that they stop, the session ends as "not finished".

Do not tell the user the time. At 30:00 the session fails the pass rule, but the user can continue. The findings after 30:00 are still useful. End the session at 45:00 at the latest.

## 4. The measures

| Measure | How |
|---|---|
| Time | T0 is the first frame of the recording that shows the start screen of the app. T1 is the first frame that shows the print dialog with the decision record in it. If the user prints more than once, use the last print before the user says that the record is printed. The time is T1 minus T0, in minutes and seconds. "Under 30 minutes" means 29:59 or less. |
| Screen recording | Record the screen and the voice, not the face. Make one file for each session. Start the recording before the app opens. Stop it after the questions. |
| Think-aloud | The user says aloud what they think. For each finding, the facilitator writes the recording time and the words of the user in the session log. |

## 5. Before the sessions

1. Run the pilot first (`docs/pilot/`) and fix all its blockers. This is done criterion 5 of task 5 in `docs/HANDOFF.md`.
2. Select the users with [screener.md](screener.md). Give each user a code, U1, U2 and so on. Keep the list of names and codes apart from the logs. Delete it together with the last recording.
3. Fix one app commit for the sessions and write it in [results.md](results.md). Use a local build of that commit. `GITHUB_SHA` puts the commit on the start screen. Without it, the start screen shows "build local".

   ```bash
   git switch --detach <commit> && npm ci --ignore-scripts && GITHUB_SHA=$(git rev-parse HEAD) npm run build && npm run preview
   ```

   Use the hosted app only if no deploy happens between the first and the last session. Before each session, compare the build on the start screen with the commit in results.md.
4. Prepare the computer.
   1. Use a new browser profile for each session, so no document, no service worker and no cache of an earlier session exists.
   2. Use a computer account with no personal data on it. Turn off the notifications, so that the recording shows only the browser.
   3. Test the recording of the screen and the voice.
   4. Have a printer, or "Save as PDF" in the print dialog, ready.
   5. Put the task sheet face down on the table.
   6. If the user asked for an adjustment in the screener, for example a larger screen, set it up now. A change after T0 is an intervention.

## 6. During the session

1. Read the consent text with the user and get the signature.
2. Start the recording.
3. Read this text to the user. "Please do the task on this sheet. Say aloud what you think and what you look for. I cannot help you, and I will not answer questions. If you ask, I will say 'I cannot answer. Please continue as if I was not here.' If you are silent, I will say 'Please keep talking.' You can use the help text in the app, paper and a pen. Please do not use your phone or other web pages. The clock does not stop. Tell me when the decision record is printed, or when you want to stop."
4. Open the app in the new browser profile. Then say "Please turn the sheet and start." The time starts at T0, so the time to read the sheet counts.
5. Write the findings in the session log, with the recording time.
6. Do not intervene (Sec. 3). If an intervention or other help occurs, write the time and what occurred. The session has failed, but continue to observe if the user continues.
7. The session ends when the user says that the record is printed, when the user stops, or at 45:00.

## 7. After the session

1. Ask the questions of session-log.md Sec. 6, and write the answers down.
2. Stop the recording.
3. On the start screen, export the document with "App file (JSON)". Check each task item in this file and on the screens (session-log.md Sec. 4). Do not change the document.
4. Read T0 and T1 from the recording.
5. Fill in the session log and the row of the session in results.md.
6. Give each finding a severity as in `docs/pilot/README.md` Sec. 4. For each blocker, open an issue with the log line, the screen and the fix proposal.
7. Store the recording, the exported file and the PDF of the record encrypted. Delete them 90 days after the session at the latest (SPEC.md Sec. 12.5).

## 8. Pass, fail and new users

1. A session passes when all 4 conditions are true.
   1. Every task item of session-log.md Sec. 4 is done.
   2. T1 minus T0 is 29:59 or less.
   3. No intervention occurred.
   4. No other help occurred.
2. AT-5 passes when 5 counted sessions pass. The counted sessions are sessions 1 to 5, each failed session replaced by its new user (results.md).
3. When a session fails, find the cause and fix it. Then test with a new user (SPEC.md Sec. 12.5). Never test the same user again. A pilot user is never an AT-5 user.
4. Write the commit of each session in results.md. If a fix changes a screen that the task uses, the product owner decides whether the sessions that passed before the fix still count, and writes the reason in results.md.

## 9. Checks of ADR-0001

The sessions also check 3 assumptions of ADR-0001. Write the answers in results.md.

1. Assumption 1. The IT lead, not the owner, enters the estimates. Screener question S5 and session question 2 check it.
2. Assumption 2. Budget for risk responses is set once a year. Session question 1 checks it. If 3 of the AT-5 users say that budget is set by auditor findings only, the decision framing is wrong, and ADR-0001 must be reopened. ADR-0001 says "3 of the 5". When new users replace failed sessions, count the answers of all AT-5 users.
3. Assumption 3. The company has one currency and one risk appetite. Session question 5 checks it.

## 10. Decisions of the product owner

| Date | Decision |
|---|---|
| 2026-10-30 | Keep the two fixed sentences of Sec. 3. They are not interventions. |

## 11. Open decisions for the product owner

1. Sessions that passed before a fix (Sec. 8 item 4). The strict option is to count only sessions on the last commit. That can need up to 5 new users for each fix.
2. A thank-you payment for the users. Use a fixed amount that does not depend on the result, so that no user hurries to finish.
3. The contact details of the controller in `docs/pilot/consent.md`.
