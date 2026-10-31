// The incoming version of a matched risk from a file that states only some fields (SPEC.md
// Sec. 9.7). A CSV, XLSX or NIST IR 8286 file holds fewer fields than a risk in the app. Each
// field that the file states comes from the file. Each other field keeps its current value, so
// take incoming and keep both never remove data that the file cannot hold.
import type { Risk } from '../schema/types';

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => value !== null && typeof value === 'object' && !Array.isArray(value);

const pathOf = (pointer: string): string[] => pointer.split('/').slice(1);

// The value at a JSON Pointer, or undefined.
export function valueAt(root: unknown, pointer: string): unknown {
  let node = root;
  for (const key of pathOf(pointer)) {
    if (!isObject(node)) return undefined;
    node = node[key];
  }
  return node;
}

// Set the value at a path, or remove it when the value is undefined. An object that becomes
// empty is removed too.
function setAt(root: Json, path: readonly string[], value: unknown): void {
  const [key, ...rest] = path;
  if (key === undefined) return;
  if (rest.length === 0) {
    if (value === undefined) Reflect.deleteProperty(root, key);
    else root[key] = structuredClone(value);
    return;
  }
  const child = isObject(root[key]) ? root[key] : {};
  setAt(child, rest, value);
  if (Object.keys(child).length === 0) Reflect.deleteProperty(root, key);
  else root[key] = child;
}

const LABELS = [
  ['riskLikelihood', 'riskLikelihoodLabel'],
  ['riskImpact', 'riskImpactLabel'],
  ['exposureRating', 'exposureRatingLabel'],
] as const;

export function statedVersion(current: Risk, incoming: Risk, stated: readonly string[]): Risk {
  const result = structuredClone(current) as unknown as Json;
  for (const pointer of stated) setAt(result, pathOf(pointer), valueAt(incoming, pointer));
  const taken = new Set(stated);
  // A label that the file does not state stays only while its number stays.
  const before = current as unknown as Json;
  for (const [number, label] of LABELS) {
    if (!taken.has(`/${label}`) && result[number] !== before[number]) Reflect.deleteProperty(result, label);
  }
  // A field is defaulted when its value is an importer default. Stated fields take that mark
  // from the file, the other fields keep it.
  const incomingDefaults = new Set(incoming.defaultedFields ?? []);
  const kept = (current.defaultedFields ?? []).filter((pointer) => !taken.has(pointer) || incomingDefaults.has(pointer));
  const added = [...incomingDefaults].filter((pointer) => taken.has(pointer) && !kept.includes(pointer));
  const defaulted = [...kept, ...added];
  if (defaulted.length > 0 || current.defaultedFields?.length === 0) result['defaultedFields'] = defaulted;
  else delete result['defaultedFields'];
  return result as unknown as Risk;
}
