// All help texts of the app, one file for each area, so each area can be reviewed alone.
// test/ui-help.test.ts checks that each field and section has one and that each text is used.
import { COMMON_HELP } from './common';
import { CONTEXT_HELP } from './context';
import { ENTERPRISE_HELP } from './enterprise';
import { GUIDED_HELP } from './guided';
import { IDENTIFY_HELP } from './identify';
import { MONITOR_HELP } from './monitor';
import { PRIORITIZE_HELP } from './prioritize';
import { RESPOND_HELP } from './respond';
import { START_HELP } from './start';
import type { HelpText } from './types';

export const HELP = {
  ...COMMON_HELP,
  ...START_HELP,
  ...CONTEXT_HELP,
  ...IDENTIFY_HELP,
  ...PRIORITIZE_HELP,
  ...RESPOND_HELP,
  ...MONITOR_HELP,
  ...ENTERPRISE_HELP,
  ...GUIDED_HELP,
};

export type HelpKey = keyof typeof HELP;

export const helpText = (key: HelpKey): HelpText => HELP[key];
