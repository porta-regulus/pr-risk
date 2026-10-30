// Build task 7. The rules behind screen S7 Enterprise view: golden tests G1 (b), G3 and G5 of
// SPEC.md Sec. 12.2, the aggregation by category with the escalation threshold, and the
// portfolio view by register and period (Sec. 6.13 and 6.15).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { childEntries, mergeResult, parentRegisters, referencesTo, summaryEntries, withMerge, withoutRisk } from '../src/enterprise/normalize';
import { erpBlocks, portfolioRow, profileRisks, withoutObjective } from '../src/enterprise/profile';
import { decodeText, parseCsv } from '../src/import/csv';
import type { SummaryOptions } from '../src/import/rollup';
import { documentErrors, lint, nistExportErrors, type Risk, type RiskDocument } from '../src/schema';
import { assessedText } from '../src/ui/enterprise';
import { ERR_COLUMNS, errCells } from '../src/ui/err';
import { example, EXAMPLE_1, EXAMPLE_2, EXAMPLE_3 } from './schema-helpers';

const riskOf = (doc: RiskDocument, id: string): Risk => {
  const found = doc.risks.find((risk) => risk.riskId === id);
  if (found === undefined) throw new Error(id);
  return found;
};

describe('G1 (b) the ERR view of example 1 equals fixtures/sp800-221r1-fig10.csv', () => {
  const doc = example(EXAMPLE_1);
  const text = decodeText(new Uint8Array(readFileSync(new URL('../docs/schema/fixtures/sp800-221r1-fig10.csv', import.meta.url)))).text;
  const [header, ...body] = parseCsv(text).filter((row) => row.some((cell) => cell.trim() !== ''));

  it('has the 12 columns of Fig. 10 and 10 rows, every cell equal to the CSV', () => {
    expect(header?.map((cell) => cell.trim())).toEqual([...ERR_COLUMNS]);
    const rows = doc.risks.filter((risk) => risk.registerId === 'ERR').map(errCells);
    expect(rows).toHaveLength(10);
    expect(body).toHaveLength(10);
    rows.forEach((row, r) => {
      row.forEach((cell, c) => {
        const lines = (body[r]?.[c] ?? '').split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== '');
        if (Array.isArray(cell)) expect(cell, `row ${String(r + 1)} column ${ERR_COLUMNS[c] ?? ''}`).toEqual(lines);
        else expect(cell, `row ${String(r + 1)} column ${ERR_COLUMNS[c] ?? ''}`).toBe(lines.join(' '));
      });
    });
  });
});

