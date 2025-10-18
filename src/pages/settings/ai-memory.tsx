import { buildMemorySystemPrompt, clearMemoryDocument, getMemoryDocument, initMemoryDocument, isMemoryEnabled, processPendingUpdates, setMemoryEnabled, type MemoryDocument } from '@/lib/aiMemoryService';
import { AlertCircle, Brain, ChevronLeft, RefreshCw, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../theme';

export default function AIMemoryPage() {
  const navigate = useNavigate();
  const [memoryContent, setMemoryContent] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [enabled, setEnabled] = useState<boolean>(false);
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    try {
      await initMemoryDocument();
      const en = isMemoryEnabled();
      setEnabled(en);
      
      if (en) {
        const doc = await getMemoryDocument();
        if (doc) {
          setMemoryContent(doc.content || '');
          setLastUpdated(doc.lastUpdated || 0);
        }
      }
    } catch (error) {
      console.error('Error loading memory:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleToggle = async (value: boolean) => {
    setEnabled(value);
    setMemoryEnabled(value);
    if (value) {
      await load();
    }
  };

  const handleClear = async () => {
    if (!confirm('Are you sure you want to clear all AI memory? This cannot be undone.')) return;
    
    try {
      await clearMemoryDocument();
      setMemoryContent('');
      setLastUpdated(0);
      alert('Memory cleared successfully');
    } catch (error) {
      console.error('Error clearing memory:', error);
      alert('Failed to clear memory');
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    try {
      await processPendingUpdates();
      await load();
      alert('Pending updates processed');
    } catch (error) {
      console.error('Error processing updates:', error);
      alert('Failed to process updates');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div style={{ minHeight: '100dvh', background: `linear-gradient(180deg, ${theme.gradients.background.join(', ')})`, color: theme.colors.text }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: `1px solid ${theme.colors.border}`, background: 'rgba(11, 15, 20, 0.7)', backdropFilter: 'blur(10px)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#e5e7eb', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ fontSize: 20, fontWeight: 800, marginLeft: 8 }}>AI Memory</div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
        {/* Enable/Disable Toggle */}
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, marginBottom: 20, border: `1px solid ${theme.colors.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Brain size={20} color="#a78bfa" />
                <div style={{ fontSize: 18, fontWeight: 800, color: '#e5e7eb' }}>AI Memory</div>
              </div>
              <div style={{ color: '#94a3b8', fontSize: 14 }}>
                Let AI remember your preferences and context
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => handleToggle(e.target.checked)}
                style={{ width: 20, height: 20, cursor: 'pointer' }}
              />
            </label>
          </div>
        </div>

        {!enabled && (
          <div style={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <AlertCircle size={20} color="#fbbf24" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: 4 }}>AI Memory is disabled</div>
                <div style={{ color: '#fcd34d', fontSize: 14 }}>
                  Enable AI Memory to let the assistant remember your preferences and provide personalized responses.
                </div>
              </div>
            </div>
          </div>
        )}

        {enabled && (
          <>
            {/* Memory Info */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, marginBottom: 20, border: `1px solid ${theme.colors.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'between', marginBottom: 16 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#e5e7eb' }}>Memory Content</div>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>
                  Last updated: {formatDate(lastUpdated)}
                </div>
              </div>

              {memoryContent ? (
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 16, border: `1px solid ${theme.colors.border}`, maxHeight: 400, overflow: 'auto' }}>
                  <pre style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordWrap: 'break-word', margin: 0, fontFamily: 'monospace' }}>
                    {memoryContent}
                  </pre>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                  <Brain size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No memory yet</div>
                  <div style={{ fontSize: 14 }}>Start chatting to build your AI memory</div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <button onClick={handleRefresh} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#93c5fd', borderRadius: 12, padding: '12px 16px', fontWeight: 800, cursor: 'pointer', opacity: refreshing ? 0.5 : 1 }}>
                <RefreshCw size={18} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>

              <button onClick={handleProcess} disabled={processing} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#6ee7b7', borderRadius: 12, padding: '12px 16px', fontWeight: 800, cursor: 'pointer', opacity: processing ? 0.5 : 1 }}>
                <Brain size={18} />
                {processing ? 'Processing...' : 'Process Updates'}
              </button>

              <button onClick={handleClear} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', borderRadius: 12, padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}>
                <Trash2 size={18} />
                Clear Memory
              </button>
            </div>

            {/* Info Box */}
            <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 16, padding: 20, marginTop: 20 }}>
              <div style={{ color: '#93c5fd', fontSize: 14, lineHeight: 1.6 }}>
                <strong>How AI Memory works:</strong>
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  <li>The AI automatically stores relevant information from your conversations</li>
                  <li>This includes preferences, facts, and context you share</li>
                  <li>Memory is stored locally on your device</li>
                  <li>You can clear it anytime</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
