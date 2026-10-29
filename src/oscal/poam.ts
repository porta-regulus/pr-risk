// OSCAL 1.2.3 POA&M export and import (SPEC.md Sec. 7.5, AT-4).
// Export carries the whole native document as an RFC 8785 payload in back-matter, so an
// import with a matching hash is lossless. Without the payload, risks come back from the
// mapped elements, and the import report lists what is missing.
import { fromBase64, toBase64 } from '../schema/base64';
import { canonicalize } from '../schema/canonical';
import { readDocument } from '../schema/document';
import { sha256Hex } from '../schema/sha256';
import type { Register, Risk, RiskDocument } from '../schema/types';
import { PR_RISK_NAMESPACE, uuidv5 } from './uuid';

export const OSCAL_VERSION = '1.2.3';
export const NS = 'https://www.portaregulus.com/ns/risk';
const NIST_NS = 'http://csrc.nist.gov/ns/oscal';
const PAYLOAD_TITLE = 'pr-risk-document';

interface Prop {
  name: string;
  value: string;
  ns?: string;
  class?: string;
  group?: string;
}

interface Facet {
  name: string;
  system: string;
  value: string;
  props?: Prop[];
}

const STATUS_TO_OSCAL: Readonly<Record<string, string>> = {
  Open: 'open',
  'In treatment': 'remediating',
  Monitored: 'open',
  Accepted: 'deviation-approved',
  'Review needed': 'investigating',
  Closed: 'closed',
};

// Risk fields that the OSCAL elements carry themselves (title, facets, deadline, response).
const MAPPED_FIELDS = new Set([
  'riskDescription',
  'riskLikelihood',
  'riskImpact',
  'exposureRating',
  'riskResponseType',
  'riskResponseCost',
  'riskResponseDescription',
  'reviewDue',
]);

const SIMPLE_TEXT = /^\S(.*\S)?$/;
const singleLine = (text: string): string => text.replace(/\s+/g, ' ').trim() || '-';

// One prop per field. Plain text where OSCAL allows it, else JSON with class "json".
function propOf(name: string, value: unknown, group?: string): Prop {
  const base = { name, ns: NS, ...(group === undefined ? {} : { group }) };
  if (typeof value === 'string' && SIMPLE_TEXT.test(value) && !value.includes('\n')) return { ...base, value };
  if (typeof value === 'number') return { ...base, value: String(value), class: 'number' };
  return { ...base, value: JSON.stringify(value), class: 'json' };
}

function valueOf(prop: Prop): unknown {
  if (prop.class === 'json') return JSON.parse(prop.value) as unknown;
  if (prop.class === 'number') return Number(prop.value);
  return prop.value;
}

function facets(state: 'initial' | 'adjusted', values: { likelihood?: number; impact?: number; risk?: number; likelihoodLabel?: string; impactLabel?: string; riskLabel?: string }): Facet[] {
  const out: Facet[] = [];
  const add = (name: string, label: string | undefined, number: number | undefined): void => {
    const value = label ?? (number === undefined ? undefined : String(number));
    if (value !== undefined) out.push({ name, system: NIST_NS, value, props: [{ name: 'state', value: state }] });
  };
  add('likelihood', values.likelihoodLabel, values.likelihood);
  add('impact', values.impactLabel, values.impact);
  add('risk', values.riskLabel, values.risk);
  return out;
}

export interface PoamOptions {
  // Time of the export. Default now.
  readonly lastModified?: string;
}