describe('G3 merge and normalization in the parent register (Table 10)', () => {
  const source = example(EXAMPLE_3);
  const org1 = riskOf(source, 'ORG-1');
  const doc = withoutRisk(source, 'ORG-1');
  const sources = ['A-1', 'B-1', 'C-1'].map((id) => riskOf(doc, id));
  const options: SummaryOptions = {
    id: 'ORG-1',
    registerId: 'ORG',
    riskDescription: org1.riskDescription,
    riskOwnerPointOfContact: org1.riskOwnerPointOfContact,
    layout: 'one-row-all-responses',
    riskResponseDescription: org1.riskResponseDescription,
    priority: 1,
  };

  it('(a) lists A-1, B-1 and C-1 below ORG in one category group, with their source tags', () => {
    expect(parentRegisters(source).map((register) => register.id)).toEqual(['ORG']);
    const groups = childEntries(source, 'ORG');
    const ict = groups.find((group) => group.code === 'ict');
    expect(groups.map((group) => group.code)).toEqual(['ict']);
    expect(ict?.entries.filter((entry) => entry.risk.category.subcode === 'ict.data-exfiltration').map((entry) => [entry.risk.riskId, entry.summarizedBy])).toEqual([
      ['A-1', ['ORG-1']],
      ['B-1', ['ORG-1']],
      ['C-1', ['ORG-1']],
    ]);
  });

  it('(b) one-row-all-responses gives ORG-1 of example 3, and the document stays valid', () => {
    const result = mergeResult(doc, { sources, options });
    if (!('rows' in result)) throw new Error(result.problems.join(' '));
    const merged = withMerge(doc, result.rows);
    const { notes, ...expected } = org1;
    expect(riskOf(merged, 'ORG-1')).toEqual(expected);
    expect(riskOf(merged, 'ORG-1').riskResponseType).toEqual(['Mitigate', 'Accept']);
    expect(riskOf(merged, 'ORG-1').sourceRefs?.map((ref) => ref.label)).toEqual(['A-1', 'B-1', 'C-1']);
    expect(riskOf(merged, 'ORG-1').rollUp?.likelihood).toEqual({ optimistic: 0.1, mostLikely: 0.2, pessimistic: 0.3 });
    expect(riskOf(merged, 'ORG-1').rollUp?.impact).toEqual({ optimistic: 400_000, mostLikely: 800_000, pessimistic: 2_000_000 });
    expect(documentErrors(merged)).toEqual([]);
    expect(nistExportErrors(merged)).toEqual([]);
    expect(summaryEntries(merged, 'ORG').map((risk) => risk.riskId)).toEqual(['ORG-1']);
  });

  it('(c) and (d) one-row-per-response gives Mitigate (A-1, B-1) with the n = 2 rule and Accept (C-1) with the n = 1 rule', () => {
    const result = mergeResult(doc, { sources, options: { ...options, layout: 'one-row-per-response' } });
    if (!('rows' in result)) throw new Error(result.problems.join(' '));
    expect(result.rows.map((row) => [row.riskId, row.riskResponseType, row.sourceRefs?.map((ref) => ref.riskId)])).toEqual([
      ['ORG-1', ['Mitigate'], ['A-1', 'B-1']],
      ['ORG-1.2', ['Accept'], ['C-1']],
    ]);
    expect(result.rows[0]?.rollUp?.likelihood).toEqual({ optimistic: 0.1, mostLikely: 0.2, pessimistic: 0.3 });
    expect(result.rows[0]?.rollUp?.impact).toEqual({ optimistic: 400_000, mostLikely: 1_200_000, pessimistic: 2_000_000 });
    expect(result.rows[1]?.rollUp?.likelihood).toEqual({ optimistic: 0.2, mostLikely: 0.2, pessimistic: 0.2 });
    expect(result.rows[1]?.rollUp?.impact).toEqual({ optimistic: 800_000, mostLikely: 800_000, pessimistic: 800_000 });
    const merged = withMerge(doc, result.rows);
    expect(documentErrors(merged)).toEqual([]);
    expect(lint(merged).filter((finding) => finding.rule === 'L-10')).toEqual([]);
  });

  it('(e) lint L-10 flags ORG-1 after the merge', () => {
    const result = mergeResult(doc, { sources, options });
    if (!('rows' in result)) throw new Error(result.problems.join(' '));
    expect(
      lint(withMerge(doc, result.rows))
        .filter((finding) => finding.rule === 'L-10')
        .map((finding) => finding.riskIds),
    ).toEqual([['ORG-1']]);
  });

  it('refuses a merge without sources, text or owner, with a taken id or with mixed polarity', () => {
    const problems = (merge: Parameters<typeof mergeResult>[1]): string[] => {
      const result = mergeResult(source, merge);
      return 'problems' in result ? result.problems : [];
    };
    expect(problems({ sources: [], options: { ...options, id: 'ORG-2', riskDescription: ' ', riskOwnerPointOfContact: '' } })).toEqual([
      'Select at least one entry.',
      'Write the combined risk description.',
      'Name the risk owner at the level of the parent register.',
    ]);
    expect(problems({ sources, options })).toEqual(['The id ORG-1 is in use.']);
    expect(problems({ sources, options: { ...options, id: 'ORG 2' } })[0]).toMatch(/^The id must start/);
    expect(problems({ sources: [...sources, { ...riskOf(source, 'B-1'), riskId: 'P-1', polarity: 'positive' }], options: { ...options, id: 'ORG-2' } })).toEqual([
      'Select only negative or only positive entries.',
    ]);
  });

  it('a summary that something refers to cannot be removed, and its sources stay', () => {
    expect(referencesTo(source, 'ORG-1')).toEqual([]);
    expect(referencesTo(source, 'A-1')).toEqual(['ORG-1']);
    expect(doc.risks.map((risk) => risk.riskId)).toEqual(source.risks.map((risk) => risk.riskId).filter((id) => id !== 'ORG-1'));
  });

  it('a summary keeps the objectives of its sources', () => {
    const linked = sources.map((risk, i) => ({ ...risk, objectiveIds: i === 2 ? ['OBJ-2', 'OBJ-1'] : ['OBJ-1'] }));
    const result = mergeResult(doc, { sources: linked, options });
    if (!('rows' in result)) throw new Error(result.problems.join(' '));
    expect(result.rows[0]?.objectiveIds).toEqual(['OBJ-1', 'OBJ-2']);
  });
});

