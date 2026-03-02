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

// Defer SW registration slightly to keep it off the initial render critical path
// while still registering early for PWA reliability.
setTimeout(() => {
  registerServiceWorker();
}, 0);