export function exportPoam(doc: RiskDocument, options: PoamOptions = {}): Record<string, unknown> {
  const id = (name: string): string => uuidv5(PR_RISK_NAMESPACE, `${doc.document.id}/${name}`);
  const toolUuid = uuidv5(PR_RISK_NAMESPACE, 'tool/pr-risk');
  const origin = { actors: [{ type: 'tool', 'actor-uuid': toolUuid }] };
  const payload = canonicalize(doc);
  const payloadBytes = new TextEncoder().encode(payload);
  const responses = doc.responses ?? [];

  const risks = doc.risks.map((risk) => {
    const props: Prop[] = [];
    for (const [field, value] of Object.entries(risk)) {
      if (MAPPED_FIELDS.has(field) || value === undefined) continue;
      if (field === 'detail' && value !== null && typeof value === 'object') {
        for (const [part, inner] of Object.entries(value as Record<string, unknown>)) props.push(propOf(part, inner, 'detail'));
        continue;
      }
      props.push(propOf(field, value));
    }
    const detail = risk.detail ?? {};
    const planned = detail.planned;
    const characterizations: Record<string, unknown>[] = [
      {
        origin,
        facets: [
          ...facets('initial', {
            likelihood: risk.riskLikelihood,
            impact: risk.riskImpact,
            risk: risk.exposureRating,
            ...(risk.riskLikelihoodLabel === undefined ? {} : { likelihoodLabel: risk.riskLikelihoodLabel }),
            ...(risk.riskImpactLabel === undefined ? {} : { impactLabel: risk.riskImpactLabel }),
            ...(risk.exposureRatingLabel === undefined ? {} : { riskLabel: risk.exposureRatingLabel }),
          }),
        ],
      },
      {
        origin,
        facets: [
          { name: 'likelihood-probability', system: NS, value: String(risk.riskLikelihood) },
          { name: 'impact-conditional-mean', system: NS, value: String(risk.riskImpact) },
          { name: 'expected-annual-impact', system: NS, value: String(risk.exposureRating) },
          { name: 'polarity', system: NS, value: risk.polarity },
        ],
      },
    ];
    if (planned !== undefined) {
      const adjusted = facets('adjusted', {
        ...(planned.likelihood === undefined ? {} : { likelihood: planned.likelihood }),
        ...(planned.impact === undefined ? {} : { impact: planned.impact }),
        ...(planned.exposureRating === undefined ? {} : { risk: planned.exposureRating }),
        ...(planned.likelihoodLabel === undefined ? {} : { likelihoodLabel: planned.likelihoodLabel }),
        ...(planned.impactLabel === undefined ? {} : { impactLabel: planned.impactLabel }),
        ...(planned.exposureRatingLabel === undefined ? {} : { riskLabel: planned.exposureRatingLabel }),
      });
      if (adjusted.length > 0) characterizations.splice(1, 0, { origin, facets: adjusted });
    }
    const drivers = new Set((risk.driverLinks ?? []).map((link) => link.driverId));
    const options = responses.filter((option) =>
      option.effects.some((effect) => (effect.targetKind === 'risk' && effect.targetId === risk.riskId) || (effect.targetKind === 'driver' && drivers.has(effect.targetId))),
    );
    const remediations = [
      {
        uuid: id(`risk/${risk.riskId}/response`),
        lifecycle: risk.responseDecision === 'decided' ? 'planned' : 'recommendation',
        title: risk.riskResponseType.join(', '),
        description: risk.riskResponseDescription,
        props: [
          { name: 'role', ns: NS, value: 'nist-response' },
          propOf('riskResponseType', risk.riskResponseType),
          propOf('riskResponseCost', risk.riskResponseCost),
          propOf('riskResponseDescription', risk.riskResponseDescription),
        ],
      },
      ...options.map((option) => ({
        uuid: id(`risk/${risk.riskId}/option/${option.id}`),
        lifecycle: option.status === 'implemented' ? 'completed' : option.status === 'selected' ? 'planned' : 'recommendation',
        title: singleLine(option.title),
        description: option.description ?? option.title,
        props: [
          { name: 'role', ns: NS, value: 'response-option' },
          propOf('optionId', option.id),
          propOf('responseType', option.responseType),
          propOf('optionStatus', option.status),
          propOf('costs', option.costs),
          ...(option.controlTypes === undefined ? [] : [propOf('controlTypes', option.controlTypes)]),
          ...(option.informativeReferences === undefined ? [] : [propOf('informativeReferences', option.informativeReferences)]),
        ],
      })),
    ];
    return {
      uuid: id(`risk/${risk.riskId}`),
      title: singleLine(risk.riskDescription),
      description: detail.riskScenarioDescription ?? risk.riskDescription,
      statement: detail.primaryAdverseImpact ?? `If this risk occurs, the expected annual ${risk.polarity === 'negative' ? 'loss' : 'gain'} is ${String(risk.exposureRating)} ${doc.document.currency}.`,
      props: [propOf('riskDescription', risk.riskDescription), ...props],
      status: STATUS_TO_OSCAL[risk.status] ?? 'open',
      characterizations,
      ...(risk.reviewDue === undefined ? {} : { deadline: `${risk.reviewDue}T00:00:00Z` }),
      remediations,
    };
  });

  return {
    'plan-of-action-and-milestones': {
      uuid: id('poam'),
      metadata: {
        title: singleLine(doc.document.title),
        'last-modified': options.lastModified ?? doc.document.updatedOn ?? doc.document.createdOn,
        version: `${doc.schemaVersion}+${sha256Hex(payloadBytes).slice(0, 12)}`,
        'oscal-version': OSCAL_VERSION,
        parties: [{ uuid: id('organization'), type: 'organization', name: singleLine(doc.document.organization ?? doc.document.title) }],
      },
      'system-id': { 'identifier-type': 'http://ietf.org/rfc/rfc4122', id: id('system') },
      'local-definitions': {
        components: [{ uuid: toolUuid, type: 'software', title: 'PortaRegulus Risk', description: 'The free risk app that wrote this POA&M.', status: { state: 'operational' } }],
      },
      ...(risks.length === 0 ? {} : { risks }),
      'poam-items': doc.risks.map((risk) => ({
        uuid: id(`risk/${risk.riskId}/item`),
        title: singleLine(risk.riskDescription),
        description: risk.riskResponseDescription,
        'related-risks': [{ 'risk-uuid': id(`risk/${risk.riskId}`) }],
      })),
      'back-matter': {
        resources: [
          {
            uuid: id('payload'),
            title: PAYLOAD_TITLE,
            props: [{ name: 'sha256', ns: NS, value: sha256Hex(payloadBytes) }],
            base64: { filename: 'pr-risk-document.json', 'media-type': 'application/json', value: toBase64(payloadBytes) },
          },
        ],
      },
    },
  };
}

