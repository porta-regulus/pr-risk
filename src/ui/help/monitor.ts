import type { HelpTexts } from './types';

export const MONITOR_HELP = {
  'monitor.indicators': {
    what: 'The measured values of your KPIs, KRIs and tolerances. A KPI shows how well you perform. A KRI warns that a risk grows. A tolerance is a limit that you must not pass.',
    why: 'The app checks each trigger on the latest value. When a KRI fires or a tolerance breaks, the app starts a review. The review covers the risks in the categories of the appetite statement.',
    source: 'NIST SP 800-221r1 Sec. 3.7 and 5.1.2.',
  },
  'monitor.indicator-table': {
    what: 'One row for each tolerance and indicator of the statement. Trigger is the rule that the app checks. Latest observation is the last value that you recorded. State is the result of the check on that value.',
    why: 'No data means that the latest observation does not give every value that the trigger needs. Record those values to get a result.',
    source: 'NIST SP 800-221r1 Sec. 3.7.',
  },
  'monitor.observed-on': {
    what: 'The date on which you measured the values.',
    why: 'The app checks the triggers on the observation with the latest date.',
  },
  'monitor.observation-value': {
    what: 'The value of this measure on the date of the observation, in the unit shown.',
    why: 'The app compares the value with the thresholds of the triggers that use this measure.',
    example: 'If 3 of 120 laptops had no current patches on the date, and the measure is a count, type 3.',
  },
  'monitor.observation-note': {
    what: 'A short note on the observation, for example where the value comes from.',
    example: 'Taken from the patch report of the device management tool.',
  },
  'monitor.record-observation': {
    what: 'Adds the date and the values to the statement and checks the triggers again.',
    why: 'An observation is kept in the document. A trigger that fires can set risks to Review needed.',
    source: 'NIST SP 800-221r1 Sec. 3.7 and 5.1.2.',
  },
  'monitor.review': {
    what: 'The risks that need a review today, with the reasons. A reason can be a breached tolerance, a KRI that fires, a review date that has passed or an acceptance that has expired. A new emerging or horizon risk in the same category is also a reason.',
    why: 'The app sets such a risk to Review needed itself, and writes the reasons in the change log. A person ends the review with another status.',
    source: 'NIST SP 800-221r1 Sec. 3.7.1 and 5.1.2.',
  },
  'monitor.acceptance': {
    what: 'The records of the risks that the company accepts. Each record says who accepted the risk or the exception to a tolerance, when, until when and why.',
    why: 'An accepted risk without an acceptance record has no owner of the decision. An acceptance past its end date sets the risk to Review needed.',
    source: 'NIST SP 800-221r1 Sec. 5.1.2.',
  },
  'monitor.acceptance-kind': {
    what: 'Acceptance of the risk means the company keeps the risk as it is. Exception to a tolerance means the company allows a risk above a tolerance for a time.',
    why: 'An exception is a stronger decision. The decision record names it Tolerance exception, so the management body sees it.',
    source: 'NIST SP 800-221r1 Sec. 5.1.2.',
  },
  'monitor.acceptance-by': {
    what: 'The person or the body with the authority to accept the risk.',
    why: 'The decision record must show who owns the decision.',
    example: 'Managing director.',
    source: 'NIST SP 800-221r1 Sec. 5.1.2.',
  },
  'monitor.acceptance-on': {
    what: 'The date of the acceptance decision.',
    why: 'The decision record shows the date next to the name of the person who accepted the risk.',
  },
  'monitor.acceptance-until': {
    what: 'The last date on which the acceptance is valid. Leave it empty for no end date.',
    why: 'After this date the app sets the risk to Review needed, so the decision is made again.',
    example: 'One year after the decision.',
  },
  'monitor.acceptance-rationale': {
    what: 'Why the company accepts the risk.',
    why: 'A later reader must see the reason, for example that no response was affordable.',
    example: 'The best response option costs more than the expected annual loss that it removes.',
    source: 'NIST SP 800-221r1 Sec. 5.1.2.',
  },
  'monitor.whatif': {
    what: 'A test of another tolerance curve on the results of the last simulation.',
    why: 'You see at once if the roll-up of all registers stays under the new curve. No new simulation is necessary, because the app keeps the annual losses of the last run.',
    source: 'NIST SP 800-221r1 Sec. 5.4.2.',
  },
  'monitor.whatif-points': {
    what: 'The points of the what-if curve. Each point is a loss and the highest probability per year that you accept for a loss above it.',
    why: 'The points must go up in loss and down in probability. A point with a lower probability is a stricter limit.',
    example: 'Loss 250000 and probability 0.1 means this. You accept a loss above 250000 in at most 1 year of 10.',
    source: 'NIST SP 800-221r1 Sec. 5.4.2.',
  },
  'monitor.whatif-result': {
    what: 'The roll-up against the saved curve and against the what-if curve. Tolerance gap is the largest amount by which the probability on the loss curve is above the tolerance curve. A gap above 0 is a breach. Excess area is the total size of the parts of the loss curve above the tolerance curve.',
    why: 'Compare the two columns to see what the change of tolerance does to the status.',
    source: 'NIST SP 800-221r1 Sec. 3.7 and 5.4.2.',
  },
  'monitor.whatif-by': {
    what: 'The name of the person who changes the tolerance curve.',
    why: 'The history of the curve shows who made each change.',
  },
  'monitor.whatif-reason': {
    what: 'Why the tolerance curve changes.',
    why: 'The history keeps the reason with the old curve, so an auditor can follow each change.',
    example: 'The board approved a higher limit after the new insurance contract.',
  },
  'monitor.whatif-save': {
    what: 'Makes the what-if curve the tolerance curve of the document. The old curve goes into the history with the date, the person and the reason.',
    why: 'The new curve needs approval. Set the approval on the screen Context and strategy after you save.',
    source: 'NIST SP 800-221r1 Sec. 5.4.2.',
  },
  'monitor.forecasts': {
    what: 'Forecasts that the app freezes from the simulation, and their outcomes when the time window ends.',
    why: 'The score shows if your estimates were right. This is the only test of the analysis against what really happened.',
    source: 'Brier, Monthly Weather Review 78(1), 1950. Murphy, Journal of Applied Meteorology 12(4), 1973.',
  },
  'monitor.freeze-forecasts': {
    what: 'Stores one forecast for each simulated risk. The forecast gives the probability of at least one event at or above the reportable threshold. The window starts on the as-of date of the register and lasts its timeframe.',
    why: 'A frozen forecast is never changed. So the score later tests the estimate you had on this day, not one you changed after the event.',
  },
  'monitor.forecast-log': {
    what: 'All frozen forecasts. Window is the time that the forecast covers. f is the probability of at least one event in the window. The interval is the range of the annual impact that the simulation gives with 90% certainty.',
    why: 'When a window ends, the row shows Due. Record the outcome to include the forecast in the score.',
  },
  'monitor.outcome-occurred': {
    what: 'Yes if at least one event at or above the reportable threshold happened in the window. No if none happened.',
    why: 'The Brier score compares this answer with the probability of the forecast.',
  },
  'monitor.outcome-on': {
    what: 'The date on which you record the outcome. It must be on or after the end of the window.',
  },
  'monitor.outcome-impact': {
    what: 'The total impact of the events of the risk in the window, if you know it.',
    why: 'The app checks if the value is inside the 90% interval of the forecast. Over many forecasts, about 9 in 10 values must be inside.',
    source: 'Hubbard and Seiersen, How to Measure Anything in Cybersecurity Risk, 2nd ed., 2023.',
  },
  'monitor.outcome-evidence': {
    what: 'Where the outcome comes from.',
    example: 'Incident ticket 2027-014 and the insurance claim.',
  },
  'monitor.record-outcome': {
    what: 'Stores the outcome with the forecast. The forecast itself does not change.',
    why: 'Only forecasts with an outcome count in the Brier score.',
  },
  'monitor.brier': {
    what: 'The Brier score is the mean of the squared difference between each forecast probability and its outcome, 1 or 0. A lower score is better. The skill score compares it with a forecast that always gives the base rate.',
    why: 'Reliability shows if your probabilities match how often events happen. Resolution shows if your forecasts tell risks apart. With few forecasts the score has a wide interval, so read it with care.',
    source: 'Brier, Monthly Weather Review 78(1), 1950. Murphy, Journal of Applied Meteorology 12(4), 1973.',
  },
} as const satisfies HelpTexts;
