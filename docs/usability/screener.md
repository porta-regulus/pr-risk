# AT-5 recruitment screener

Use this screener to select the 5 AT-5 users, and a new user for each failed session. The rules come from SPEC.md Sec. 12.5 and ADR-0001.

## 1. Invitation text

Send this text, or say it.

"PortaRegulus tests a free app for the NIS2 risk analysis. We look for people who prepare the NIS2 risk analysis in an EU company with 50 to 249 staff. You do one task with a fictitious company while you say aloud what you think. The session takes about 75 minutes, at [place]. We record the screen and your voice, not your face. [Thank-you payment, or none.] Please answer a few short questions first."

## 2. Questions

Ask all questions. A candidate who gives an answer in the column "Screen out" does not take part.

| No. | Question | Accept | Screen out |
|---|---|---|---|
| S1 | In which country does your company have its main establishment? | An EU Member State | Other |
| S2 | How many persons does your company employ? | 50 to 249 | Fewer than 50, or 250 or more |
| S3 | Which sentence is true for your company? (a) It is an essential or important entity under NIS2. (b) It supplies such an entity and must show NIS2-grade risk management to it. (c) Neither. (d) I do not know. | (a) or (b) | (c) or (d) |
| S4 | What is your role? | Any role. Write the title. ADR-0001 expects an IT lead or a part-time CISO, and the titles check this (assumption 1). | No screen out. S5 decides. |
| S5 | Who prepares the NIS2 risk analysis and enters the estimates? | I do, alone or with others. | Another person only |
| S6 | Who approves the risk responses and their budget? | Write the answer. | No screen out |
| S7 | Do you work for PortaRegulus now, or did you work for it in the last 12 months? This includes work as a contractor. | No | Yes |
| S8 | Are you or your company a customer, a trial user or a partner of a paid PortaRegulus product, for example CVD Portal? | No | Yes |
| S9 | Is a member of your family or a close friend PortaRegulus staff? | No | Yes |
| S10 | Did you see or use PortaRegulus Risk before, for example in a pilot, a demo or a review? | No | Yes |
| S11 | Did you take part in an earlier session of this test? | No | Yes |
| S12 | Can you read and write work English? Release 1 of the app is in English only (SPEC.md Sec. 3.2 item 12). | Yes | No |
| S13 | Do you need an adjustment for the session, for example a larger screen or a screen reader? | Write the answer, and prepare the adjustment before the session. | No screen out |

The product owner keeps the list of paid PortaRegulus products for question S8 current. Check it before each recruitment round.

Do not ask how the company sets the budget for risk responses. The session asks it after the task (session-log.md Sec. 6, question 1). A question before the task can change how the user does the task.

## 3. Mix of users

The pass does not need a mix, but a mix finds more problems. Aim for these points.

1. At least 1 user from a supplier, answer (b) of S3.
2. Not more than 2 users from one sector.
3. Users from at least 2 Member States.

## 4. Selection record

Write one row for each selected user. Do not write names here. Keep the answers of candidates who do not take part only until the selection ends, then delete them.

| User code | S1 country | S2 staff band | S3 answer | S4 role | S5 answer | S6 answer | S7 to S12 all accepted | S13 adjustment | Sector |
|---|---|---|---|---|---|---|---|---|---|
| U1 | | | | | | | | | |
| U2 | | | | | | | | | |
| U3 | | | | | | | | | |
| U4 | | | | | | | | | |
| U5 | | | | | | | | | |
| U6 | | | | | | | | | |
| U7 | | | | | | | | | |
