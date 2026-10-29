// Parts shared by S4, S5 and the decision record. The loss exceedance chart has a table
// equivalent, and a status is a word next to a coloured dot, so colour is never the only
// signal (WCAG 2.2 criterion 1.4.1, SPEC.md Sec. 4.1 item 2).
import { toleranceAt, type TolerancePoint } from '../engine/metrics';
import type { ToleranceStatus } from '../engine/decision';

export const money = (value: number): string => Math.round(value).toLocaleString('en');
export const percent = (p: number, digits = 1): string => `${(p * 100).toFixed(digits)}%`;
export const probability = (p: number): string => (p === 0 ? '0' : p < 0.001 ? p.toExponential(1) : p.toFixed(4));
const compact = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumSignificantDigits: 3,
});
export const short = (value: number): string => compact.format(value);

export const STATUS_TEXT: Readonly<Record<ToleranceStatus, string>> = {
  within: 'Within tolerance',
  breach: 'Breach',
  clear: 'Clear breach',
};

export function StatusText({ status }: { readonly status: ToleranceStatus | undefined }) {
  if (status === undefined) return <span class="status">No tolerance curve</span>;
  return (
    <span class={`status status-${status}`}>
      <span class="dot" aria-hidden="true" />
      {STATUS_TEXT[status]}
    </span>
  );
}

export interface Series {
  readonly name: string;
  readonly points: readonly {
    readonly loss: number;
    readonly probability: number;
  }[];
}

const WIDTH = 640;
const HEIGHT = 340;
const LEFT = 58;
const RIGHT = 14;
const TOP = 12;
const BOTTOM = 42;
const P_MIN = 1e-3;
// Line styles differ in dash pattern as well as colour.
const DASHES = ['', '8 4', '2 3', '10 3 2 3', '4 4'];

// A loss exceedance curve on log axes, with the tolerance curve and the capacity (Sec. 8.8, 8.9).
export function LecChart({
  id,
  number,
  title,
  series,
  points,
  capacity,
  currency,
  source,
}: {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly series: readonly Series[];
  readonly points: readonly TolerancePoint[];
  readonly capacity: number | undefined;
  readonly currency: string;
  readonly source: string;
}) {
  const grid = series[0]?.points ?? [];
  const xMin = grid[0]?.loss ?? 1;
  const xMax = grid.at(-1)?.loss ?? 10;
  const lx = (x: number): number => LEFT + ((Math.log10(x) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin) || 1)) * (WIDTH - LEFT - RIGHT);
  const ly = (p: number): number => TOP + ((0 - Math.log10(Math.max(p, P_MIN))) / -Math.log10(P_MIN)) * (HEIGHT - TOP - BOTTOM);
  const path = (values: readonly { loss: number; probability: number }[]): string => {
    let d = '';
    let pen = false;
    for (const value of values) {
      if (value.probability < P_MIN) {
        if (pen) d += `L${lx(value.loss).toFixed(1)},${ly(P_MIN).toFixed(1)}`;
        break;
      }
      d += `${pen ? 'L' : 'M'}${lx(value.loss).toFixed(1)},${ly(value.probability).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const tolerance =
    points.length === 0
      ? []
      : grid
          .filter((value) => value.loss >= Math.min(...points.map((point) => point.loss)))
          .map((value) => ({
            loss: value.loss,
            probability: toleranceAt(points, value.loss),
          }));
  const decades: number[] = [];
  for (let e = Math.ceil(Math.log10(xMin)); e <= Math.floor(Math.log10(xMax)); e++) decades.push(10 ** e);
  const rows = grid.filter((_, i) => i % 20 === 0 || i === grid.length - 1);
  const titleId = `${id}-title`;
  return (
    <figure class="chart" aria-labelledby={titleId}>
      <figcaption id={titleId}>
        <strong>Figure {number}.</strong> {title}
      </figcaption>
      <svg viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`} role="img" aria-labelledby={titleId} aria-describedby={`${id}-desc`} class="lec">
        <desc id={`${id}-desc`}>Probability that the annual loss is above a value, on log scales. The table below the chart gives the same values.</desc>
        {[1, 0.1, 0.01, 0.001].map((p) => (
          <g key={p}>
            <line class="lec-grid" x1={LEFT} x2={WIDTH - RIGHT} y1={ly(p)} y2={ly(p)} />
            <text class="lec-label" x={LEFT - 6} y={ly(p) + 4} text-anchor="end">
              {p}
            </text>
          </g>
        ))}
        {decades.map((x) => (
          <g key={x}>
            <line class="lec-grid" x1={lx(x)} x2={lx(x)} y1={TOP} y2={HEIGHT - BOTTOM} />
            <text class="lec-label" x={lx(x)} y={HEIGHT - BOTTOM + 16} text-anchor="middle">
              {short(x)}
            </text>
          </g>
        ))}
        <text class="lec-label" x={(LEFT + WIDTH - RIGHT) / 2} y={HEIGHT - 6} text-anchor="middle">
          Annual loss ({currency})
        </text>
        {capacity !== undefined && capacity >= xMin && capacity <= xMax && (
          <g>
            <line class="lec-capacity" x1={lx(capacity)} x2={lx(capacity)} y1={TOP} y2={HEIGHT - BOTTOM} />
            <text class="lec-label" x={lx(capacity) - 4} y={TOP + 12} text-anchor="end">
              Capacity
            </text>
          </g>
        )}
        {tolerance.length > 0 && <path class="lec-tolerance" d={path(tolerance)} />}
        {series.map((item, i) => (
          <path key={item.name} class={`lec-line lec-s${String(i % DASHES.length)}`} stroke-dasharray={DASHES[i % DASHES.length] || undefined} d={path(item.points)} />
        ))}
      </svg>
      <ul class="legend">
        {series.map((item, i) => (
          <li key={item.name}>
            <svg viewBox="0 0 28 8" class="swatch" aria-hidden="true">
              <line class={`lec-line lec-s${String(i % DASHES.length)}`} x1="0" x2="28" y1="4" y2="4" stroke-dasharray={DASHES[i % DASHES.length] || undefined} />
            </svg>
            {item.name}
          </li>
        ))}
        {tolerance.length > 0 && (
          <li>
            <svg viewBox="0 0 28 8" class="swatch" aria-hidden="true">
              <line class="lec-tolerance" x1="0" x2="28" y1="4" y2="4" />
            </svg>
            Tolerance curve
          </li>
        )}
      </ul>
      <details class="chart-table">
        <summary>Table of Figure {number}</summary>
        <div class="table-box" tabIndex={0} role="region" aria-label={`Values of Figure ${String(number)}`}>
          <table>
            <thead>
              <tr>
                <th scope="col">Annual loss above ({currency})</th>
                {series.map((item) => (
                  <th scope="col" key={item.name}>
                    {item.name}
                  </th>
                ))}
                {points.length > 0 && <th scope="col">Tolerance</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.loss}>
                  <th scope="row">{money(row.loss)}</th>
                  {series.map((item) => (
                    <td key={item.name}>{probability(item.points[grid.indexOf(row)]?.probability ?? 0)}</td>
                  ))}
                  {points.length > 0 && <td>{probability(toleranceAt(points, row.loss))}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p class="source">Source. {source}</p>
    </figure>
  );
}

export const sourceLine = (numbers: { readonly hash: string; readonly seed: number; readonly trials: number; readonly engineVersion: string }): string =>
  `Simulation of document ${numbers.hash.slice(0, 12)}, seed ${String(numbers.seed)}, ${numbers.trials.toLocaleString('en')} trials, engine ${numbers.engineVersion}.`;
