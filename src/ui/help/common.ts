import type { HelpTexts } from './types';

// Help texts of the editor frame, which each screen that edits a document shares.
export const COMMON_HELP = {
  'common.save-state': {
    what: 'The app saves each valid change in this browser a moment after you type. Each save makes a new version with a number. The app does not save a change with an error or an empty number field until you correct it.',
    why: 'Undo last change goes back one saved version. While a change is not saved, the same button says Discard unsaved changes and removes that change. Last export tells you when you last saved a copy to your downloads.',
    example: 'You type a wrong budget and the screen shows version 14. Click Undo last change, and version 13 is back.',
    source: 'NIST SP 800-221r1 App. D.',
  },
  'common.steps': {
    what: 'The steps that make a complete decision record, in the order to do them. The app ticks a step when the saved document shows it.',
    why: 'The steps follow the risk life cycle, from the context to the decision. A step that you skip leaves a gap in the decision record that the management body signs.',
    source: 'NIST SP 800-221r1 Sec. 2.2.',
  },
  'common.new-version': {
    what: 'Starts the new version of the app at once. The page loads again.',
    why: 'The app works offline, so a new version waits until you close all tabs of the app. This button makes it active now. Your documents do not change.',
  },
} as const satisfies HelpTexts;
