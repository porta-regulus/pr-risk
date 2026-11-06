// Screen S2 Context and strategy (SPEC.md Sec. 5, 6.4 to 6.6). Saving, undo and the change
// log come from the shared frame in editor.tsx.
import type { RiskDocument } from '../schema/types';
import { AppetiteSection } from './appetite';
import { nextId, withSection, withValue } from './edit';
import { DocumentScreen, type ScreenName, type Update } from './editor';
import { Checkboxes, LinesField, SelectField, TextField } from './fields';
import { GuidedQuestions } from './guided-questions';
import { StrategySection } from './strategy';

type Context = NonNullable<RiskDocument['context']>;
type Objective = NonNullable<Context['objectives']>[number];
type BusinessFunction = NonNullable<Context['functions']>[number];
type Role = NonNullable<NonNullable<RiskDocument['governance']>['roles']>[number];

// Sec. 1.1 and 6 of SP 800-221r1 name these disciplines.
const DISCIPLINES = [
  ['cybersecurity', 'Cybersecurity'],
  ['privacy', 'Privacy'],
  ['supply chain', 'Supply chain'],
  ['OT', 'Operational technology (OT)'],
  ['IoT', 'Internet of Things (IoT)'],
  ['AI', 'Artificial intelligence (AI)'],
] as const;
const KNOWN_DISCIPLINES: readonly string[] = DISCIPLINES.map(([key]) => key);

const OBJECTIVE_KINDS: readonly (readonly [Objective['kind'], string])[] = [
  ['strategic', 'Strategic'],
  ['operations', 'Operations'],
  ['reporting', 'Reporting'],
  ['compliance', 'Compliance'],
];
const ROLE_LEVELS: readonly (readonly [Role['level'], string])[] = [
  ['enterprise-oversight', 'Enterprise oversight'],
  ['enterprise-governance', 'Enterprise governance'],
  ['enterprise-management', 'Enterprise management'],
  ['organization', 'Organization'],
  ['system', 'System'],
];

const replaceAt = <T,>(items: readonly T[], index: number, item: T | undefined): T[] =>
  item === undefined ? items.filter((_, i) => i !== index) : items.map((old, i) => (i === index ? item : old));

