// The five example pairs of SP 800-221r1 ipd Table 2 "Examples of risk appetite and risk
// tolerance" (p. 17, line 654), quoted exactly. S2 shows them as templates (SPEC.md Sec. 6.5
// item 4). The user adapts the words and adds the measures.
import type { RiskDocument } from '../schema/types';
import { nextId } from './edit';

type Statement = NonNullable<NonNullable<RiskDocument['appetite']>['statements']>[number];

export interface AppetiteTemplate {
  readonly enterprise: string;
  readonly appetite: string;
  readonly tolerance: string;
}

export const TABLE_2: readonly AppetiteTemplate[] = [
  {
    enterprise: 'Global Retail Firm',
    appetite: 'Our customers associate reliability with our company’s performance, so service disruptions must be minimized for any customer-facing websites.',
    tolerance: 'Regional managers may permit website outages lasting up to four hours for no more than 5 % of their customers.',
  },
  {
    enterprise: 'Government Agency',
    appetite: 'Mission-critical systems must be protected from known ICT vulnerabilities.',
    tolerance: 'Critical software vulnerabilities (severity score of 10) must be patched on systems designated as mission-critical within 14 days of discovery.',
  },
  {
    enterprise: 'Internet Service Provider',
    appetite: 'The company has a low-risk appetite regarding the failure to meet customer service-level agreements, including network availability and communication speeds.',
    tolerance:
      'Patches must be applied to avoid attack-related outages but must also be well-tested and deployed in a manner that does not reduce availability below agreed-upon service levels.',
  },
  {
    enterprise: 'Academic Institution',
    appetite:
      'The institution understands that mobile computers are a necessary part of the daily life of students, and some loss is expected. The leadership, however, has no appetite for the loss of any sensitive data (as defined by the Data Classification Policy).',
    tolerance:
      'Because the cost of loss prevention for students’ laptops is likely to exceed the cost of the devices, it is acceptable for up to 10 % to be misplaced or stolen if and only if sensitive institution information is prohibited from being stored on students’ devices.',
  },
  {
    enterprise: 'Healthcare Provider',
    appetite: 'The Board of Directors has decided that the enterprise has a low-risk appetite for any exposures caused by inadequate access control or authentication processes.',
    tolerance:
      'There will always be some devices that do not yet support advanced authentication, but 100 % of critical healthcare business applications must use multi-factor authentication.',
  },
];

// A new statement from a template, with the next free id.
export function templateStatement(statements: readonly Statement[], template: AppetiteTemplate): Statement {
  const id = nextId('AS-', statements.map((item) => item.id));
  return { id, title: `${template.enterprise} example (Table 2)`, appetite: template.appetite, tolerances: [{ id: `${id}-TOL1`, text: template.tolerance }] };
}
