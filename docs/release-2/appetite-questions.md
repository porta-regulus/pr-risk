# Guided questions for capacity, appetite and tolerance

| Item | Value |
|---|---|
| Status | In release 1. On 2026-11-06 the product owner moved the questions from release 2 into release 1, as step 3 of the guided mode (`docs/ux/redesign-plan.md`). The file keeps its path, so the links to it stay valid. |
| Date | 2026-11-06 |
| Schema | 1.2.0 adds the optional object `appetite.elicitation` (Sec. 8) |
| Decided by | PortaRegulus (product owner) |
| ToC | `ictrm.3.2.1`, `ictrm.5.4.2` |
| Screen | Step 3 of the guided mode, and S2 Context and strategy |
| Replaces | The default tolerance points of SPEC.md Sec. 8.9 for documents that use the questions |

## 1. Problem

1. S2 gives a new document 4 default tolerance points (SPEC.md Sec. 8.9). Many users keep a default. The decision record then compares the LEC with the default of the app, not with the appetite of the management body.
2. The help text shows the templates of SP 800-221r1 Table 2 (SPEC.md Sec. 6.5 item 4). The templates give words. They give no tolerance points.
3. The IT lead prepares the decision record (ADR-0001). NIS2 Art. 20(1) makes the management body approve the risk-management measures and oversee them. Release 1 has no aid for the session in which the management body sets its appetite and tolerance.

## 2. Decision

Release 1 adds a guided question flow to S2 and to step 3 of the guided mode. The IT lead runs the flow with the management body in one session of about 30 minutes. The flow goes from wide to narrow in 5 stages. Almost every answer is one tap. The output is a draft. The draft becomes the appetite of the company only when the management body approves it in the existing "Approved by and on" fields.

Why release 1. The flow was first planned for release 2, because new UI changes the screens that AT-5 tests. Then the product owner decided to redesign the GUI before release 1, so AT-5 tests a new GUI anyway. Step 3 of the guided mode needs exactly this flow.

## 3. Stages

| Stage | Scope | Question | Answer format | Output |
|---|---|---|---|---|
| 1 Capacity | The whole company. Facts, not preferences. | "Which loss in one year forces you to cut staff, break a loan covenant or close?" The help text tells the user to ask finance and to add cash, unused credit and insurance cover. | A slider on a log scale in 1-2-5 steps from 10 000 to 10 000 000 in the document currency, a number field, and "Do not know yet" | `appetite.capacity` with its rationale |
| 2 Criteria | Each objective | One event for each objective, written from the objectives on S2 with Table 2 as the template. Example. "Your main customer system is down for 3 days." | 4 buttons. Acceptable, Painful, Not acceptable, Do not know. | A draft entry in `appetite.statements[]` for each "Not acceptable" answer. The user completes its `breachWhen` trigger. |
| 3 Tolerance points | Annual loss in the document currency | "Do you accept a 1 in N chance this year that losses from ICT risks reach X or more?" N is 100, then 20, then 5, then 2. | 3 buttons. Accept, Not accept, Do not know. 3 questions for each point. | `appetite.toleranceCurve` points |
| 4 Cross-check | One point, asked in a different frame | "How much per year would you pay to remove a 1 in N chance of losing X or more?" The app uses the 1 in 20 point, or the first point that is set. | 4 buttons with amounts from that point. E is X divided by N. Less than E/2, E/2 to 2E, More than 2E, Do not know. | A flag on the point when the answer is "More than 2E" |
| 5 Result | The draft | No question | No answer | The curve, the number of points set, the flags and the label "Draft" |

Stage 1 is a slider because it is one amount and only its order of size matters. Stages 2 to 4 use buttons for the reasons in Sec. 5.

## 4. Rules

