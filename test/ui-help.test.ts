// Redesign phase 5. Each field with a visible label and each section has an explanation that
// opens on click. Titles and labels are plain words. The references live in the explanations.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HELP } from '../src/ui/help';

const UI = join(__dirname, '../src/ui');
const files = readdirSync(UI)
  .filter((name) => name.endsWith('.tsx'))
  .map((name) => ({ name, text: readFileSync(join(UI, name), 'utf8') }));

// The open tags of a JSX element, from "<Name" to the ">" outside braces and strings.
function openTags(text: string, name: string): string[] {
  const tags: string[] = [];
  const start = new RegExp(`<${name}\\b`, 'g');
  for (let match = start.exec(text); match !== null; match = start.exec(text)) {
    let depth = 0;
    let quote: string | undefined;
    let i = match.index + 1;
    for (; i < text.length; i++) {
      const c = text[i];
      if (quote !== undefined) {
        if (c === quote && text[i - 1] !== '\\') quote = undefined;
      } else if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    tags.push(text.slice(match.index, i + 1));
  }
  return tags;
}

const FIELDS = ['TextField', 'NumberField', 'SelectField', 'LinesField', 'Checkboxes', 'DistributionField', 'Section'];
const REFERENCE = /\b(Sec\.|Fig\.|Table \d|SP 800|IR 8286|ISO \d|App\. [A-Z])/;

describe('help on click', () => {
  it('each field with a visible label and each section has a help text', () => {
    const missing: string[] = [];
    for (const file of files) {
      for (const name of FIELDS) {
        for (const tag of openTags(file.text, name)) {
          if (/\bhiddenLabel\b/.test(tag) || /\bhelp=/.test(tag)) continue;
          const id = /\bid=(\{[^}]*\}|"[^"]*")/.exec(tag)?.[1] ?? /\blabel=(\{[^}]*\}|"[^"]*")/.exec(tag)?.[1] ?? '?';
          missing.push(`${file.name} <${name} ${id}>`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('each help text is used, and its key starts with its area', () => {
    const all = files.map((file) => file.text).join('\n');
    const unused = Object.keys(HELP).filter((key) => !all.includes(`'${key}'`) && !all.includes(`"${key}"`));
    expect(unused).toEqual([]);
    for (const key of Object.keys(HELP)) expect(key).toMatch(/^(common|start|context|identify|prioritize|respond|monitor|enterprise|guided)\./);
  });

  it('each help text is Simplified Technical English prose with no em dash, semicolon or colon', () => {
    for (const [key, text] of Object.entries(HELP)) {
      for (const part of [text.what, text.why, text.example, text.source]) {
        if (part === undefined) continue;
        expect(part, key).not.toMatch(/[—–;:]/);
        expect(part, key).toMatch(/[.?)]$/);
        expect(part.trim(), key).toBe(part);
      }
    }
  });
});

describe('plain titles', () => {
  it('titles, leads, labels and legends have no NIST section, figure or table number', () => {
    const found: string[] = [];
    const check = (file: string, text: string): void => {
      // The decision record numbers its own tables (Table 1 to Table 7). They are not NIST tables.
      if (file === 'record.tsx' && /^Table \d+$/.test(text)) return;
      if (REFERENCE.test(text)) found.push(`${file}: ${text}`);
    };
    for (const file of files) {
      for (const match of file.text.matchAll(/\b(?:title|lede|label|legend)="([^"]*)"/g)) check(file.name, match[1] ?? '');
      for (const match of file.text.matchAll(/\b(?:title|lede|label|legend)=\{`([^`]*)`\}/g)) check(file.name, match[1] ?? '');
      for (const match of file.text.matchAll(/<(h1|h2|h3|legend|summary)\b[^>]*>([^<{]*)/g)) check(file.name, match[2] ?? '');
    }
    expect(found).toEqual([]);
  });
});
