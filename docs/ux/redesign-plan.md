# GUI and UX redesign before release 1

| Item | Value |
|---|---|
| Status | Phase 0 is done (pull request 52). Phase 1 is done. The product owner picked direction B with a sans font on 2026-11-06 (Sec. 4.1). The product owner passed the phase 2 prototype on 2026-11-06. Phase 3 is merged (pull request 55). Phase 4 is merged (pull request 56). Phase 5 is built (Sec. 5.4) and waits for review. |
| Date | 2026-11-06 |
| Decided by the product owner | Guided mode plus the full editor. The redesign ships before release 1, so release 1 and AT-5 wait. Claude proposes 2 or 3 visual directions as mockups first. |
| Changes | HANDOFF task 12 (the order before the tag), SPEC.md Sec. 5 (screens), Sec. 10 (UI) and Sec. 12.5 (AT-5 uses the new GUI) |

## 1. Problem

The product owner tested the app and found it hard to use. A target user will find it harder. The measurements below come from rc.3 on https://risk.portaregulus.com with example 1.

| Screen | Page height | Fields | Buttons |
|---|---|---|---|
| S2 Context and strategy | 6 700 px | 106 | 55 |
| S3 Identify and analyze | 6 000 px | 109 | 34 |
| S4 Prioritize | 7 400 px | 1 | 17 |
| S5 Respond and optimize | 2 200 px, 15 folded parts | 260 | 25 |
| S6 Monitor and adjust | 7 500 px | 22 | 24 |
| S7 Enterprise view | 8 100 px | 14 | 12 |

The product owner named 4 problems. All 4 are confirmed.
1. Too much on each page. Each screen shows every field of the document for that part of the life cycle at once.
2. Colors and style. The cream and tangerine theme does not fit a risk tool.
3. Unclear next action. 7 screen buttons have the same weight. The steps panel sits below the buttons, a banner and the save bar.
4. Expert language. The main text uses NIST section numbers, "LEC", "Fig. 10" and "life cycle step 2 and 3".

A fifth problem is a defect. A browser that opened rc.1 still runs rc.1. The new version waits and does not take over, and rc.1 has no notice of a new version. The product owner saw rc.1, not rc.3.

## 2. Principles

1. One task on each page. A page in the guided mode asks for one thing and has one main button.
2. The next step is always visible. A fixed step bar at the top shows where the user is, what is done and what comes next.
3. Plain words first. NIST and CRA references go into a "Why" help text under each step, not into titles.
4. Expert fields stay, but folded. Each step shows what the AT-5 task needs. "More fields" opens the rest.
5. No feature is lost. The full editor keeps every field of today.
6. The hard rules stay. No network request, no invented defaults, matrices are display only, WCAG 2.2 AA, 375 px, and the production CSP.

## 3. Structure

### 3.1 Two modes

| Mode | For | Shape |
|---|---|---|
| Guided | A first run, and the AT-5 task | One step for each page, with Back and Next. It ends at the printed decision record. |
| Full editor | Later edits, experts, more registers | The 6 screens of today, cleaned up. Each section can fold. A side menu replaces the 7 equal buttons. |

The start screen asks one question. "Start a new risk register" opens the guided mode. "Open" opens a document in the mode it was last used in. A document can switch modes at any time, because both edit the same document.

### 3.2 The guided steps

The steps follow the AT-5 task (SPEC.md Sec. 12.5) and `src/ui/steps.ts`.

| # | Step | What the page asks | Done when |
|---|---|---|---|
| 1 | Your company | Name, currency, size, one sentence on what the company does | A title and a currency |
| 2 | Your goals | 2 objectives, with examples to pick from | 2 objectives with a statement |
| 3 | How much loss you can take | Capacity, then the tolerance curve | A curve with 3 points or more |
| 4 | Your risks | Pick from the catalogue, add your own, add 1 opportunity | 5 risks, with 1 from the catalogue, 1 own and 1 positive |
| 5 | Size each risk | One risk at a time. Owner, objective, how often, how much, as ranges, with a short calibration help (SPEC assumption A1) | Each risk has an owner, an objective and both ranges |
| 6 | Shared causes | Drivers, for example one supplier behind several risks | 1 driver with 2 links |
| 7 | What you can do | Response options with cost and effect | 2 options |
| 8 | Budget and best plan | Budget, then run the optimization | A run result |
| 9 | Decision record | Preview, print, export a copy | The record printed or saved as PDF |

### 3.3 The full editor

1. A side menu with the 6 screens. On a narrow screen it becomes a menu button.
2. Each screen starts with a short summary of its state, for example "9 risks, 2 need an estimate". The fields come below it, folded by section.
3. S5 shows one response option at a time, not 15 folded parts on one page.
4. S4, S6 and S7 show a summary at the top and the large tables folded.