1. Each question names a loss, a chance and a year. No question asks for a word such as "low" or "high". Every board says "low" for cyber risk, and the word gives no number.
2. Chances are natural frequencies ("1 in 20"), not percentages (Gigerenzer and Hoffrage 1995).
3. All amounts come from the capacity of stage 1. The app never proposes an amount of its own. This follows the intent of hard rule 2.
4. The search for a point. Each point has an upper limit. The upper limit is the last point that is set. If no point is set yet, the upper limit is 2 times capacity. The search starts with the range from 1/30 of the upper limit to the upper limit. For the first point (1 in 100) that is capacity / 15 to 2 times capacity. Each answer halves the range on a log scale. After 3 answers, the point is the geometric mean of the last range. Two possible results next to each other are then about 1.5 times apart. The app rounds each amount to 2 significant digits, so the board reads a plain number such as 120 000. The rounded amount is the limit of the next range.
5. The order is 1 in 100, 1 in 20, 1 in 5, 1 in 2. Each new point is below the last point that is set. So the points that are set meet V-12 (loss ascending, probability strictly descending) by construction, and the app never asks a question again.
6. Every question has "Do not know". The app leaves that point empty and never fills it. The search continues with the next point. Its upper limit comes from rule 4, so an empty point is never used as a value. The answers to the other points stay valid. With fewer than 3 points the curve is not complete, because the step "Draw your tolerance curve" needs 3 points. The app then moves to the curve editor with the points that are set and no default points. With 1 point the app writes no curve, because the schema needs 2 points. The result shows that point, so the user can type it in the editor.
7. A first number anchors the answer. The search starts in the middle of a wide range, not at a typical value, so the first amount on the screen does not suggest an answer.
8. Accessibility. All answers except capacity are native buttons. The capacity slider moves with the arrow keys, shows its value as text (`aria-valuetext`), and has a number field next to it. This meets WCAG 2.2 criteria 2.1.1 and 2.5.7.
9. The flow records the date of the session and a free-text note of who took part. The app has no accounts (ADR-0004), so the note is text only. The result stays "Draft" until the "Approved by and on" fields are filled.
10. After the flow, the curve editor of S2 lets the user change a point to fine-tune it. That is an edit of the result, not an answer. A change after approval goes into `appetite.history` as in SPEC.md Sec. 6.17 item 2.
11. Stages 3 and 4 need the capacity (rule 3). After "Do not know yet" in stage 1, the app skips them and says why. Stage 2 still runs.
12. Each answer is saved at once, so a closed tab loses nothing. A new capacity in stage 1 clears the stage 3 and 4 answers, because their amounts come from the old capacity.
13. The flow changes the tolerance curve and the statements only when the user clicks "Use these answers" in stage 5. That step needs the note of who took part (rule 9). An existing curve goes into `appetite.history` with the date of the session, the note of who took part as "changed by", and the reason "Guided questions". The new curve has no approval. A "Not acceptable" answer makes one draft statement only once, also when the user clicks the button again.

## 5. Why buttons and not sliders

1. Sliders gave more missing data and longer answer times than buttons, with no gain in quality (Couper, Tourangeau, Conrad and Singer 2006).
2. Sliders gave more break-offs and longer answer times, most of all for respondents with less formal education (Funke, Reips and Thomas 2011).
3. The start position of a slider is an anchor. Buttons with a halving search have no start position.
4. WCAG 2.2 criterion 2.5.7 needs a way to answer without dragging. Buttons meet it with no extra work.

The ranges of answer options can signal what is "normal" (Schwarz, Hippler, Deutsch and Strack 1985). Stage 4 takes its options from the user's own point, so this effect is small there. The stage 1 range is wide for the same reason.

## 6. Out of scope of this feature

1. Revealed appetite from past decisions of the management body. See decision O5.
2. Tolerance curves for gains (SPEC.md Sec. 3.2).
3. Weights between criteria. Criteria that the user cannot put in money stay appetite statements with triggers. They do not enter the tolerance curve.

## 7. Decisions on the open questions

The product owner decided O1 to O5 on 2026-11-06. Each decision is the default that this document proposed.

