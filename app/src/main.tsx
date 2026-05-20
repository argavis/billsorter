import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './lib/i18n';
import iconUrl from './assets/logo-icon.png';

// Global error capture — Fehler beim Mount sichtbar machen.
window.addEventListener('error', (e) => {
  console.error('[window.onerror]', e.message, e.filename, e.lineno, e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[unhandledrejection]', e.reason);
});

// Favicon dynamisch setzen — Errors swallowen, soll nie den App-Mount blockieren.
try {
  const link =
    document.querySelector<HTMLLinkElement>("link[rel*='icon']") ?? document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = iconUrl;
  if (!link.parentNode) document.head.appendChild(link);
} catch (e) {
  console.warn('favicon setup failed', e);
}

class RootBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[RootBoundary]', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>Render-Fehler</h1>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#dc2626' }}>
            {String(this.state.error.message ?? this.state.error)}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootBoundary>
      <App />
    </RootBoundary>
  </React.StrictMode>,
);
