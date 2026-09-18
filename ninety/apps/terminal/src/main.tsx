import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles/terminal.css';

/**
 * Entry point.
 *
 * The service worker is registered for installability and offline viewing. It is
 * deliberately not a caching layer for request data: a yard looking at a cached
 * list of jobs that closed ten minutes ago is worse than a yard looking at an
 * empty screen, because they would quote on work that no longer exists.
 */
const root = document.getElementById('root');
if (root !== null) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Installability is a convenience. The terminal works without it.
    });
  });
}
