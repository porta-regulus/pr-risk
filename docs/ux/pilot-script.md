# Phase 6 pilot with 1 target user

| Item | Value |
|---|---|
| Status | Ready. Not run yet. |
| Date | 2026-11-07 |
| Purpose | Find the blockers before AT-5 (SPEC.md Sec. 12.5). Phase 6 is done when no blocker is open (docs/ux/redesign-plan.md Sec. 5). |
| Time | 60 minutes. 5 for the start, 30 to 40 for the task, 10 for the questions, the rest is spare time. |

## 1. The user

1. The user matches ADR-0001. This is the IT lead or a part-time CISO of an EU company with 50 to 249 staff that is in scope of NIS2 or supplies such a company.
2. The user is not PortaRegulus staff and not a customer of a paid PortaRegulus product.
3. The user has not seen the app before.
4. The pilot user cannot be one of the 5 AT-5 users later. SPEC.md Sec. 12.5 says to never test the same user again, and the pilot shows the user the task.

## 2. Before the session

1. Get written consent (Sec. 7). Send the form one day before.
2. Build main on the laptop of the moderator. Do not use https://risk.portaregulus.com. It deploys only on a `v*` tag, so it still has rc.3, without the redesign.

   ```bash
   npm ci --ignore-scripts && GITHUB_SHA=$(git rev-parse HEAD) npm run build && npm run preview
   ```

   Open `http://localhost:4173`. The start screen shows the commit. Write it on the note sheet. If the start screen shows "build local", `GITHUB_SHA` was not set.
3. Use a clean browser profile, so that no earlier document is in the app. The app keeps all data in the browser.
4. Start a screen recording on the computer of the moderator or the user. Use a local recorder. Do not use a cloud meeting tool that keeps a copy.
5. Print the note sheet (Sec. 6). Have a clock that shows the minutes.
6. Have the company card (Sec. 4) ready on paper.

## 3. What the moderator says

Read this text. Do not add to it.

> Thank you for your time. We test the app, not you. If something is hard, the app is wrong, and that is what we want to find.
>
> Please speak your thoughts aloud while you work. Say what you look for, what you expect and what surprises you.
>
> The task is on this card. Use the app as you would at work. The app has help in it. I will not help you unless you are stuck for a long time. If you want to stop, say so.
>
> The recording shows the screen and your voice. We delete it after 90 days. The app sends nothing to us.

## 4. The task and the company card

The task is the AT-5 task (SPEC.md Sec. 12.5). Give the user this card.

> **Task.** Make a first risk register for your company and print the decision record for the management board.
>
> 1. Describe the company with at least 2 goals.
> 2. Add at least 5 risks. Use at least 1 from the list in the app, at least 1 of your own, and at least 1 positive risk (an opportunity). Give each risk a range for how often it happens, a range for the loss, an owner and a goal.
> 3. Add at least 1 shared cause that links to 2 risks.
> 4. Set the loss you can take with 3 or more points.
> 5. Add at least 2 things you can do to reduce risk.
> 6. Find the best plan for the budget.
> 7. Print the decision record.

The user works with their own company, from memory. If the user does not want to show facts about their own company, give them this card.

> **Your company.** Logistics company in the Netherlands, 140 staff, turnover EUR 28 M. It runs a warehouse system and a customer portal. A managed service provider runs the servers. The IT budget for security next year is EUR 120 000.

The card gives no frequency and no loss for any risk. The user estimates these (hard rule 2, and SPEC.md assumption A1 tests if users can do it).

## 5. Rules for the moderator

1. Do not help in the first 3 minutes that the user is stuck. Then ask "What do you look for?" and wait 1 more minute.
2. After that, help with the smallest hint that lets the user continue. Write the hint and the minute on the note sheet. Each hint is a blocker (Sec. 6.2).
3. Do not explain a term. If the user asks what a word means, ask "What do you think it means?" and write the word down.
4. Do not touch the mouse or the keyboard.
5. Stop the task at 45 minutes. Write the step where the user stopped.

## 6. Note sheet

### 6.1 Each step

Write the minute when the user starts each step. Mark each "?" that the user opens. Write each quote that shows doubt.

| Step | Start (minute) | "?" opened | Doubt, error or hint | Quote |
|---|---|---|---|---|
| 1 Your company | | | | |
| 2 Your goals | | | | |
| 3 Loss you can take | | | | |
| 4 Your risks | | | | |
| 5 Size each risk | | | | |
| 6 Shared causes | | | | |
| 7 What you can do | | | | |
| 8 Budget and best plan | | | | |
| 9 Decision record | | | | |
| Full editor (if opened) | | | | |

| Measure | Value |
|---|---|
| Commit on the start screen | |
| Minute of the printed record | |
| Hints given | |
| Full editor opened (yes or no, and why) | |

### 6.2 Kinds of finding

| Kind | Rule | Action |
|---|---|---|
| Blocker | The user needs a hint, loses work, gets a wrong result, or cannot finish in 30 minutes because of one step. Each of these fails AT-5. | Fix before AT-5. Phase 6 is not done while one is open. |
| Major | The user finishes, but loses more than 3 minutes on one thing, or says that they do not trust a result. | Fix before AT-5 if the fix is small. Otherwise write an issue. |
| Minor | A word, a layout or a color that slows the user a little. | Write an issue. |

## 7. Consent form

> I agree to take part in a test of the PortaRegulus Risk app. The session takes about 60 minutes. PortaRegulus records my screen and my voice. PortaRegulus keeps the recording for 90 days and then deletes it. PortaRegulus uses the recording and the notes only to improve the app, and does not publish my name or my company. I can stop at any time with no reason.
>
> Name, date and signature.

## 8. Questions after the task

Ask these in this order. Write the answers.

1. What was the hardest part?
2. Which step did you not understand, if any?
3. Did the "?" explanations help? Give an example.
4. Do you trust the best plan that the app found? Why or why not?
5. Would you show the decision record to your management board as it is? What would you change?
6. Which words in the app were not clear?
7. Did you need the full editor? For what?

## 9. After the session

1. Put each finding in Sec. 6.2 kinds, and write it as an issue in porta-regulus/pr-risk with the label `pilot`.
2. Fix the blockers. Each fix has a test where a test is possible.
3. Write the result in docs/ux/redesign-plan.md Sec. 5.5. Give the date, the minute of the printed record, the number of hints and the open blockers. Do not write the name of the user.
4. Delete the recording 90 days after the session.
5. If a blocker needs a large change, run the pilot again with a new user.
