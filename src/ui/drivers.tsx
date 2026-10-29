// Shared drivers (SPEC.md Sec. 8.7). A driver is a shared cause, such as a supplier outage,
// that can cause events of several risks. The panel lists the drivers of the document, and
// the risk tab links a risk to drivers with a trigger probability.
import type { Risk, RiskDocument } from '../schema/types';
import { DistributionField } from './distribution';
import { nextId, withValue } from './edit';
import type { Update } from './editor';
import { NumberField, SelectField, TextField } from './fields';

type Driver = NonNullable<RiskDocument['drivers']>[number];
type DriverLink = NonNullable<Risk['driverLinks']>[number];

const KINDS: readonly (readonly [Driver['kind'], string])[] = [
  ['supplier', 'Supplier'],
  ['control', 'Control failure'],
  ['asset', 'Asset'],
  ['threat', 'Threat'],
  ['other', 'Other'],
];

const replaceAt = <T,>(items: readonly T[], index: number, item: T | undefined): T[] =>
  item === undefined ? items.filter((_, i) => i !== index) : items.map((old, i) => (i === index ? item : old));

const linksTo = (doc: RiskDocument, id: string): string[] => doc.risks.filter((risk) => (risk.driverLinks ?? []).some((link) => link.driverId === id)).map((risk) => risk.riskId);

export function DriverPanel({ doc, update }: { readonly doc: RiskDocument; readonly update: Update }) {
  const drivers = doc.drivers ?? [];
  const setDriver = (index: number, driver: Driver | undefined): void => {
    update((current) => withValue(current, 'drivers', replaceAt(current.drivers ?? [], index, driver)));
  };
  return (
    <section aria-labelledby="drivers-title" class="panel">
      <h2 id="drivers-title">Drivers</h2>
      <p class="muted">A driver is a shared cause of several risks, for example an outage of one supplier. Its events reach each linked risk with a trigger probability, so joint losses show in the simulation without a double count (Sec. 8.7).</p>
      {drivers.map((driver, i) => {
        const risks = linksTo(doc, driver.id);
        const targeted = (doc.responses ?? []).some((option) => option.effects.some((effect) => effect.targetKind === 'driver' && effect.targetId === driver.id));
        const id = `driver-${String(i)}`;
        return (
          <details class="editor" key={i}>
            <summary>
              {driver.id} {driver.name || 'New driver'}, linked to {risks.length} risks
            </summary>
            {risks.length < 2 && <p class="banner">A driver with fewer than 2 links adds nothing that a risk cannot hold itself (lint L-06).</p>}
            <div class="field-row">
              <div class="field">
                {risks.length > 0 || targeted ? (
                  <p>
                    <strong>ID</strong> {driver.id}
                  </p>
                ) : (
                  <TextField id={`${id}-id`} label="ID" value={driver.id} onChange={(value) => {
                      setDriver(i, { ...driver, id: value });
                    }} />
                )}
              </div>
              <div class="field wide">
                <TextField id={`${id}-name`} label="Name" value={driver.name} onChange={(name) => {
                    setDriver(i, { ...driver, name });
                  }} />
              </div>
              <div class="field">
                <SelectField id={`${id}-kind`} label="Kind" value={driver.kind} options={KINDS} onChange={(kind) => {
                    setDriver(i, { ...driver, kind: kind ?? 'other' });
                  }} />
              </div>
            </div>
            <TextField id={`${id}-description`} label="Description" multiline value={driver.description} onChange={(description) => {
                setDriver(i, withValue(driver, 'description', description));
              }} />
            <DistributionField
              id={`${id}-frequency`}
              legend="Driver frequency"
              question="How many driver events happen per year? For a control, one event is one failure of the control. Give a range you are 90% sure of."
              unit="events per year"
              frequency
              value={driver.frequency}
              onChange={(frequency) => {
                setDriver(i, { ...driver, frequency });
              }}
            />
            <TextField id={`${id}-rationale`} label="Rationale (10 characters or more)" multiline value={driver.rationale} onChange={(rationale) => {
                setDriver(i, { ...driver, rationale });
              }} />
            <button type="button" class="quiet" disabled={risks.length > 0 || targeted} onClick={() => {
                setDriver(i, undefined);
              }}>
              Remove driver {driver.id}
            </button>
            {(risks.length > 0 || targeted) && <span class="hint">Linked risks or response effects use this driver, so it cannot be removed.</span>}
          </details>
        );
      })}
      <button type="button" class="quiet" onClick={() => {
          update((current) =>
            withValue(current, 'drivers', [
              ...(current.drivers ?? []),
              // The form only. The frequency comes from the user.
              { id: nextId('D-', (current.drivers ?? []).map((item) => item.id)), kind: 'other', name: '', frequency: { type: 'lognormal', confidence: 0.9 }, rationale: '' },
            ]),
          );
        }}>
        Add a driver
      </button>
    </section>
  );
}

export function DriverLinksTab({ doc, risk, setRisk }: { readonly doc: RiskDocument; readonly risk: Risk; readonly setRisk: (change: (risk: Risk) => Risk) => void }) {
  const drivers = doc.drivers ?? [];
  const links = risk.driverLinks ?? [];
  const id = `risk-${risk.riskId}-drivers`;
  const setLinks = (next: DriverLink[]): void => {
    setRisk((current) => withValue(current, 'driverLinks', next));
  };
  if (drivers.length === 0) return <p class="muted tab-body">No driver yet. Add one in the panel Drivers on this screen.</p>;
  const free = drivers.filter((driver) => !links.some((link) => link.driverId === driver.id));
  return (
    <div class="tab-body">
      <p class="hint">The frequency on the tab Estimate counts only the events that the drivers do not cause (Sec. 8.3). A trigger probability is the chance that one driver event causes one event of this risk.</p>
      {links.map((link, i) => (
        <div class="sub-editor" key={i}>
          <div class="field-row">
            <div class="field">
              <SelectField
                id={`${id}-${String(i)}-driver`}
                label={`Driver of link ${String(i + 1)}`}
                value={link.driverId}
                options={drivers.filter((driver) => driver.id === link.driverId || !links.some((other) => other.driverId === driver.id)).map((driver) => [driver.id, `${driver.id} ${driver.name}`] as const)}
                onChange={(driverId) => {
                  setLinks(replaceAt(links, i, { ...link, driverId: driverId ?? link.driverId }));
                }}
              />
            </div>
            <div class="field">
              <NumberField id={`${id}-${String(i)}-q`} label="Trigger probability (0 to 1)" min={0} max={1} value={link.triggerProbability} onChange={(q) => {
                  setLinks(replaceAt(links, i, withValue(link, 'triggerProbability', q)));
                }} />
            </div>
          </div>
          <TextField id={`${id}-${String(i)}-rationale`} label="Rationale of the link" value={link.rationale} onChange={(rationale) => {
              setLinks(replaceAt(links, i, withValue(link, 'rationale', rationale)));
            }} />
          <button type="button" class="quiet" onClick={() => {
              setLinks(replaceAt(links, i, undefined));
            }}>
            Remove link {i + 1}
          </button>
        </div>
      ))}
      <button type="button" class="quiet" disabled={free.length === 0} onClick={() => {
          const driver = free[0];
          // The trigger probability comes from the user, so the new link has none yet.
          if (driver !== undefined) setLinks([...links, { driverId: driver.id } as DriverLink]);
        }}>
        Link a driver
      </button>
    </div>
  );
}