## 4. Visual direction

Claude makes 3 clickable mockups of guided steps 1 to 3 and of one full editor screen, each in a different style. The product owner picks one before any code changes. Each direction must pass WCAG 2.2 AA contrast in light and dark mode.

| Direction | Character |
|---|---|
| A. Calm professional | White and cool grey, one deep blue for actions, clear cards. It is close to accounting and audit tools. |
| B. Quiet editorial | Large type, much white space, black and one signal color. It reads like a report. |
| C. Friendly guided | Soft colors, large step numbers, illustrations of each step. It fits a first-time user. |

The look must not copy CVD Portal (ADR-0003 C5 and C7).

### 4.1 Decision. Direction B with a sans font

On 2026-11-06 the product owner looked at the 3 mockups and picked direction B, with a sans font in place of the serif. The mockups are on a private claude.ai canvas of the product owner. The rules below are the reference for phases 2 to 5.

| Item | Rule |
|---|---|
| Font | IBM Plex Sans (SIL Open Font License 1.1) for all text. No serif and no monospace face. Phase 3 puts the WOFF2 files in the app, because the app makes no network request (ADR-0004). |
| Titles | 52 px, weight 300, letter spacing -0.03em. The step label above the title uses the signal color. |
| Colors, light | Ground and paper #FFFFFF, text and ink #111111, muted text #595959, hairline rule #E3E3E3, signal #B93C0A |
| Colors, dark | Ground #131313, text and ink #F1F1EF, muted text #ADADAD, hairline rule #343434, signal #FF8A4C |
| Signal color | Only for the current step, an item that needs action (for example "Missing") and the focus ring. Never for decoration. |
| Structure | Rules, not boxes. A 2 px ink rule opens a table or closes a page. Hairlines divide rows. No cards, no shadows, no gradients. |
| Fields | A text field has a 2 px ink line below it and a visible label above it. Phase 6 checks with the pilot user that the fields are easy to see. |
| Buttons | The main action is a solid ink block with 2 px corners. A second action is an ink outline. A third action is underlined text. |
| Steps | A numbered list of the 9 steps on the left (01 to 09), the current step in the signal color, done steps marked "Done". On a narrow screen the list becomes a menu button. |
| Touch and focus | Each control is at least 44 by 44 px. Focus is a 2 px ring in the signal color with a 3 px gap. |

## 5. Phases

| Phase | Work | Done when |
|---|---|---|
| 0 | Fix the stuck update (Sec. 6 decision 1) | A browser on an old version shows the new version after one restart of the app, with a test that proves it |
| 1 | 3 visual mockups (Sec. 4) | The product owner picks one. Done 2026-11-06, direction B with a sans font (Sec. 4.1) |
| 2 | Clickable prototype of the guided mode, steps 1 to 9, with the chosen style, on example data | The product owner can go from step 1 to the record without help. Passed 2026-11-06 (Sec. 5.1) |
| 3 | Merge `ed/appetite-questions-r2` (Sec. 6 decision 2). Build the guided mode in the app, with the guided questions as step 3 | All 9 steps work on real documents. The e2e tests, axe-core and 375 px pass. The AT-5 script runs through the guided mode. Built 2026-11-06 (Sec. 5.2) |
| 4 | Clean up the full editor (Sec. 3.3) with the new style | Every field of today is still reachable. All tests pass. Built 2026-11-07 (Sec. 5.3) |
| 5 | Plain words (Sec. 2 item 3) on all screens, and an explanation on click for each field, section and key button (Sec. 5.4) | No NIST section number in a title, lead, label or legend. Each field, section and key button has an explanation that gives plain words and the reference. `test/ui-help.test.ts` passes. Built 2026-11-07 with about 300 texts (Sec. 5.4) |
| 6 | Pilot with 1 target user, fix the blockers | No open blocker |
| 7 | AT-5 with 5 users, then AT-6, then the tag | HANDOFF task 12 |

### 5.1 Phase 2 prototype

The prototype is the board "Phase 2. Guided mode prototype" on the private mockup canvas of the product owner. It has all 9 steps in the style of Sec. 4.1, a phone layout below 760 px and a dark mode. It saves nothing.

1. Each step has "Fill with example answers". The answers come from `docs/schema/examples/example-2-sme-quantitative.json`. The catalogue gives names only, never numbers (hard rule 2).
2. Step 3 uses the tolerance search of `ed/appetite-questions-r2`.
3. Step 5 has the calibration help of SPEC.md assumption A1, with one worked example.
4. Step 8 runs a simplified Monte Carlo in the browser. It uses 10 000 years for each mix of options in the budget, lognormal 90% ranges, Poisson counts, and shared causes with a trigger chance. It picks the mix that keeps the most tolerance points, then the lowest expected loss plus annual cost. Phase 3 uses the real engine of SPEC.md Sec. 6 instead.
5. Step 9 shows the decision record and prints it.