describe('Adjudicate key risks with the escalation threshold (Sec. 6.15 item 2)', () => {
  const doc = example(EXAMPLE_2);

  it('flags the entries of PROD-A at or above EUR 25 000 that no summary entry of CORP holds', () => {
    const entries = childEntries(doc, 'CORP').flatMap((group) => group.entries);
    expect(entries.map((entry) => [entry.risk.riskId, entry.escalate])).toEqual([
      ['R-07', true],
      ['R-08', true],
    ]);
    const result = mergeResult(doc, {
      sources: [riskOf(doc, 'R-07')],
      options: { id: 'CORP-1', registerId: 'CORP', riskDescription: 'Firmware signing key misuse at the company level.', riskOwnerPointOfContact: 'IT lead', layout: 'one-row-all-responses' },
    });
    if (!('rows' in result)) throw new Error(result.problems.join(' '));
    const merged = withMerge(doc, result.rows);
    expect(documentErrors(merged)).toEqual([]);
    expect(
      childEntries(merged, 'CORP')
        .flatMap((group) => group.entries)
        .map((entry) => [entry.risk.riskId, entry.escalate, entry.summarizedBy]),
    ).toEqual([
      ['R-07', false, ['CORP-1']],
      ['R-08', true, []],
    ]);
  });

  it('a summary entry replaces its sources in a profile, so no risk counts twice', () => {
    const result = mergeResult(doc, {
      sources: [riskOf(doc, 'R-07'), riskOf(doc, 'R-08')],
      options: { id: 'CORP-1', registerId: 'CORP', riskDescription: 'Product line A risks at the company level.', riskOwnerPointOfContact: 'IT lead', layout: 'one-row-all-responses' },
    });
    if (!('rows' in result)) throw new Error(result.problems.join(' '));
    const merged = withMerge(doc, result.rows);
    expect(profileRisks(merged).map((risk) => risk.riskId)).toEqual(['R-01', 'R-02', 'R-03', 'R-04', 'R-05', 'R-06', 'CORP-1']);
    expect(profileRisks(merged, 'PROD-A').map((risk) => risk.riskId)).toEqual(['R-07', 'R-08']);
  });
});

// Fig. 11 (p. 42, line 1382). Impact and likelihood, each with Last, Current and Residual.
// Fig. 11 prints "Medum" for the residual impact of F11-2. The fixture stores "Medium".
const FIG_11 = {
  'F11-1': { impact: ['High', 'Medium', 'Medium'], likelihood: ['Low', 'Low', 'Low'] },
  'F11-2': { impact: ['High', 'High', 'Medium'], likelihood: ['Medium', 'Medium', 'Low'] },
  'F11-3': { impact: ['High', 'High', 'Medium'], likelihood: ['Medium', 'Medium', 'Medium'] },
} as const;

