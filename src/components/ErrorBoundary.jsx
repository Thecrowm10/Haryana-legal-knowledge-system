import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error caught by ErrorBoundary:', error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface-ground, #f4f6fa)', fontFamily: 'var(--font, system-ui, sans-serif)', padding: 24,
      }}>
        <div style={{
          maxWidth: 420, width: '100%', textAlign: 'center', background: 'var(--surface-card, #fff)',
          borderRadius: 14, padding: '32px 28px', boxShadow: '0 24px 80px rgba(0,0,0,.12)',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: 'rgba(220,53,69,.1)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <AlertTriangle size={22} color="#dc3545" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-heading, #1a1a1a)', marginBottom: 8 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-color-secondary, #666)', lineHeight: 1.6, marginBottom: 22 }}>
            This page ran into an unexpected error while rendering. Reloading usually fixes it — your work elsewhere in the app is unaffected.
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8,
              border: 'none', background: 'var(--primary, #214aab)', color: '#fff', fontSize: 13.5, fontWeight: 600,
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} /> Reload page
          </button>
        </div>
      </div>
    );
  }
}