export type PoamImport =
  | { readonly path: 'lossless'; readonly document: RiskDocument; readonly report: readonly string[] }
  | { readonly path: 'native'; readonly risks: Risk[]; readonly registers: Register[]; readonly report: readonly string[] };

interface OscalRisk {
  title?: string;
  props?: Prop[];
  characterizations?: { facets?: Facet[] }[];
  deadline?: string;
  remediations?: { props?: Prop[] }[];
}

// Field names that the native import accepts: the risk and riskDetail properties of the
// schema, with the NIST register fields. A prop with another name is reported and dropped, so a
// crafted file cannot set __proto__ or an inherited name. test/oscal.test.ts checks the lists.
export const RISK_FIELDS: ReadonlySet<string> = new Set([
  'acceptance', 'assetIds', 'catalogueRef', 'category', 'defaultedFields', 'detail', 'driverLinks', 'estimate', 'evidence',
  'exposureRating', 'exposureRatingLabel', 'horizon', 'impacts', 'linkedRisks', 'notes', 'objectiveIds', 'onlyWithResponse',
  'polarity', 'previousAssessment', 'priority', 'priorityOverride', 'registerId', 'responseDecision', 'reviewDue',
  'riskCategory', 'riskDescription', 'riskId', 'riskImpact', 'riskImpactLabel', 'riskLikelihood', 'riskLikelihoodLabel',
  'riskOwnerPointOfContact', 'riskResponseCost', 'riskResponseDescription', 'riskResponseType', 'rollUp', 'sourceRefs',
  'status', 'threatSourceType',
]);
export const DETAIL_FIELDS: ReadonlySet<string> = new Set([
  'assetsAffected', 'comments', 'currentRiskAnalysis', 'currentStatusDate', 'dateOfRiskIdentification', 'dependencies',
  'followUpDate', 'implementedResponseDescription', 'measured', 'organizationOrBusinessUnit', 'otherScenarioDetails',
  'planned', 'primaryAdverseImpact', 'residualResponseAsImplemented', 'resourceRequirementsForPlannedRisk',
  'riskScenarioDescription', 'secondaryAdverseImpacts', 'sourceOfRiskInformation', 'systemAffected', 'threatEvents',
  'threatSourcesActors', 'threatVectors', 'vulnerabilityPredisposingConditions',
]);

