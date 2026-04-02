import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./styles/tailwind.css";
import "./styles/index.css";

// ── Startup: log environment variable status ──────────────────────────────────
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

console.log('[Chimera] App starting...');
console.log('[Chimera] VITE_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ MISSING');
console.log('[Chimera] VITE_SUPABASE_ANON_KEY:', supabaseKey ? '✅ Set' : '❌ MISSING');
console.log('[Chimera] Build mode:', import.meta.env?.MODE);
console.log('[Chimera] Base URL:', import.meta.env?.BASE_URL);

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[Chimera] ⚠️  Supabase environment variables are missing!\n' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your Hostinger environment.\n'+ 'The app will load but database features will not work.'
  );
}

// ── Mount React app ───────────────────────────────────────────────────────────
try {
  const container = document.getElementById('root');
  if (!container) {
    throw new Error('Root element #root not found in index.html');
  }
  const root = createRoot(container);
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
  console.log('[Chimera] ✅ React app mounted successfully');
} catch (err) {
  console.error('[Chimera] ❌ Fatal error mounting React app:', err);
  // Fallback: show a visible error in the page if React fails to mount
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;font-family:sans-serif;padding:20px">
        <div style="background:#1e293b;border:1px solid #ef4444;border-radius:12px;padding:32px;max-width:560px;width:100%;color:#f1f5f9">
          <h1 style="color:#ef4444;font-size:22px;margin:0 0 12px">⚠️ Application Failed to Start</h1>
          <p style="color:#94a3b8;margin:0 0 16px">The app encountered a critical error during initialization.</p>
          <pre style="background:#0f172a;padding:12px;border-radius:8px;font-size:12px;color:#fca5a5;overflow:auto;white-space:pre-wrap">${err?.message || String(err)}</pre>
          <p style="color:#64748b;font-size:13px;margin:16px 0 0">Open browser DevTools (F12) → Console tab for full error details.</p>
        </div>
      </div>
    `;
  }
}
