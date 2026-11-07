// One register in the layout of the enterprise risk register of SP 800-221r1 Fig. 10
// (SPEC.md Sec. 6.13 item 1, golden test G1 part (b)). The importer joins the lines of a
// response cell with "; ", so the view shows each part on its own line again, as Fig. 10 does.
import { useState } from 'preact/hooks';
import type { Risk, RiskDocument } from '../schema/types';
import { SelectField } from './fields';
import { registerTree } from './identify';
import { Section } from './section';

export const ERR_COLUMNS = [
  'ID',
  'Pri.',
  'Risk Description',
  'Risk Category',
  'Financial Impact',
  'Reputation Impact',
  'Mission Impact',
  'Likelihood',
  'Exposure Rating',
  'Risk Response',
  'Risk Owner',
  'Status',
] as const;

// The cells of one row. The response cell is a list of lines.
export function errCells(risk: Risk): (string | string[])[] {
  const opex = risk.impacts?.financial?.opex?.label;
  const capex = risk.impacts?.financial?.capex?.label;
  const financial = [opex === undefined ? '' : `OpEx: ${opex}`, capex === undefined ? '' : `CapEx: ${capex}`].filter((part) => part !== '').join(' ');
  return [
    risk.riskId,
    risk.priority === undefined ? '' : String(risk.priority),
    risk.riskDescription,
    risk.riskCategory,
    financial,
    risk.impacts?.reputation?.label ?? '',
    risk.impacts?.mission?.label ?? '',
    risk.riskLikelihoodLabel ?? '',
    risk.exposureRatingLabel ?? '',
    risk.riskResponseDescription.split('; '),
    risk.riskOwnerPointOfContact,
    risk.status,
  ];
}

export function ErrView({ doc, number }: { readonly doc: RiskDocument; readonly number: number }) {
  const tree = registerTree(doc.registers);
  const [chosen, setChosen] = useState(tree.find((item) => doc.risks.some((risk) => risk.registerId === item.register.id))?.register.id ?? doc.registers[0].id);
  const register = doc.registers.find((item) => item.id === chosen) ?? doc.registers[0];
  const risks = doc.risks.filter((risk) => risk.registerId === register.id && risk.onlyWithResponse === undefined);
  return (
    <Section id="err" title="Enterprise risk register" folded help="prioritize.err">
      <div class="field">
        <SelectField
          id="err-register"
          label="Register"
          help="prioritize.err-register"
          value={register.id}
          options={tree.map((item) => [item.register.id, item.register.title] as const)}
          onChange={(id) => {
            if (id !== undefined) setChosen(id);
          }}
        />
      </div>
      {risks.length === 0 ? (
        <p class="muted">No risk in this register.</p>
      ) : (
        <div class="table-box" tabIndex={0} role="region" aria-labelledby="err-title">
          <table class="err">
            <caption>
              Table {number}. {register.title}, one row per risk.
            </caption>
            <thead>
              <tr>
                {ERR_COLUMNS.map((column) => (
                  <th scope="col" key={column}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {risks.map((risk) => (
                <tr key={risk.riskId}>
                  {errCells(risk).map((cell, i) => (
                    <td key={ERR_COLUMNS[i]}>
                      {Array.isArray(cell)
                        ? cell.map((line, j) => (
                            <span class="line" key={j}>
                              {line}
                            </span>
                          ))
                        : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
