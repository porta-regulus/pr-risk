// The notice of a new version (CRA Annex I Part I point 2(c), docs/release/annex-i-self-check.md,
// gap F5). The app makes no request for it. The browser's own service worker update check finds a
// new version, and the version of the last start is kept in local storage (ADR-0004 T3).

export const SEEN_VERSION_KEY = 'pr-risk.seenVersion';
const RELEASES_URL = 'https://github.com/porta-regulus/pr-risk/releases';

// The release tags are v plus the package version, for example v1.0.0.
export const releaseUrl = (version: string): string => `${RELEASES_URL}/tag/v${encodeURIComponent(version)}`;

type VersionStorage = Pick<Storage, 'getItem' | 'setItem'>;

// True when this start runs another version than the last start. A first start has no stored
// version and shows no notice, because nothing changed for the user.
export function versionChanged(seen: string | null, current: string): boolean {
  return seen !== null && seen !== current;
}

// localStorage throws when the browser blocks storage. The notice then never shows.
function browserStorage(): VersionStorage | undefined {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

// Reads the version of the last start. A first start records this version at once. A changed
// version stays unrecorded until the user closes the notice, so the notice shows again on the
// next start.
export function checkVersion(current: string, storage = browserStorage()): boolean {
  try {
    const seen = storage?.getItem(SEEN_VERSION_KEY) ?? null;
    if (seen === null) storage?.setItem(SEEN_VERSION_KEY, current);
    return versionChanged(seen, current);
  } catch {
    return false;
  }
}

export function recordVersion(current: string, storage = browserStorage()): void {
  try {
    storage?.setItem(SEEN_VERSION_KEY, current);
  } catch {
    // Storage can be blocked. The notice then shows again on the next start.
  }
}

export interface NoticeState {
  // This start runs another version than the last start.
  readonly changed: boolean;
  // A new version is installed and waits for the next start.
  readonly ready: boolean;
  // The user asked for the new version, and the page reloads soon. S1 then offers no action,
  // so no draft can start before the reload (ADR-0004 T3).
  readonly activating?: boolean;
}

// One state for S1 and the editor frame, so a notice closed on one screen stays closed on the next.
let state: NoticeState = { changed: false, ready: false };
const listeners = new Set<(next: NoticeState) => void>();

export const noticeState = (): NoticeState => state;

export function setNoticeState(change: Partial<NoticeState>): void {
  state = { ...state, ...change };
  for (const listener of listeners) listener(state);
}

export function onNoticeState(listener: (next: NoticeState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
