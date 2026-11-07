// One explanation that opens on click (docs/ux/redesign-plan.md phase 5). Plain words first,
// then the source. Titles and labels stay plain, and the references live here.
export interface HelpText {
  // What the item is, in one or two short sentences.
  readonly what: string;
  // Why the app asks for it, or what it changes in the result.
  readonly why?: string;
  // A short example with numbers or words a small company would use. Never a default value
  // for a risk (hard rule 2).
  readonly example?: string;
  // The reference, for example "NIST SP 800-221r1 Sec. 3.5 and Fig. 8".
  readonly source?: string;
}

export type HelpTexts = Readonly<Record<string, HelpText>>;
