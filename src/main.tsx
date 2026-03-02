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

// Register immediately so installed PWAs become SW-controlled reliably.
registerServiceWorker();