Known limits. A gain counts as a negative loss, so the expected loss can be below zero. One-off costs of a new option are spread over 3 years. These are prototype rules, not app rules.

### 5.2 Phase 3 build

1. The branch `ed/appetite-questions-r2` is merged. Its docs now say release 1 (decision 2 of Sec. 6).
2. `src/ui/guided-mode.tsx` is the guided mode, with the 9 steps of Sec. 3.2. `src/ui/guided-steps.ts` holds the titles and the done rules. The steps call the same edit functions as the full editor. S5 gave its run, its ranked table and its residual risks to `respond.tsx` exports, so that step 8 and S5 share them.
3. S1 has "Guided mode" as the main button of a selected document. The full editor has "Guided mode" in its row of screens.
4. The whole app has the colors and the font of Sec. 4.1. Phase 4 cleans up the layout of the full editor.
5. Tests. `e2e/guided-mode.spec.ts` runs the AT-5 task through the guided mode, with axe-core and 375 px on the steps, the print of the record on 2 pages or fewer, and the step menu at 375 px. `test/ui-guided-steps.test.ts` tests the done rules. All earlier e2e tests pass with the new style.

### 5.3 Phase 4 build

1. `DocumentScreen` in `src/ui/editor.tsx` has a top bar with "Back to start" and "Guided mode", and the side menu `ScreenMenu`. The menu reuses the step list of the guided mode.
2. `src/ui/screen-summary.ts` writes the state line of each screen. `test/ui-screen-summary.test.ts` tests it.
3. `src/ui/section.tsx` is the section that folds. The heading stays a level 2 heading in the summary, with the same id, so the steps panel and the e2e tests still find it. `unfold` opens a folded section before the steps panel moves the focus into it. Sections are rules, not boxes (Sec. 4.1).
4. S5 shows one response option at a time (`OptionEditor` with `alone`). The guided mode keeps its folded options, because the product owner passed it in phase 2.
5. No field is removed. A folded field is one click away.
6. Tests. `e2e/editor.spec.ts` tests the menu, the state line, a fold, one option at a time, 375 px and axe-core. `e2e/fold.ts` opens a folded section for the earlier e2e tests.
7. Not in phase 4. The NIST numbers in titles and leads stay until phase 5 (plain words).

### 5.4 Phase 5 scope

Decided by the product owner on 2026-11-07.
1. Plain words and references both stay. Titles, leads, labels and legends use plain words. The NIST references move into the explanations, so the app still names its sources.
2. Each field with a visible label, each section and each button with a result that is not obvious has an explanation that opens on click. A plain button such as Back, Delete or Undo has none, because the text would only add noise.
3. Each explanation says what the item is, why it matters, an example where one helps, and the source. The texts are in `src/ui/help/`, one file for each area. `src/ui/explain.tsx` shows them.
4. `test/ui-help.test.ts` fails when a field or section has no explanation, when a text is not used, when a text has an em dash, a semicolon or a colon, and when a title, lead, label or legend has a NIST section, figure or table number.

Phases 2 and 3 are the largest part. The product owner sees a working result at the end of each phase.

## 6. Decisions for the product owner

1. The stuck update. ADR-0004 T3 says "no skipWaiting", so a new version activates only after every tab closes. In practice it did not activate even then in one browser. Options. (a) Find and fix why the waiting version does not take over, and keep T3. (b) Change T3 so that the new version takes over at the next start of the app. This reopens ADR-0004, so it needs your decision. Claude recommends (a) first, then (b) if (a) is not enough.
2. Decided 2026-11-06. The guided questions (`docs/release-2/appetite-questions.md`) move into release 1 as guided step 3. Release 1 waits for the redesign anyway, and the questions are built and tested on branch `ed/appetite-questions-r2`. That branch now merges before release 1, as part of phase 3. In the same pull request, its docs change from "release 2" to "release 1". These are the status in `docs/release-2/appetite-questions.md`, SPEC.md Sec. 3.2 item 8 (no longer out of scope), Sec. 6.5 item 6 and Sec. 7.7 item 1, and the HANDOFF section. Release 1 then writes schema 1.2.0.
3. The Annex I self-check names a checked version. After the redesign, the checks run again on the new tag.

## 7. Risks

1. Scope. A redesign of 6 screens can grow. Phase 2 is a prototype on purpose, so the product owner can stop or change course before the large build.
2. Tests. Many e2e tests find fields by label. New labels need test changes in the same pull request.
3. Two modes can drift apart. Both modes use the same edit functions (`src/ui/edit.ts` and the section modules), not copies.
