// The catalogue picker of S3 (SPEC.md Sec. 6.7.1 item 3 and 6.7.7). A template gives text and
// category only, never numbers (hard rule 2). The 3 opportunity templates are quoted exactly
// from SP 800-221r1 ipd. The 119 names of the Risklet catalogue are CC BY 4.0 content of
// PortaRegulus (ADR-0003, open question Q3 answered 2026-10-29) in src/catalogue/risklet.json.
import risklet from '../catalogue/risklet.json';
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

const OPPORTUNITIES: readonly CatalogueEntry[] = [
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

export const RISKLET_ATTRIBUTION = risklet.attribution;

type Subcode = `${Risk['category']['code']}.${string}`;

// The Risklet labels of SPEC.md Sec. 6.7.7. A "row" there is the RISK ID of the workbook.
const LABELS: Readonly<Record<string, Subcode>> = {
  Malware: 'ict.malware',
  'Supply Chain': 'ict.supply-chain',
  DevOps: 'ict.supply-chain',
  Container: 'ict.supply-chain',
  Development: 'ict.supply-chain',
  Vendor: 'ict.supply-chain',
  Access: 'ict.identity',
  Identity: 'ict.identity',
  Authentication: 'ict.identity',
  'Remote Access': 'ict.identity',
  Data: 'ict.data-exfiltration',
  'Source Code': 'ict.data-exfiltration',
  Document: 'ict.data-exfiltration',
  HR: 'ict.data-exfiltration',
  Infrastructure: 'ict.availability',
  Network: 'ict.availability',
  Storage: 'ict.availability',
  Database: 'ict.availability',
  Backup: 'ict.availability',
  Email: 'ict.availability',
  Systems: 'ict.availability',
  'Edge Computing': 'ict.availability',
  Cloud: 'ict.misconfiguration',
  Configuration: 'ict.misconfiguration',
  Change: 'ict.misconfiguration',
  Automation: 'ict.misconfiguration',
  Security: 'ict.vulnerability',
  Web: 'ict.vulnerability',
  API: 'ict.vulnerability',
  Endpoint: 'ict.vulnerability',
  Mobile: 'ict.vulnerability',
  IoT: 'ict.vulnerability',
  Blockchain: 'ict.vulnerability',
  Physical: 'ict.physical-environmental',
  AI: 'ict.ai',
  'Emerging Tech': 'ict.ai',
  Business: 'ict.fraud',
  Compliance: 'legal.regulatory',
  Staffing: 'operational.people',
};
const MISCONFIGURATION = new Set(['Network Segmentation Failure', 'Network Sensor Blind Spots', 'Load Balancer Configuration Drift']);
const BY_ID: Readonly<Record<string, Subcode>> = { '54': 'operational.supplier', '61': 'legal.privacy', '64': 'legal.contract' };

// The subcode of one Risklet entry, or undefined for a label outside the map.
export function riskletSubcode(entry: { readonly id: string; readonly name: string; readonly label: string }): Subcode | undefined {
  if (MISCONFIGURATION.has(entry.name)) return 'ict.misconfiguration';
  return BY_ID[entry.id] ?? LABELS[entry.label];
}

const RISKLET: readonly CatalogueEntry[] = risklet.entries.flatMap((entry) => {
  const subcode = riskletSubcode(entry);
  if (subcode === undefined) return [];
  const code = subcode.split('.')[0] as Risk['category']['code'];
  return [
    {
      id: entry.id,
      catalogue: risklet.catalogue,
      group: `Risklet, ${entry.label}`,
      text: entry.name,
      polarity: 'negative' as const,
      category: { code, subcode },
      source: `Risklet ${entry.id}`,
    },
  ];
});

export const CATALOGUE: readonly CatalogueEntry[] = [...OPPORTUNITIES, ...RISKLET];

// The groups of the picker. The opportunities first, then the Risklet labels in alphabetical order.
export const CATALOGUE_GROUPS: readonly string[] = [OPPORTUNITIES[0]?.group ?? '', ...[...new Set(RISKLET.map((entry) => entry.group))].sort()];

// The fields a template sets on a new risk. Numbers stay the placeholders of rule D-Q2.
export function fromCatalogue(risk: Risk, entry: CatalogueEntry): Risk {
  return { ...risk, category: entry.category, catalogueRef: { catalogue: entry.catalogue, id: entry.id } };
}