function ContextSection({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const context: Context = doc.context ?? {};
  const set = <K extends keyof Context>(key: K, value: Context[K] | undefined): void => {
    update((current) => withSection(current, 'context', withValue(current.context, key, value)));
  };
  const objectives = context.objectives ?? [];
  const functions = context.functions ?? [];
  const disciplines = context.disciplines ?? [];
  const objectiveUse = (id: string): number => doc.risks.filter((risk) => (risk.objectiveIds ?? []).includes(id)).length;
  const functionUse = (id: string): number => (doc.assets ?? []).filter((asset) => (asset.supportsFunctionIds ?? []).includes(id)).length;

  return (
    <section aria-labelledby="context-title" class="panel">
      <h2 id="context-title">Context</h2>
      <TextField id="mission" label="Mission" multiline value={context.mission} onChange={(value) => {
          set('mission', value);
        }} />
      <div class="grid">
        <div class="field">
          <TextField id="external-context" label="External context" multiline value={context.externalContext} onChange={(value) => {
              set('externalContext', value);
            }} />
        </div>
        <div class="field">
          <TextField id="internal-context" label="Internal context" multiline value={context.internalContext} onChange={(value) => {
              set('internalContext', value);
            }} />
        </div>
      </div>
      <LinesField id="stakeholders" label="Stakeholders, one per line" value={context.stakeholders ?? []} onChange={(value) => {
          set('stakeholders', value);
        }} />
      <Checkboxes legend="ICT risk disciplines in scope" name="disciplines" options={DISCIPLINES} value={disciplines} onChange={(value) => {
          set('disciplines', [...value, ...disciplines.filter((item) => !KNOWN_DISCIPLINES.includes(item))]);
        }} />
      <LinesField
        id="other-disciplines"
        label="Other disciplines, one per line"
        value={disciplines.filter((item) => !KNOWN_DISCIPLINES.includes(item))}
        onChange={(value) => {
          set('disciplines', [...disciplines.filter((item) => KNOWN_DISCIPLINES.includes(item)), ...value.filter((item) => !KNOWN_DISCIPLINES.includes(item))]);
        }}
      />

      <h3 id="objectives-title">Objectives</h3>
      <p class="muted">The four kinds of the enterprise risk profile (Sec. 2.3). Risks refer to objectives by ID.</p>
      {objectives.length > 0 && (
        <div class="table-box">
          <table aria-labelledby="objectives-title">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Kind</th>
                <th scope="col">Statement</th>
                <th scope="col">Risks</th>
                <th scope="col">
                  <span class="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {objectives.map((objective, i) => {
                const used = objectiveUse(objective.id);
                const row = `Objective ${String(i + 1)}`;
                return (
                  <tr key={i}>
                    <td>
                      {used > 0 ? (
                        objective.id
                      ) : (
                        <TextField id={`objective-${String(i)}-id`} label={`${row} ID`} hiddenLabel value={objective.id} onChange={(value) => {
                            set('objectives', replaceAt(objectives, i, { ...objective, id: value }));
                          }} />
                      )}
                    </td>
                    <td>
                      <SelectField id={`objective-${String(i)}-kind`} label={`${row} kind`} hiddenLabel value={objective.kind} options={OBJECTIVE_KINDS} onChange={(kind) => {
                          set('objectives', replaceAt(objectives, i, { ...objective, kind: kind ?? 'strategic' }));
                        }} />
                    </td>
                    <td>
                      <TextField id={`objective-${String(i)}-statement`} label={`${row} statement`} hiddenLabel value={objective.statement} onChange={(statement) => {
                          set('objectives', replaceAt(objectives, i, { ...objective, statement }));
                        }} />
                    </td>
                    <td>{used}</td>
                    <td>
                      <button type="button" class="quiet" aria-label={`Remove ${row}`} disabled={used > 0} title={used > 0 ? 'Risks refer to this objective.' : undefined} onClick={() => {
                          set('objectives', replaceAt(objectives, i, undefined));
                        }}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" class="quiet" onClick={() => {
          set('objectives', [...objectives, { id: nextId('OBJ-', objectives.map((item) => item.id)), kind: 'strategic', statement: '' }]);
        }}>
        Add an objective
      </button>

      <h3 id="functions-title">Mission- and business-critical functions</h3>
      <p class="muted">Assets inherit the highest criticality of the functions they support (Sec. 5.1.1).</p>
      {functions.length > 0 && (
        <div class="table-box">
          <table aria-labelledby="functions-title">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Function</th>
                <th scope="col">Criticality</th>
                <th scope="col">Assets</th>
                <th scope="col">
                  <span class="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {functions.map((item, i) => {
                const used = functionUse(item.id);
                const row = `Function ${String(i + 1)}`;
                const put = (next: BusinessFunction): void => {
                  set('functions', replaceAt(functions, i, next));
                };
                return (
                  <tr key={i}>
                    <td>
                      {used > 0 ? (
                        item.id
                      ) : (
                        <TextField id={`function-${String(i)}-id`} label={`${row} ID`} hiddenLabel value={item.id} onChange={(value) => {
                            put({ ...item, id: value });
                          }} />
                      )}
                    </td>
                    <td>
                      <TextField id={`function-${String(i)}-name`} label={`${row} name`} hiddenLabel value={item.name} onChange={(name) => {
                          put({ ...item, name });
                        }} />
                    </td>
                    <td>
                      <TextField id={`function-${String(i)}-criticality`} label={`${row} criticality`} hiddenLabel value={item.criticality} onChange={(criticality) => {
                          put({ ...item, criticality });
                        }} />
                    </td>
                    <td>{used}</td>
                    <td>
                      <button type="button" class="quiet" aria-label={`Remove ${row}`} disabled={used > 0} title={used > 0 ? 'Assets support this function.' : undefined} onClick={() => {
                          set('functions', replaceAt(functions, i, undefined));
                        }}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" class="quiet" onClick={() => {
          set('functions', [...functions, { id: nextId('F-', functions.map((item) => item.id)), name: '', criticality: '' }]);
        }}>
        Add a function
      </button>
    </section>
  );
}

function GovernanceSection({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const roles = doc.governance?.roles ?? [];
  const setRoles = (next: Role[]): void => {
    update((current) => withSection(current, 'governance', withValue(current.governance, 'roles', next)));
  };
  return (
    <section aria-labelledby="governance-title" class="panel">
      <h2 id="governance-title">Roles</h2>
      <p class="muted">The roles of Table 1 that exist in your organization. A company of 50 people usually fills 3 or 4 rows.</p>
      {roles.length > 0 && (
        <div class="table-box">
          <table aria-labelledby="governance-title">
            <thead>
              <tr>
                <th scope="col">Role</th>
                <th scope="col">Level</th>
                <th scope="col">Holder</th>
                <th scope="col">Responsibilities</th>
                <th scope="col">
                  <span class="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role, i) => {
                const row = `Role ${String(i + 1)}`;
                const put = (next: Role): void => {
                  setRoles(replaceAt(roles, i, next));
                };
                return (
                  <tr key={i}>
                    <td>
                      <TextField id={`role-${String(i)}-role`} label={`${row} name`} hiddenLabel value={role.role} onChange={(value) => {
                          put({ ...role, role: value });
                        }} />
                    </td>
                    <td>
                      <SelectField id={`role-${String(i)}-level`} label={`${row} level`} hiddenLabel value={role.level} options={ROLE_LEVELS} onChange={(level) => {
                          put({ ...role, level: level ?? 'organization' });
                        }} />
                    </td>
                    <td>
                      <TextField id={`role-${String(i)}-holder`} label={`${row} holder`} hiddenLabel value={role.holder} onChange={(holder) => {
                          put(withValue(role, 'holder', holder));
                        }} />
                    </td>
                    <td>
                      <TextField id={`role-${String(i)}-responsibilities`} label={`${row} responsibilities`} hiddenLabel value={role.responsibilities} onChange={(text) => {
                          put(withValue(role, 'responsibilities', text));
                        }} />
                    </td>
                    <td>
                      <button type="button" class="quiet" aria-label={`Remove ${row}`} onClick={() => {
                          setRoles(replaceAt(roles, i, undefined));
                        }}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" class="quiet" onClick={() => {
          setRoles([...roles, { role: '', level: 'organization' }]);
        }}>
        Add a role
      </button>
    </section>
  );
}

export function ContextScreen({ id, onNavigate }: { readonly id: string; readonly onNavigate: (screen: ScreenName) => void }) {
  return (
    <DocumentScreen id={id} screen="context" title="Context and strategy" lede="Step 1 of the life cycle, identify the context (Sec. 3.1 and 3.2). Changes are saved in this browser." onNavigate={onNavigate}>
      {(draft, update) => (
        <>
          <ContextSection doc={draft} update={update} />
          <GovernanceSection doc={draft} update={update} />
          <GuidedQuestions doc={draft} update={update} />
          <AppetiteSection doc={draft} update={update} />
          <StrategySection doc={draft} update={update} />
        </>
      )}
    </DocumentScreen>
  );
}
