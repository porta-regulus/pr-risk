// The acceptance record of a risk (SPEC.md Sec. 6.14 item 1), on screens S5 and S6. Who
// accepted, when, until when and why. An acceptance past its end date needs a review.
import type { Risk } from '../schema/types';
import { withValue } from './edit';
import type { Update } from './editor';
import { SelectField, TextField } from './fields';

type Acceptance = NonNullable<Risk['acceptance']>;

const today = (): string => new Date().toISOString().slice(0, 10);

export function AcceptanceEditor({ risk, update }: { readonly risk: Risk; readonly update: Update }) {
  const id = `accept-${risk.riskId}`;
  const acceptance = risk.acceptance;
  const set = (next: Acceptance | undefined): void => {
    update((current) => ({
      ...current,
      risks: current.risks.map((item) => (item.riskId === risk.riskId ? withValue(item, 'acceptance', next) : item)),
    }));
  };
  if (acceptance === undefined) {
    return (
      <button
        type="button"
        class="quiet"
        onClick={() => {
          set({
            kind: 'acceptance',
            acceptedBy: '',
            acceptedOn: today(),
            rationale: '',
          });
        }}
      >
        Record the acceptance of {risk.riskId}
      </button>
    );
  }
  return (
    <fieldset class="sub-editor">
      <legend>Acceptance of {risk.riskId}</legend>
      <div class="field-row">
        <div class="field">
          <SelectField
            id={`${id}-kind`}
            label="Kind"
            help="monitor.acceptance-kind"
            value={acceptance.kind}
            options={[
              ['acceptance', 'Acceptance of the risk'],
              ['tolerance-exception', 'Exception to a tolerance'],
            ]}
            onChange={(kind) => {
              set({ ...acceptance, kind: kind ?? 'acceptance' });
            }}
          />
        </div>
        <div class="field">
          <TextField
            id={`${id}-by`}
            label="Accepted by"
            help="monitor.acceptance-by"
            value={acceptance.acceptedBy}
            onChange={(acceptedBy) => {
              set({ ...acceptance, acceptedBy });
            }}
          />
        </div>
        <div class="field">
          <TextField
            id={`${id}-on`}
            label="Accepted on"
            help="monitor.acceptance-on"
            type="date"
            value={acceptance.acceptedOn}
            onChange={(acceptedOn) => {
              set({ ...acceptance, acceptedOn });
            }}
          />
        </div>
        <div class="field">
          <TextField
            id={`${id}-until`}
            label="Valid until"
            help="monitor.acceptance-until"
            type="date"
            value={acceptance.validUntil}
            onChange={(validUntil) => {
              set(withValue(acceptance, 'validUntil', validUntil));
            }}
          />
        </div>
      </div>
      <TextField
        id={`${id}-rationale`}
        label="Rationale"
        help="monitor.acceptance-rationale"
        value={acceptance.rationale}
        onChange={(rationale) => {
          set({ ...acceptance, rationale });
        }}
      />
      <button
        type="button"
        class="quiet"
        onClick={() => {
          set(undefined);
        }}
      >
        Remove the acceptance of {risk.riskId}
      </button>
    </fieldset>
  );
}
