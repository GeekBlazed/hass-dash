import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'reflect-metadata';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './pwa/registerServiceWorker';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Keep service-worker registration off the critical rendering path.
const windowRef = window as Window;

if (typeof windowRef.requestIdleCallback === 'function') {
  windowRef.requestIdleCallback(() => registerServiceWorker(), { timeout: 2000 });
} else {
  setTimeout(() => registerServiceWorker(), 0);
}
