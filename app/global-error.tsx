'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('2BF Global Root Exception:', error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Application Error — Two Brothers Food Complex</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          backgroundColor: '#090d16',
          color: '#f1f5f9',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '560px',
            width: '90%',
            padding: '2.5rem',
            backgroundColor: '#111827',
            borderRadius: '16px',
            border: '1px solid #1f2937',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            textAlign: 'center',
          }}
        >
          {/* Logo / Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              marginBottom: '1.25rem',
              color: '#ef4444',
              fontSize: '28px',
              fontWeight: 'bold',
            }}
          >
            ⚠️
          </div>

          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#f59e0b',
              marginBottom: '0.5rem',
            }}
          >
            Two Brothers Food Complex • System Failsafe
          </div>

          <h1
            style={{
              fontSize: '24px',
              fontWeight: 800,
              margin: '0 0 0.75rem 0',
              color: '#ffffff',
            }}
          >
            Application Crash Detected
          </h1>

          <p
            style={{
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#94a3b8',
              margin: '0 0 1.75rem 0',
            }}
          >
            A fatal error occurred at the root application layer. All factory database records are secured. Please reload the application to restore operations.
          </p>

          {error.digest && (
            <div
              style={{
                display: 'inline-block',
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#64748b',
                backgroundColor: '#0b0f19',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #1e293b',
                marginBottom: '1.75rem',
              }}
            >
              Digest Reference: {error.digest}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
            >
              Attempt Recovery
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/dashboard';
                }
              }}
              style={{
                backgroundColor: 'transparent',
                color: '#cbd5e1',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.borderColor = '#64748b')}
              onMouseOut={(e) => (e.currentTarget.style.borderColor = '#334155')}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