const NOT_IN_OSCAL = ['context', 'governance', 'strategy', 'appetite', 'assets', 'drivers', 'responses', 'forecasts', 'simulation', 'provenance', 'changeLog'];

export function importPoam(json: unknown, target: RiskDocument, asOf: string): PoamImport {
  const poam = (json as { 'plan-of-action-and-milestones'?: Record<string, unknown> })['plan-of-action-and-milestones'];
  if (poam === undefined) throw new Error('The file is not an OSCAL POA&M.');
  const resources = ((poam['back-matter'] as { resources?: Record<string, unknown>[] } | undefined)?.resources ?? []);
  const resource = resources.find((item) => item['title'] === PAYLOAD_TITLE);
  if (resource !== undefined) {
    const base64 = resource['base64'] as { value?: string } | undefined;
    const declared = ((resource['props'] as Prop[] | undefined) ?? []).find((prop) => prop.name === 'sha256')?.value;
    const bytes = base64?.value === undefined ? undefined : fromBase64(base64.value);
    if (bytes !== undefined && declared === sha256Hex(bytes)) {
      const read = readDocument(new TextDecoder().decode(bytes));
      if (read.ok) return { path: 'lossless', document: read.doc, report: ['The payload hash matches. The document is restored without loss.'] };
    }
  }
  const report = [resource === undefined ? 'The POA&M has no pr-risk payload. Risks come from the mapped elements.' : 'The payload hash does not match. Risks come from the mapped elements.'];
  const risks = ((poam['risks'] as OscalRisk[] | undefined) ?? []).map((item, index): Risk => {
    // Maps, not plain objects, until the names are checked. Object.fromEntries defines own properties.
    const fields = new Map<string, unknown>();
    const detail = new Map<string, unknown>();
    const unknown: string[] = [];
    const take = (prop: Prop, into: Map<string, unknown>, allowed: ReadonlySet<string>): void => {
      if (allowed.has(prop.name)) into.set(prop.name, valueOf(prop));
      else unknown.push(prop.name);
    };
    for (const prop of item.props ?? []) {
      if (prop.ns !== NS) continue;
      if (prop.group === 'detail') take(prop, detail, DETAIL_FIELDS);
      else take(prop, fields, RISK_FIELDS);
    }
    if (detail.size > 0) fields.set('detail', Object.fromEntries(detail));
    const ours = new Map((item.characterizations ?? []).flatMap((c) => c.facets ?? []).filter((facet) => facet.system === NS).map((facet) => [facet.name, facet.value]));
    fields.set('riskLikelihood', Number(ours.get('likelihood-probability') ?? 0));
    fields.set('riskImpact', Number(ours.get('impact-conditional-mean') ?? 0));
    fields.set('exposureRating', Number(ours.get('expected-annual-impact') ?? 0));
    fields.set('riskDescription', fields.get('riskDescription') ?? item.title ?? `Risk ${String(index + 1)}`);
    const response = (item.remediations ?? []).find((remediation) => (remediation.props ?? []).some((prop) => prop.name === 'role' && prop.value === 'nist-response'));
    for (const prop of response?.props ?? []) if (prop.ns === NS && prop.name !== 'role') take(prop, fields, RISK_FIELDS);
    if (item.deadline !== undefined) fields.set('reviewDue', item.deadline.slice(0, 10));
    if (unknown.length > 0) report.push(`Risk ${String(index + 1)} has props with unknown names. They are ignored: ${unknown.join(', ')}.`);
    return Object.fromEntries(fields) as unknown as Risk;
  });
  const known = new Set(target.registers.map((register) => register.id));
  const registers: Register[] = [];
  for (const risk of risks) {
    if (known.has(risk.registerId)) continue;
    known.add(risk.registerId);
    registers.push({ id: risk.registerId, title: risk.registerId, level: 'system', timeframeMonths: 12, asOf, method: 'qualitative' });
    report.push(`Register ${risk.registerId} is not in OSCAL. It is created with default fields.`);
  }
  report.push(`These parts of the document are not in the mapped elements: ${NOT_IN_OSCAL.join(', ')}.`);
  return { path: 'native', risks, registers, report };
}
