import { Brain, FileText, RefreshCw, Server } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../theme';

interface ServerStatus {
  uptime: {
    formatted: string;
    days: number;
  };
  requests: {
    total: number;
    successful: number;
    failed: number;
    successRate: string;
  };
  performance: {
    avgResponseTime: number;
    fastestRequest: number;
    slowestRequest: number;
  };
  today: {
    date: string;
    requests: number;
    errors: number;
    successful: number;
    errorRate: string;
    avgProcessingTime: number;
  };
  fileTypes?: {
    pdf?: number;
    image?: number;
  };
  ocr?: {
    totalPagesProcessed: number;
    avgPagesPerPDF: number;
  };
}

const getHealthStatus = (errorRate: string) => {
  const rate = parseFloat(errorRate);
  if (isNaN(rate) || rate < 5) return { status: 'Operational', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
  if (rate < 20) return { status: 'Degraded', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
  return { status: 'Outage', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
};

const formatNumberSafe = (value: number | undefined | null) => {
  if (value === null || value === undefined) return '-';
  try {
    return value.toLocaleString();
  } catch (_e) {
    return String(value);
  }
};

function Metric({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding: '10px 12px',
      textAlign: 'center'
    }}>
      <div style={{ color: '#94a3b8', fontSize: 10, letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#e5e7eb', fontSize: 18, fontWeight: 800 }}>
        {value}{unit && <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 2 }}>{unit}</span>}
      </div>
    </div>
  );
}

export default function StatusPage() {
  const navigate = useNavigate();

  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [ocrServerStatus, setOcrServerStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const aiHealth = serverStatus ? getHealthStatus(serverStatus?.today?.errorRate ?? '') : { status: 'Unknown', color: '#94a3b8', bg: 'rgba(255,255,255,0.02)' };
  const ocrHealth = ocrServerStatus ? getHealthStatus(ocrServerStatus?.today?.errorRate ?? '') : { status: 'Unknown', color: '#94a3b8', bg: 'rgba(255,255,255,0.02)' };

  const fetchServerStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch AI server status
      const mainResponse = await fetch('https://switchai.onrender.com/api/status');
      if (mainResponse.ok) {
        const mainData = await mainResponse.json();
        setServerStatus(mainData);
      }

      // Fetch OCR server status
      const ocrResponse = await fetch('https://vivektools.onrender.com/api/status');
      if (ocrResponse.ok) {
        const ocrData = await ocrResponse.json();
        setOcrServerStatus(ocrData);
      }
    } catch (err) {
      setError('Failed to connect to servers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServerStatus();
  }, []);

  return (
    <div style={{ minHeight: '100dvh', background: `linear-gradient(180deg, ${theme.gradients.background.join(', ')})`, color: theme.colors.text, position: 'relative' }}>
      {/* Geometric elements for depth */}
      <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.06)', top: '-15%', right: '-15%' }} />
      <div style={{ position: 'absolute', width: 180, height: 180, border: '1px solid rgba(255, 255, 255, 0.05)', transform: 'rotate(45deg)', bottom: '20%', left: '10%' }} />
      <div style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.04)', top: '60%', right: '10%' }} />

      {/* Header */}
      <div style={{ height: 60, borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)' }}>
        <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          ‹
        </button>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Infrastructure Status</div>
      </div>

      {/* Content */}
      <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 32, height: 32, border: '3px solid rgba(6,182,212,0.3)', borderTop: '3px solid #06b6d4', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
            <div style={{ color: '#cbd5e1', fontSize: 16 }}>Loading infrastructure metrics...</div>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <div style={{ color: '#ef4444', marginBottom: 16 }}>
              <Server size={48} />
            </div>
            <div style={{ color: '#ef4444', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Connection Failed</div>
            <div style={{ color: '#94a3b8', fontSize: 14, marginBottom: 20 }}>{error}</div>
            <button
              onClick={fetchServerStatus}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#06b6d4',
                border: 'none',
                color: '#0b0f14',
                borderRadius: 12,
                padding: '12px 16px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={18} />
              Retry Connection
            </button>
          </div>
        ) : (
          <>
            {/* AI Server Status */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: '#cbd5e1', fontSize: 14, fontWeight: 800, letterSpacing: 0.4, padding: '0 4px', marginBottom: 16 }}>Services</div>

              {serverStatus && (
                <div style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: 12,
                  padding: '12px 16px',
                  marginBottom: 16
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: 'rgba(6,182,212,0.1)',
                        border: '1px solid rgba(6,182,212,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Brain size={20} color="#06b6d4" />
                      </div>
                      <div>
                        <div style={{ color: '#e5e7eb', fontWeight: 700 }}>AI Server</div>
                        <div style={{ color: '#94a3b8', fontSize: 12 }}>SwitchAI backend infrastructure</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: aiHealth.color
                      }} />
                      <div style={{ color: aiHealth.color, fontWeight: 700, fontSize: 12 }}>{aiHealth.status}</div>
                    </div>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 12
                  }}>
                    <Metric label="UPTIME" value={serverStatus.uptime.formatted} />
                    <Metric label="TOTAL" value={formatNumberSafe(serverStatus.requests.total)} />
                    <Metric label="SUCCESS" value={serverStatus.requests.successRate} />
                    <Metric label="LATENCY" value={formatNumberSafe(serverStatus.performance.avgResponseTime)} unit="ms" />
                  </div>
                </div>
              )}

              {ocrServerStatus && (
                <div style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: 12,
                  padding: '12px 16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: 'rgba(6,182,212,0.1)',
                        border: '1px solid rgba(6,182,212,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <FileText size={20} color="#06b6d4" />
                      </div>
                      <div>
                        <div style={{ color: '#e5e7eb', fontWeight: 700 }}>OCR Server</div>
                        <div style={{ color: '#94a3b8', fontSize: 12 }}>Document processing service</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: ocrHealth.color
                      }} />
                      <div style={{ color: ocrHealth.color, fontWeight: 700, fontSize: 12 }}>{ocrHealth.status}</div>
                    </div>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 12
                  }}>
                    <Metric label="UPTIME" value={ocrServerStatus.uptime.formatted} />
                    <Metric label="PAGES" value={formatNumberSafe(ocrServerStatus.ocr?.totalPagesProcessed ?? 0)} />
                    <Metric label="SUCCESS" value={ocrServerStatus.requests.successRate} />
                    <Metric label="LATENCY" value={formatNumberSafe(ocrServerStatus.today.avgProcessingTime)} unit="ms" />
                  </div>
                </div>
              )}
            </div>

            {/* Refresh Button */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={fetchServerStatus}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#06b6d4',
                  border: 'none',
                  color: '#0b0f14',
                  borderRadius: 12,
                  padding: '12px 16px',
                  fontWeight: 800,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
              >
                <RefreshCw size={18} />
                {loading ? 'Refreshing...' : 'Refresh Status'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}