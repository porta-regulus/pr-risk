// The notice of a new version on S1 and in the editor frame (gap F5). See ./version.ts.
import { useEffect, useState } from 'preact/hooks';
import { noticeState, onNoticeState, recordVersion, releaseUrl, setNoticeState } from './version';

export function VersionNotice() {
  const [state, setState] = useState(noticeState);
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
          <p>A new version of the app is ready. It becomes active when you close all tabs of the app and open it again. Until then, this version stays active.</p>
          <button type="button" class="quiet" onClick={() => {
              setNoticeState({ ready: false });
            }}>
            Close notice
          </button>
        </div>
      )}
    </>
  );
}
