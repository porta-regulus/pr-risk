// The catalogue picker of S3 (SPEC.md Sec. 6.7.1 item 3 and 6.7.7). A template gives text and
// category only, never numbers (hard rule 2). The 3 opportunity templates are quoted exactly
// from SP 800-221r1 ipd. The 119 names of the Risklet catalogue join this list only after the
// product owner confirms the rights (open question Q3, SPEC.md Sec. 15).
import type { Risk } from '../schema/types';

export interface CatalogueEntry {
  readonly id: string;
  readonly catalogue: string;
  readonly group: string;
  readonly text: string;
  readonly polarity: Risk['polarity'];
  readonly category: Risk['category'];
  readonly source: string;
}

export const CATALOGUE: readonly CatalogueEntry[] = [
  {
    id: 'OPP-1',
    catalogue: 'SP 800-221r1 opportunities',
    group: 'Opportunities from NIST text',
    text: 'A strategic opportunity to hire a famous technologist to establish a new satellite communications initiative.',
    polarity: 'positive',
    category: { code: 'operational', subcode: 'operational.people' },
    source: 'SP 800-221r1 Fig. 10 item 2',
  },
  {
    id: 'OPP-2',
    catalogue: 'SP 800-221r1 opportunities',
    group: 'Opportunities from NIST text',
    text: 'Construction of a new alternate data center improves the resilience of financial infrastructure and reduces the likelihood of an interruption.',
    polarity: 'positive',
    category: { code: 'ict', subcode: 'ict.availability' },
    source: 'SP 800-221r1 lines 844 to 846',
  },
  {
    id: 'OPP-3',
    catalogue: 'SP 800-221r1 opportunities',
    group: 'Opportunities from NIST text',
    text: 'Adopting a new cloud-based authentication platform introduces moderate implementation risks but presents a high-likelihood opportunity to reduce credential-based incidents by 40 % and improve user access efficiency.',
    polarity: 'positive',
    category: { code: 'ict', subcode: 'ict.identity' },
    source: 'SP 800-221r1 Sec. 3.8, lines 1191 to 1194',
  },
];

// The fields a template sets on a new risk. Numbers stay the placeholders of rule D-Q2.
export function fromCatalogue(risk: Risk, entry: CatalogueEntry): Risk {
  return { ...risk, category: entry.category, catalogueRef: { catalogue: entry.catalogue, id: entry.id } };
}
