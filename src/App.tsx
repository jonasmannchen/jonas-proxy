import { useState, useEffect, useCallback, useRef } from 'react';

// Configuration
const WORKER_BASE_URL = import.meta.env.VITE_WORKER_BASE_URL || 'https://jonas-proxy-worker.example.workers.dev';

type ConnectionStatus = 'checking' | 'connected' | 'disconnected' | 'error';

interface ProxyResult {
  title: string;
  url: string;
  contentType: string;
  content: string;
  headers: Record<string, string>;
  statusCode: number;
}

function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProxyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Check backend health on mount
  const checkHealth = useCallback(async () => {
    setStatus('checking');
    try {
      const response = await fetch(`${WORKER_BASE_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok') {
          setStatus('connected');
        } else {
          setStatus('error');
        }
      } else {
        setStatus('disconnected');
      }
    } catch {
      setStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // Validate and normalize URL
  const normalizeUrl = (input: string): string | null => {
    let normalized = input.trim();
    if (!normalized) return null;

    // Add protocol if missing
    if (!normalized.match(/^https?:\/\//i)) {
      normalized = 'https://' + normalized;
    }

    try {
      const parsed = new URL(normalized);
      // Only allow HTTPS
      if (parsed.protocol !== 'https:') {
        setError('Nur HTTPS-Verbindungen sind erlaubt.');
        return null;
      }
      return parsed.href;
    } catch {
      setError('Ungültige URL. Bitte überprüfen Sie die Eingabe.');
      return null;
    }
  };

  // Fetch URL through proxy
  const fetchProxy = async (targetUrl: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${WORKER_BASE_URL}/proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const errorMsg = data?.error || getErrorMessage(response.status);
        setError(errorMsg);
        setLoading(false);
        return;
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Zeitüberschreitung. Die Website antwortet nicht.');
      } else {
        setError('Backend nicht erreichbar. Bitte versuchen Sie es später erneut.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (code: number): string => {
    switch (code) {
      case 400: return 'Ungültige Anfrage. Bitte überprüfen Sie die URL.';
      case 403: return 'Domain nicht freigegeben. Diese Website ist nicht in der Allowlist.';
      case 404: return 'Website nicht gefunden.';
      case 408: return 'Zeitüberschreitung. Die Website antwortet nicht.';
      case 415: return 'Website unterstützt die angeforderte Darstellung nicht.';
      case 502: return 'Die Website ist nicht erreichbar.';
      default: return 'Ein unerwarteter Fehler ist aufgetreten.';
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    const normalized = normalizeUrl(url);
    if (normalized) {
      fetchProxy(normalized);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'var(--success)';
      case 'checking': return 'var(--accent)';
      case 'disconnected': return 'var(--error)';
      case 'error': return 'var(--error)';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected': return 'Verbunden';
      case 'checking': return 'Verbindung wird hergestellt...';
      case 'disconnected': return 'Nicht erreichbar';
      case 'error': return 'Fehler';
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <header
        className="border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor: '#2a2a2a', backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            JP
          </div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Jonas-Proxy
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: getStatusColor() }}
          />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {getStatusText()}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          {/* Title Section */}
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              Sicherer Web-Proxy
            </h2>
            <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
              Greifen Sie auf freigegebene Websites über einen sicheren Proxy zu.
            </p>
          </div>

          {/* URL Input */}
          <form onSubmit={handleSubmit} className="mb-6">
            <div
              className="flex items-center rounded-xl border overflow-hidden"
              style={{
                borderColor: '#2a2a2a',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              <div className="pl-4 pr-2" style={{ color: 'var(--text-secondary)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(null); }}
                onKeyDown={handleKeyDown}
                placeholder="Website-Adresse eingeben ..."
                className="flex-1 py-4 px-2 bg-transparent outline-none text-base"
                style={{ color: 'var(--text-primary)' }}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="px-6 py-4 font-medium text-sm transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: '#fff',
                }}
                onMouseEnter={(e) => {
                  if (!loading && url.trim()) {
                    (e.target as HTMLElement).style.backgroundColor = 'var(--accent-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = 'var(--accent)';
                }}
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : 'Öffnen'}
              </button>
            </div>
          </form>

          {/* Search Section */}
          <div className="mb-8">
            <div
              className="flex items-center rounded-xl border overflow-hidden"
              style={{
                borderColor: '#2a2a2a',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              <div className="pl-4 pr-2" style={{ color: 'var(--text-secondary)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nach freigegebenen Websites suchen ..."
                className="flex-1 py-3 px-2 bg-transparent outline-none text-sm"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
            <p className="text-xs mt-2 px-1" style={{ color: 'var(--text-secondary)' }}>
              Suche nach freigegebenen Websites in der Allowlist.
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div
              className="rounded-xl border p-4 mb-6 flex items-start gap-3"
              style={{
                borderColor: '#3d1515',
                backgroundColor: 'rgba(255, 69, 69, 0.08)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--error)' }}>Fehler</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{error}</p>
              </div>
            </div>
          )}

          {/* Result Display */}
          {result && (
            <div
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: '#2a2a2a', backgroundColor: 'var(--bg-surface)' }}
            >
              <div
                className="px-4 py-3 border-b flex items-center justify-between"
                style={{ borderColor: '#2a2a2a', backgroundColor: 'var(--bg-surface-2)' }}
              >
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {result.title || result.url}
                  </span>
                </div>
                <span
                  className="text-xs px-2 py-1 rounded-full"
                  style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
                >
                  {result.statusCode}
                </span>
              </div>
              <div className="p-4">
                <div className="mb-3">
                  <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>URL</p>
                  <p className="text-sm break-all" style={{ color: 'var(--text-primary)' }}>{result.url}</p>
                </div>
                <div className="mb-3">
                  <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Content-Type</p>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{result.contentType}</p>
                </div>
                {result.content && (
                  <div className="mt-4">
                    <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>Inhalt (Text)</p>
                    <div
                      className="rounded-lg p-4 text-sm max-h-96 overflow-y-auto whitespace-pre-wrap"
                      style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
                    >
                      {result.content.substring(0, 5000)}
                      {result.content.length > 5000 && '...'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Info Section */}
          {!result && !error && !loading && (
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <InfoCard
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                }
                title="Sicher"
                description="Nur freigegebene Domains werden durchgelassen."
              />
              <InfoCard
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                }
                title="Schnell"
                description="Edge-Server für minimale Latenz."
              />
              <InfoCard
                icon={
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                }
                title="Geschützt"
                description="HTTPS nur, keine privaten IPs, keine offenen Proxys."
              />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer
        className="border-t px-6 py-4 text-center"
        style={{ borderColor: '#2a2a2a', backgroundColor: 'var(--bg-surface)' }}
      >
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Jonas-Proxy • Sicherer Web-Proxy mit Domain-Filterung
        </p>
      </footer>
    </div>
  );
}

function InfoCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div
      className="rounded-xl border p-5 text-center"
      style={{ borderColor: '#2a2a2a', backgroundColor: 'var(--bg-surface)' }}
    >
      <div className="flex justify-center mb-3">{icon}</div>
      <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{description}</p>
    </div>
  );
}

export default App;
