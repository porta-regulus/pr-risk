import { render } from 'preact';
import { App } from './app';
import { registerServiceWorker } from './service-worker';
import { checkVersion, setNoticeState } from './ui/version';
import '@fontsource-variable/public-sans/wght.css';
import './styles.css';

// Gap F5. The notice of a new version shows on S1 and in the editor frame.
setNoticeState({ changed: checkVersion(__APP_VERSION__) });
const root = document.getElementById('app');
if (root) render(<App />, root);
registerServiceWorker(() => {
  setNoticeState({ ready: true });
});
