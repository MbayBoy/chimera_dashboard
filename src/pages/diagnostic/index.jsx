import React, { useState, useEffect } from 'react';

const DiagnosticPage = () => {
  const [supabaseStatus, setSupabaseStatus] = useState('checking');
  const [supabaseError, setSupabaseError] = useState(null);

  const envVars = [
    { key: 'VITE_SUPABASE_URL', value: import.meta.env?.VITE_SUPABASE_URL },
    { key: 'VITE_SUPABASE_ANON_KEY', value: import.meta.env?.VITE_SUPABASE_ANON_KEY },
    { key: 'MODE', value: import.meta.env?.MODE },
    { key: 'BASE_URL', value: import.meta.env?.BASE_URL },
  ];

  useEffect(() => {
    const checkSupabase = async () => {
      const url = import.meta.env?.VITE_SUPABASE_URL;
      const key = import.meta.env?.VITE_SUPABASE_ANON_KEY;

      if (!url || !key || url?.includes('placeholder') || key?.includes('placeholder')) {
        setSupabaseStatus('missing');
        setSupabaseError('Environment variables not set or using placeholder values');
        return;
      }

      try {
        const res = await fetch(`${url}/rest/v1/`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        });
        if (res?.ok || res?.status === 200 || res?.status === 404) {
          setSupabaseStatus('connected');
        } else {
          setSupabaseStatus('error');
          setSupabaseError(`HTTP ${res?.status}: ${res?.statusText}`);
        }
      } catch (err) {
        setSupabaseStatus('error');
        setSupabaseError(err?.message || String(err));
      }
    };
    checkSupabase();
  }, []);

  const statusColor = {
    checking: '#f59e0b',
    connected: '#10b981',
    error: '#ef4444',
    missing: '#ef4444',
  };

  const statusLabel = {
    checking: '⏳ Checking...',
    connected: '✅ Connected',
    error: '❌ Connection Error',
    missing: '❌ Missing / Not Configured',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'monospace', padding: '32px', color: '#f1f5f9' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', color: '#38bdf8' }}>
          🔍 Chimera Diagnostic Page
        </h1>
        <p style={{ color: '#64748b', marginBottom: '32px', fontSize: '13px' }}>
          Visit this page at <strong>/diagnostic</strong> to verify your deployment configuration.
        </p>

        {/* Environment Variables */}
        <section style={{ background: '#1e293b', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '16px' }}>Environment Variables</h2>
          {envVars?.map(({ key, value }) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #334155' }}>
              <span style={{ color: '#cbd5e1', fontSize: '13px' }}>{key}</span>
              <span style={{
                fontSize: '12px',
                padding: '2px 10px',
                borderRadius: '20px',
                background: value && !value?.includes('your-') && !value?.includes('placeholder') ? '#064e3b' : '#450a0a',
                color: value && !value?.includes('your-') && !value?.includes('placeholder') ? '#6ee7b7' : '#fca5a5',
              }}>
                {value
                  ? (value?.includes('your-') || value?.includes('placeholder')
                    ? '⚠️ Placeholder' :'✅ ' + (key?.includes('KEY') || key?.includes('URL') ? value?.substring(0, 20) + '...' : value))
                  : '❌ Not Set'}
              </span>
            </div>
          ))}
        </section>

        {/* Supabase Connection */}
        <section style={{ background: '#1e293b', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '16px' }}>Supabase Connection</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: statusColor?.[supabaseStatus] }} />
            <span style={{ color: statusColor?.[supabaseStatus], fontSize: '14px' }}>{statusLabel?.[supabaseStatus]}</span>
          </div>
          {supabaseError && (
            <pre style={{ marginTop: '12px', background: '#0f172a', padding: '10px', borderRadius: '6px', fontSize: '12px', color: '#fca5a5', whiteSpace: 'pre-wrap' }}>
              {supabaseError}
            </pre>
          )}
        </section>

        {/* Deployment Checklist */}
        <section style={{ background: '#1e293b', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '16px' }}>Hostinger Deployment Checklist</h2>
          {[
            'Upload ALL contents of the dist/ folder to public_html/ (not the folder itself)',
            'Ensure .htaccess file is present in public_html/',
            'Set VITE_SUPABASE_URL in Hostinger environment variables',
            'Set VITE_SUPABASE_ANON_KEY in Hostinger environment variables',
            'Rebuild the app after setting env vars: npm run build',
            'File permissions: 755 for folders, 644 for files',
            'Check browser console (F12) for JavaScript errors',
          ]?.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', padding: '6px 0', fontSize: '13px', color: '#cbd5e1' }}>
              <span style={{ color: '#38bdf8' }}>{i + 1}.</span>
              <span>{item}</span>
            </div>
          ))}
        </section>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <a href="/" style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '14px' }}>← Back to App</a>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticPage;