| # | Question | Decision |
|---|---|---|
| O1 | The search range (1/30 of the upper limit to the upper limit, and 2 times capacity when no point is set) and 3 questions for each point are choices of the first mockup. They come from no source. | Keep 3 questions for each point and the range of rule 4. Test them in the pilot (`docs/pilot/`) with 3 or more management bodies. Keep them if the boards accept the points they get. |
| O2 | The stage 4 flag at "More than 2E" comes from no source. | Flag at "More than 2E". The flag is a question to the board, never an error. Test it in the pilot. |
| O3 | Where do the stage 2 answers, the stage 4 flags and the session note go in the document? | A new optional object `appetite.elicitation` in schema 1.2.0 (Sec. 8). |
| O4 | Stage 2 can say that an event is "Not acceptable" while the curve accepts the loss of that event. The conflict is only visible after S3 has estimates and S4 has a run. How does the app show it? | Help text on S4 that lists the "Not acceptable" events and points to the tolerance what-if of S6 (SPEC.md Sec. 6.17 item 2). The app makes no automatic check, because an event has no link to a risk. |
| O5 | Use the past decisions of the management body (accept, treat, fund) as a second cross-check? | No. Many companies with 50 to 249 staff have no record of such decisions. |

## 8. Record in the document

Schema 1.2.0 adds the optional object `appetite.elicitation`. It is a new optional field, so it is a minor version (SPEC.md Sec. 7.7 item 2). A 1.0.0 or 1.1.0 document is also a valid 1.2.0 document. The app writes 1.2.0. Release 1 refuses a 1.2.0 document with "Use a newer version of the app".

| Field | Content |
|---|---|
| `heldOn` | The date of the session. Required. |
| `participants` | Free text. Who took part (rule 9). |
| `capacity` | The capacity that stage 3 and 4 used. The amounts of the questions come from it, so the record shows the same questions also after a later change of `appetite.capacity`. |
| `criteria[]` | Stage 2. `objectiveId`, the `event` text, the `answer` (`acceptable`, `painful`, `not-acceptable` or `unknown`) and the `statementId` of the draft statement that stage 5 made. |
| `points[]` | Stage 3. `oneIn` (100, 20, 5 or 2) and the `answers` in order (`accept`, `not-accept` or `unknown`), at most 3. The app computes each amount again from `capacity` and the answers, so the record has no amount that can disagree with the answers. |
| `crossCheck` | Stage 4. `oneIn` of the point and the `answer` (`below-half`, `half-to-double`, `above-double` or `unknown`). `above-double` is the flag. |

The result of the flow is in the existing fields `appetite.capacity`, `appetite.toleranceCurve` and `appetite.statements`. The record holds only the answers.

## 9. Sources

1. Couper, M. P., Tourangeau, R., Conrad, F. G. and Singer, E. (2006). Evaluating the effectiveness of visual analog scales. A web experiment. Social Science Computer Review 24(2), 227 to 245.
2. Funke, F., Reips, U.-D. and Thomas, R. K. (2011). Sliders for the smart. Type of rating scale on the web interacts with educational level. Social Science Computer Review 29(2), 221 to 231.
3. Gigerenzer, G. and Hoffrage, U. (1995). How to improve Bayesian reasoning without instruction. Frequency formats. Psychological Review 102(4), 684 to 704.
4. Kahneman, D. and Tversky, A. (1979). Prospect theory. An analysis of decision under risk. Econometrica 47(2), 263 to 291.
5. Schwarz, N., Hippler, H.-J., Deutsch, B. and Strack, F. (1985). Response scales. Effects of category range on reported behavior and comparative judgments. Public Opinion Quarterly 49(3), 388 to 395.
6. Hubbard, D. W. and Seiersen, R. (2023). How to Measure Anything in Cybersecurity Risk, 2nd ed. Wiley. Risk tolerance curves.
7. W3C (2023). Web Content Accessibility Guidelines (WCAG) 2.2. Criteria 2.1.1 Keyboard and 2.5.7 Dragging Movements.
