// File save and new-document helpers for the screens.
import type { RiskDocument } from '../schema/types';

// Saves text as a file through a temporary blob link. The app sends nothing over the network.
export function downloadText(fileName: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'risk-register'
  );
}

// SPEC.md Sec. 6.1 item 1. A new document starts with one organization register. It is
// qualitative, so imported rows without estimates are valid (rule V-08). A register can move
// to quantitative risk by risk (Sec. 6.8 item 1).
export function newDocument(title: string, organization: string, currency: string, now = new Date()): RiskDocument {
  const iso = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return {
    schemaVersion: '1.0.0',
    document: {
      id: `doc-${crypto.randomUUID()}`,
      title,
      ...(organization === '' ? {} : { organization }),
      currency,
      createdOn: iso,
      tool: { name: 'PortaRegulus Risk', version: __APP_VERSION__ },
    },
    registers: [{ id: 'ORG', title: organization === '' ? 'Organization register' : `${organization} register`, level: 'organization', timeframeMonths: 12, asOf: iso.slice(0, 10), method: 'qualitative' }],
    risks: [],
  };
}
