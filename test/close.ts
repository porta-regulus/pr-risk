// Compare two JSON-like values with a relative tolerance on numbers.
export function differences(actual: unknown, expected: unknown, tolerance: number, path = ''): string[] {
  if (typeof expected === 'number' && typeof actual === 'number') {
    const scale = Math.max(Math.abs(expected), Math.abs(actual), 1e-300);
    return Math.abs(actual - expected) / scale <= tolerance || actual === expected ? [] : [`${path}: ${String(actual)} against ${String(expected)}`];
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (actual.length !== expected.length) return [`${path}: length ${String(actual.length)} against ${String(expected.length)}`];
    return expected.flatMap((item, i) => differences(actual[i], item, tolerance, `${path}[${String(i)}]`));
  }
  if (expected !== null && typeof expected === 'object' && actual !== null && typeof actual === 'object') {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    return [...keys].flatMap((key) =>
      differences((actual as Record<string, unknown>)[key], (expected as Record<string, unknown>)[key], tolerance, `${path}.${key}`),
    );
  }
  return actual === expected ? [] : [`${path}: ${JSON.stringify(actual)} against ${JSON.stringify(expected)}`];
}
