import { render } from 'preact';
import { App } from './app';
import { registerServiceWorker } from './service-worker';
import './styles.css';

const root = document.getElementById('app');
if (root) render(<App />, root);
registerServiceWorker();
