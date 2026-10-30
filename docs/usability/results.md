# AT-5 results

One sheet for all AT-5 sessions. Do not write names here. The pass rule is in [README.md](README.md) Sec. 8. Copy the values from the session logs.

## 1. Test setup

| Item | Value |
|---|---|
| App commit for the sessions | |
| App version on the start screen | |
| Local build or hosted app | |
| Pilot done with no open blocker (task 5, done criterion 5) | Yes or no |
| Facilitators | |

## 2. Sessions

A session passes when all 4 columns from "Task items done" to "No other help" are yes.

| Session | User code | Date | Commit | T1 minus T0 | Task items done | 29:59 or less | No intervention | No other help | Result | Blockers | Issues |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | U1 | | | | | | | | | | |
| 2 | U2 | | | | | | | | | | |
| 3 | U3 | | | | | | | | | | |
| 4 | U4 | | | | | | | | | | |
| 5 | U5 | | | | | | | | | | |

## 3. New users after a failed session

Fix the cause of the fail first. Never test the same user again.

| Session | User code | Replaces session | Fix (issue and commit) | Date | Commit | T1 minus T0 | Task items done | 29:59 or less | No intervention | No other help | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 6 | U6 | | | | | | | | | | |
| 7 | U7 | | | | | | | | | | |
| 8 | U8 | | | | | | | | | | |

Sessions that passed before a fix still count. When a fix changes a screen that the task uses, write here why each earlier pass still counts (README.md Sec. 8 item 4).

| Fix (commit) | Screens that the fix changes | Earlier passed sessions | Why each earlier pass still counts |
|---|---|---|---|
| | | | |

## 4. AT-5 result

| Item | Value |
|---|---|
| Counted sessions (sessions 1 to 5, each failed session replaced by its new user) | |
| Counted sessions that pass | |
| All 5 counted sessions pass | Yes or no |
| AT-5 result | Pass or fail |
| Product owner name, date and signature | |

Write the result into `docs/HANDOFF.md` Sec. 5 row 10, with the date and the number of sessions that passed.

## 5. Checks of ADR-0001

One row for each AT-5 user, also for users of failed sessions. The source is session-log.md Sec. 6 and the screener.

| User code | Role (S4) | Who enters the estimates (question 2) | How the budget is set (question 1) | Budget set only by auditor findings | More than one currency or risk appetite (question 5) |
|---|---|---|---|---|---|
| U1 | | | | Yes or no | |
| U2 | | | | Yes or no | |
| U3 | | | | Yes or no | |
| U4 | | | | Yes or no | |
| U5 | | | | Yes or no | |
| U6 | | | | Yes or no | |
| U7 | | | | Yes or no | |
| U8 | | | | Yes or no | |

| Check | Value |
|---|---|
| Users who say that budget is set only by auditor findings | |
| ADR-0001 must be reopened (3 or more users above) | Yes or no |
| Assumption 1 holds (the users who enter the estimates are IT leads or CISOs, not owners) | Yes, no, or mixed. Write the counts. |
| Assumption 3 holds (one currency and one risk appetite) | Yes, no, or mixed. Write the counts. |
