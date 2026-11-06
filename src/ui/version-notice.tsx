// The notice of a new version on S1 and in the editor frame (gap F5). See ./version.ts.
import { useEffect, useState } from 'preact/hooks';
import { activateNewVersion, type ActivateResult } from '../service-worker';
import { noticeState, onNoticeState, recordVersion, releaseUrl, setNoticeState } from './version';

const RESULT_TEXT: Readonly<Record<Exclude<ActivateResult, 'activated'>, string>> = {
  'other-tabs': 'Another tab of the app is open. Close the other tabs of the app, then click again.',
  'no-update': 'This version cannot change now. Close all tabs of the app and open it again.',
};

// startScreen. Only S1 offers "Use the new version now", because S1 holds no unsaved draft and
// the page reloads (ADR-0004 T3).
export function VersionNotice({ startScreen = false }: { readonly startScreen?: boolean }) {
  const [state, setState] = useState(noticeState);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>();
  // The effect runs after the first render. Read the state again, because the service worker
  // can report an update between the render and the subscription.
  useEffect(() => {
    const stop = onNoticeState(setState);
    setState(noticeState());
    return stop;
  }, []);
  return (
    <>
      {state.changed && (
        <div class="message message-ok notice" role="status">
          <p>
            Version {__APP_VERSION__} is now active. See the{' '}
            <a href={releaseUrl(__APP_VERSION__)} target="_blank" rel="noopener noreferrer">
              release notes on GitHub
            </a>
            .
          </p>
          <button type="button" class="quiet" onClick={() => {
              recordVersion(__APP_VERSION__);
              setNoticeState({ changed: false });
            }}>
            Close notice
          </button>
        </div>
      )}
      {state.ready && (
        <div class="message message-ok notice" role="status">
          <p>
            A new version of the app is ready.{' '}
            {startScreen
              ? 'Click "Use the new version now", or close all tabs of the app and open it again.'
              : 'Go to the start screen and click "Use the new version now", or close all tabs of the app and open it again.'}{' '}
            Until then, this version stays active.
          </p>
          {result !== undefined && <p>{result}</p>}
          <div class="button-row">
            {startScreen && (
              <button type="button" disabled={busy} onClick={() => {
                  setBusy(true);
                  setResult(undefined);
                  setNoticeState({ activating: true });
                  void activateNewVersion().then((outcome) => {
                    if (outcome !== 'activated') {
                      setBusy(false);
                      setResult(RESULT_TEXT[outcome]);
                      setNoticeState({ activating: false });
                    }
                  });
                }}>
                Use the new version now
              </button>
            )}
            <button type="button" class="quiet" onClick={() => {
                setNoticeState({ ready: false });
              }}>
              Close notice
            </button>
          </div>
        </div>
      )}
    </>
  );
}