describe('G5 the ERP view of example 1 in the layout of Fig. 11', () => {
  const doc = example(EXAMPLE_1);
  const blocks = erpBlocks(doc);

  it('(a) renders 3 blocks headed OPERATIONS, REPORTING and OPERATIONS OBJECTIVE with the statements', () => {
    expect(blocks.map((block) => block.heading)).toEqual(['OPERATIONS OBJECTIVE', 'REPORTING OBJECTIVE', 'OPERATIONS OBJECTIVE']);
    expect(blocks.map((block) => block.objective.statement)).toEqual((doc.context?.objectives ?? []).map((objective) => objective.statement));
    expect(blocks.map((block) => block.rows.map((row) => row.risk.riskId))).toEqual([['F11-1'], ['F11-2'], ['F11-3']]);
    expect(erpBlocks(doc, 'ERP11')).toEqual(blocks);
    expect(erpBlocks(doc, 'ERR')).toEqual([]);
  });

  it('(b) Impact and Likelihood show Last, Current and Residual equal to Fig. 11', () => {
    for (const row of blocks.flatMap((block) => block.rows)) {
      const expected = FIG_11[row.risk.riskId as keyof typeof FIG_11];
      expect(row.impact.map((value) => assessedText(value, 'impact')), row.risk.riskId).toEqual(expected.impact);
      expect(row.likelihood.map((value) => assessedText(value, 'likelihood')), row.risk.riskId).toEqual(expected.likelihood);
    }
  });

  it('(c) Current Risk Response, Proposed Risk Response and Risk Owner equal the fixture', () => {
    for (const row of blocks.flatMap((block) => block.rows)) {
      const risk = riskOf(doc, row.risk.riskId);
      expect([row.currentResponse, row.proposedResponse, row.owner]).toEqual([risk.detail?.implementedResponseDescription, risk.riskResponseDescription, risk.riskOwnerPointOfContact]);
    }
    expect(blocks[0]?.rows[0]?.owner).toBe('Primary - Chief Operating Officer (COO)');
  });

  it('(d) the IR 8286 export of F11-1 to F11-3 validates', () => {
    expect(nistExportErrors({ ...doc, risks: doc.risks.filter((risk) => risk.registerId === 'ERP11') })).toEqual([]);
  });

  it('lists the risks without an objective (L-09), and shows numbers when a risk has no label', () => {
    expect(withoutObjective(doc, 'ERR').map((risk) => risk.riskId)).toEqual(['1', '2', '3', '4', '5', '6', '7', '9', '10']);
    const quantitative = example(EXAMPLE_2);
    const [operations] = erpBlocks(quantitative).filter((block) => block.objective.id === 'OBJ-O1');
    const r01 = operations?.rows.find((row) => row.risk.riskId === 'R-01');
    expect(r01?.impact.map((value) => assessedText(value, 'impact'))).toEqual(['800,000', riskOf(quantitative, 'R-01').riskImpact.toLocaleString('en'), 'Not set']);
    expect(r01?.likelihood.map((value) => assessedText(value, 'likelihood'))).toEqual(['0.1200', riskOf(quantitative, 'R-01').riskLikelihood.toFixed(4), 'Not set']);
  });

  it('shows a placeholder number as not set', () => {
    const gw = erpBlocks({ ...example(EXAMPLE_3), context: { objectives: [{ id: 'O-1', kind: 'compliance', statement: 'Ship secure products.' }] } });
    expect(gw).toEqual([]);
    const linked = example(EXAMPLE_3);
    const withObjective: RiskDocument = {
      ...linked,
      context: { objectives: [{ id: 'O-1', kind: 'compliance', statement: 'Ship secure products.' }] },
      risks: linked.risks.map((risk) => (risk.riskId === 'GW-1' ? { ...risk, objectiveIds: ['O-1'] } : risk)),
    };
    const [block] = erpBlocks(withObjective);
    expect(block?.heading).toBe('COMPLIANCE OBJECTIVE');
    expect(block?.rows[0]?.impact.map((value) => assessedText(value, 'impact'))).toEqual(['Not set', 'Not set', 'Not set']);
  });
});

describe('Portfolio view by register and period (Sec. 6.13 item 3)', () => {
  it('sums the exposure ratings of the subtree for the current and the previous period', () => {
    const doc = example(EXAMPLE_2);
    expect(portfolioRow(doc, 'CORP')).toEqual({ entries: 7, current: 229_648, defaulted: 0, previous: 111_000, previousEntries: 2 });
    expect(portfolioRow(doc, 'PROD-A')).toEqual({ entries: 2, current: 64_850, defaulted: 0, previous: 15_000, previousEntries: 1 });
    expect(portfolioRow(doc)).toEqual(portfolioRow(doc, 'CORP'));
  });

  it('gives the highest reputation and mission labels on the impact scale, without closed and positive risks', () => {
    const doc = example(EXAMPLE_1);
    expect(portfolioRow(doc, 'ERR')).toEqual({ entries: 8, current: 11_650_000, defaulted: 8, previous: 0, previousEntries: 0, reputation: 'High', mission: 'High' });
    expect(portfolioRow(doc, 'ERP11')).toEqual({ entries: 3, current: 10_100_000, defaulted: 3, previous: 11_000_000, previousEntries: 3 });
    expect(portfolioRow(doc).current).toBe(21_750_000);
  });

  it('counts a summary entry instead of its sources', () => {
    const doc = example(EXAMPLE_3);
    expect(portfolioRow(doc, 'ORG')).toMatchObject({ entries: 4, current: 160_000 + 150_000, defaulted: 2 });
    expect(portfolioRow(doc, 'SYS-A')).toMatchObject({ entries: 1, current: 200_000 });
  });
});
