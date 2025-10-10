import { auth, firestore } from '@/lib/firebase';
import { resetGroqCache } from '@/lib/groqClient';
import { resetOpenRouterCache } from '@/lib/openRouterClient';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { AlertCircle, Brain, Check, CheckCircle, ChevronDown, ChevronRight, Database, Eye, EyeOff, Info, Key, LogOut, Mail, Phone, RefreshCcw, Rocket, Server, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import pkg from '../../package.json';
import { theme } from '../theme';

export default function SettingsPage() {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const name = (user?.displayName || 'Your Account').toUpperCase();
  const email = user?.email || '—';
  const phone = user?.phoneNumber || '—';
  const photoURL = user?.photoURL || '';

  // Reasoning level
  const [reasoningLevel, setReasoningLevel] = useState<'low'|'medium'|'high'>(() => {
    try { const v = localStorage.getItem('reasoningLevel'); if (v === 'low' || v === 'medium' || v === 'high') return v; } catch {}
    return 'medium';
  });
  useEffect(() => { try { localStorage.setItem('reasoningLevel', reasoningLevel); } catch {} }, [reasoningLevel]);
  const [showReasoningMenu, setShowReasoningMenu] = useState(false);

  // Math settings
  const [mathLatexEnabled, setMathLatexEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('mathLatexEnabled') === '1'; } catch { return false; }
  });
  const [katexOnlyEnabled, setKatexOnlyEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('katexOnlyEnabled') === '1'; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem('mathLatexEnabled', mathLatexEnabled ? '1' : '0'); } catch {} }, [mathLatexEnabled]);
  useEffect(() => { try { localStorage.setItem('katexOnlyEnabled', katexOnlyEnabled ? '1' : '0'); } catch {} }, [katexOnlyEnabled]);

  // Dedicated inference: Groq, OpenRouter, Cerebras
  const uid = user?.uid || null;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [useForTraining, setUseForTraining] = useState<boolean>(() => {
    try { return localStorage.getItem('useDataForTraining') === '1'; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem('useDataForTraining', useForTraining ? '1' : '0'); } catch {} }, [useForTraining]);

  const [groqKey, setGroqKey] = useState('');
  const [groqEnabled, setGroqEnabled] = useState(false);
  const [groqHasKey, setGroqHasKey] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const groqLooksValid = useMemo(() => /^gsk_[A-Za-z0-9]/.test(String(groqKey || '').trim()), [groqKey]);

  const [orKey, setOrKey] = useState('');
  const [orEnabled, setOrEnabled] = useState(false);
  const [orHasKey, setOrHasKey] = useState(false);
  const [showOrKey, setShowOrKey] = useState(false);
  const orLooksValid = useMemo(() => /^(sk|or)-[A-Za-z0-9]/.test(String(orKey || '').trim()), [orKey]);

  const [cbKey, setCbKey] = useState('');
  const [cbEnabled, setCbEnabled] = useState(false);
  const [cbHasKey, setCbHasKey] = useState(false);
  const [showCbKey, setShowCbKey] = useState(false);
  const cbLooksValid = useMemo(() => /^csk-[A-Za-z0-9_-]{8,}$/.test(String(cbKey || '').trim()), [cbKey]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!uid) return;
        // Groq
        const gRef = doc(firestore, 'users', uid, 'api', 'groq');
        const gSnap = await getDoc(gRef);
        if (!mounted) return;
        if (gSnap.exists()) {
          const d = gSnap.data() || {} as any;
          const k = (d.key && typeof d.key === 'string') ? d.key : '';
          const en = !!d.enabled;
          setGroqKey(k); setGroqHasKey(!!k); setGroqEnabled(en);
        } else { setGroqKey(''); setGroqHasKey(false); setGroqEnabled(false); }
        // OpenRouter
        const oRef = doc(firestore, 'users', uid, 'api', 'openrouter');
        const oSnap = await getDoc(oRef);
        if (oSnap.exists()) {
          const d2 = oSnap.data() || {} as any;
          const k2 = (d2.key && typeof d2.key === 'string') ? d2.key : '';
          const en2 = !!d2.enabled;
          setOrKey(k2); setOrHasKey(!!k2); setOrEnabled(en2);
        } else { setOrKey(''); setOrHasKey(false); setOrEnabled(false); }
        // Cerebras
        const cRef = doc(firestore, 'users', uid, 'api', 'cerebras');
        const cSnap = await getDoc(cRef);
        if (cSnap.exists()) {
          const d3 = cSnap.data() || {} as any;
          const k3 = (d3.key && typeof d3.key === 'string') ? d3.key : '';
          const en3 = !!d3.enabled;
          setCbKey(k3); setCbHasKey(!!k3); setCbEnabled(en3);
        } else { setCbKey(''); setCbHasKey(false); setCbEnabled(false); }
      } catch {} finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [uid]);

  const saveKey = async (provider: 'groq'|'openrouter'|'cerebras') => {
    if (!uid) return;
    try {
      setSaving(true);
      const value = provider === 'groq' ? groqKey : provider === 'openrouter' ? orKey : cbKey;
      const ref = doc(firestore, 'users', uid, 'api', provider);
      await setDoc(ref, { key: String(value || '').trim(), enabled: true }, { merge: true });
      if (provider === 'groq') { setGroqHasKey(!!value); setGroqEnabled(true); }
      if (provider === 'openrouter') { setOrHasKey(!!value); setOrEnabled(true); }
      if (provider === 'cerebras') { setCbHasKey(!!value); setCbEnabled(true); }
      // reset caches so new keys are picked up
      try { if (provider === 'groq') resetGroqCache(); if (provider === 'openrouter') resetOpenRouterCache(); } catch {}
      alert('Saved');
    } catch { alert('Failed to save key'); } finally { setSaving(false); }
  };

  const toggleProvider = async (provider: 'groq'|'openrouter'|'cerebras', next: boolean) => {
    if (!uid) return;
    try {
      if (next) {
        const value = provider === 'groq' ? groqKey : provider === 'openrouter' ? orKey : cbKey;
        if (!String(value || '').trim()) { alert('Please add your key first.'); return; }
      }
      const ref = doc(firestore, 'users', uid, 'api', provider);
      await setDoc(ref, { enabled: next }, { merge: true });
      if (provider === 'groq') setGroqEnabled(next);
      if (provider === 'openrouter') setOrEnabled(next);
      if (provider === 'cerebras') setCbEnabled(next);
    } catch { alert('Failed to update'); }
  };

  const signOut = async () => {
    try { await auth.signOut(); navigate('/login'); } catch {}
  };

  // Modal management: personalizations, data controls, dedicated inference
  const [activeModal, setActiveModal] = useState<null | 'personalization' | 'data' | 'dedicated' | 'status' | 'about'>(null);
  const closeModal = () => setActiveModal(null);
  const [dedicatedTab, setDedicatedTab] = useState<0 | 1 | 2>(0); // 0: Groq, 1: Cerebras, 2: OpenRouter

  // Server Status (web modal) — mirrors the app's status page in a compact form
  type ServerStatus = {
    uptime: { formatted: string; days: number };
    requests: { total: number; successful: number; failed: number; successRate: string };
    performance: { avgResponseTime: number; fastestRequest: number; slowestRequest: number };
    today: { date: string; requests: number; errors: number; successful: number; errorRate: string; avgProcessingTime: number };
    fileTypes?: { pdf?: number; image?: number };
    ocr?: { totalPagesProcessed: number; avgPagesPerPDF: number };
  } | null;
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<ServerStatus>(null);
  const [ocrStatus, setOcrStatus] = useState<ServerStatus>(null);
  const fetchStatus = async () => {
    try {
      setStatusLoading(true); setStatusError(null);
      const [mainRes, ocrRes] = await Promise.allSettled([
        fetch('https://switchai.onrender.com/api/status'),
        fetch('https://vivektools.onrender.com/api/status'),
      ]);
      if (mainRes.status === 'fulfilled' && mainRes.value.ok) {
        const json = await mainRes.value.json(); setAiStatus(json);
      } else { setAiStatus(null); }
      if (ocrRes.status === 'fulfilled' && ocrRes.value.ok) {
        const json = await ocrRes.value.json(); setOcrStatus(json);
      } else { setOcrStatus(null); }
    } catch (e) {
      setStatusError('Failed to connect to servers');
    } finally {
      setStatusLoading(false);
    }
  };
  useEffect(() => { if (activeModal === 'status') fetchStatus(); }, [activeModal]);
  const getHealth = (errRate: string | undefined) => {
    const rate = parseFloat(String(errRate || 'NaN'));
    if (isNaN(rate)) return { label: 'Unknown', color: '#94a3b8', bg: 'rgba(255,255,255,0.06)' };
    if (rate < 5) return { label: 'Operational', color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
    if (rate < 20) return { label: 'Degraded', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
    return { label: 'Outage', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ color: '#cbd5e1', fontSize: 14, fontWeight: 800, letterSpacing: 0.4, padding: '0 4px' }}>{title}</div>
      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, border: `1px solid ${theme.colors.border}`, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );

  const Row = ({ icon, label, sub, onClick, danger }: { icon: React.ReactNode; label: string; sub?: string; onClick?: () => void; danger?: boolean }) => (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 12px', cursor: onClick ? 'pointer' : 'default', borderBottom: `1px solid ${theme.colors.border}`, background: danger ? 'rgba(253, 164, 175, 0.08)' : 'transparent' }}>
      <div style={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: danger ? '#fda4af' : '#cbd5e1' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: danger ? '#fda4af' : '#e5e7eb', fontWeight: 700 }}>{label}</div>
        {sub && <div style={{ color: danger ? '#fda4af' : '#94a3b8', fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
      </div>
      {onClick && !danger && <ChevronRight size={18} color="#64748b" />}
      {danger && <div style={{ width: 20, height: 20, borderRadius: 10, background: '#fda4af', color: '#0b0f14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>!</div>}
    </div>
  );

  const ProviderCard = ({
    title, value, setValue, enabled, hasKey, setEnabled, looksValid, docsUrl, placeholder
  }: {
    title: 'Groq'|'OpenRouter'|'Cerebras';
    value: string; setValue: (v: string)=>void; enabled: boolean; hasKey: boolean;
    setEnabled: (v: boolean)=>void; looksValid: boolean; docsUrl: string; placeholder: string;
  }) => {
    const [show, setShow] = useState(false);
    const provider = title.toLowerCase() as 'groq'|'openrouter'|'cerebras';
    return (
      <div style={{ background: 'rgba(11, 15, 20, 0.7)', borderRadius: 16, padding: 16, border: `1px solid ${theme.colors.border}`, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Key size={16} />
            </div>
            <div>
              <div style={{ color: '#e5e7eb', fontWeight: 800 }}>{title}</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Use your own {title} API key</div>
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 999, background: enabled ? '#a5f3fc' : 'rgba(148,163,184,0.18)', border: `1px solid ${enabled ? 'rgba(165,243,252,0.8)' : 'rgba(148,163,184,0.35)'}` }}>
            <div style={{ width: 8, height: 8, borderRadius: 999, background: enabled ? '#0b0f14' : '#cbd5e1' }} />
            <div style={{ color: enabled ? '#0b0f14' : '#cbd5e1', fontWeight: 800, fontSize: 11 }}>{enabled ? 'ON' : 'OFF'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', border: `1px solid ${theme.colors.border}`, borderRadius: 12, padding: 8 }}>
          <input value={value} onChange={(e)=>setValue(e.target.value)} placeholder={hasKey ? '••••••••••••' : placeholder} style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e5e7eb', padding: '10px 12px' }} />
          <button onClick={()=>setShow(s=>!s)} title={show? 'Hide' : 'Show'} style={{ background:'#111827', border: `1px solid ${theme.colors.border}`, color:'#e5e7eb', borderRadius: 8, padding: 8, cursor:'pointer' }}>{show ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          {looksValid ? <CheckCircle size={14} color="#34d399" /> : <AlertCircle size={14} color="#fbbf24" />}
          <div style={{ color: looksValid ? '#34d399' : '#fbbf24', fontSize: 12, fontWeight: 700 }}>{looksValid ? 'Key format looks valid' : 'Key looks invalid or empty'}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button onClick={()=>window.open(docsUrl, '_blank')} style={{ flex:1, background:'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', color:'#93c5fd', borderRadius: 12, padding: '10px 12px', fontWeight: 800, cursor:'pointer' }}>Get {title} key</button>
          <button onClick={()=>saveKey(provider)} disabled={saving || loading || !uid} style={{ flex:1, background:'#60a5fa', border: 'none', color:'#0b0f14', borderRadius: 12, padding: '10px 12px', fontWeight: 800, cursor:'pointer' }}>{hasKey ? 'Update Key' : 'Save Key'}</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', border: `1px solid ${theme.colors.border}`, borderRadius: 12, padding: '8px 12px', marginTop: 10 }}>
          <div style={{ color:'#cbd5e1', fontWeight: 700 }}>Enable</div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor:'pointer' }}>
            <input type="checkbox" checked={enabled} onChange={(e)=>toggleProvider(provider, e.target.checked)} />
            <span style={{ color:'#cbd5e1' }}>{enabled ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>
      </div>
    );
  };

  function safeNum(value: any) {
    if (value === null || value === undefined) return '-';
    try { return Number(value).toLocaleString(); } catch { return String(value); }
  }

  function Metric({ label, value }: { label: string; value: string | number }) {
    return (
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'10px 12px' }}>
        <div style={{ color:'#94a3b8', fontSize:10, letterSpacing:0.5, marginBottom:4 }}>{label}</div>
        <div style={{ color:'#e5e7eb', fontSize:18, fontWeight:800 }}>{value}</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: `linear-gradient(180deg, ${theme.gradients.background.join(', ')})`, color: theme.colors.text }}>
      <div style={{ height: 60, borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)' }}>
        <button onClick={()=>navigate(-1)} style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: 'none', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>{'‹'}</button>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Settings</div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
        {/* Profile */}
        <div style={{ background: 'rgba(11,15,20,0.7)', border: `1px solid ${theme.colors.border}`, borderRadius: 16, padding: 16, display:'flex', alignItems:'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, overflow:'hidden', background:'#1f2937', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {photoURL ? (
              <img src={photoURL} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            ) : (
              <div style={{ color:'#e5e7eb', fontWeight:800 }}>{(user?.displayName || 'U')[0].toUpperCase()}</div>
            )}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:'#e5e7eb', fontWeight:800 }}>{name}</div>
            <div style={{ color:'#94a3b8', fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{email}</div>
          </div>
        </div>

        {/* Account */}
        <Section title="Account">
          <Row icon={<Mail size={18}/>} label="Email" sub={email} />
          <Row icon={<Phone size={18}/>} label="Phone number" sub={phone} />
        </Section>

        {/* App */}
        <Section title="App">
          <Row icon={<Brain size={18}/>} label="Personalization" sub="Models and preferences" onClick={()=>setActiveModal('personalization')} />
          <Row icon={<Database size={18}/>} label="Data Controls" sub="Privacy and local data" onClick={()=>setActiveModal('data')} />
          <Row icon={<Rocket size={18}/>} label="Dedicated Inference" sub="Use your own API keys" onClick={()=>setActiveModal('dedicated')} />
          <Row icon={<Server size={18}/>} label="Server Status" sub="Infrastructure monitoring" onClick={()=>setActiveModal('status')} />
          <Row icon={<Info size={18}/>} label="About" onClick={()=>setActiveModal('about')} />
        </Section>

        {/* Danger zone */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ background: 'rgba(253, 164, 175, 0.08)', borderRadius: 16, border: '1px solid rgba(253, 164, 175, 0.24)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 12px' }}>
              <div style={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color:'#fda4af' }}><LogOut size={18} /></div>
              <div style={{ flex:1 }}>
                <div style={{ color:'#fda4af', fontWeight: 700 }}>Sign Out</div>
                <div style={{ color:'#fda4af', fontSize: 12 }}>End your current session</div>
              </div>
              <button onClick={signOut} style={{ background:'rgba(244,63,94,0.14)', border:'1px solid rgba(244,63,94,0.24)', color:'#fecdd3', borderRadius: 10, padding: '8px 12px', cursor:'pointer' }}>Sign Out</button>
            </div>
          </div>
        </div>

        {/* Modals */}
        {activeModal && (
          <div className="modalBackdrop" onClick={closeModal}>
            <div className="modalCard" style={{ maxWidth: 720 }} onClick={(e)=>e.stopPropagation()}>
              <div className="modalHeader" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontWeight:800, color:'#e5e7eb' }}>
                  {activeModal === 'personalization' && 'Personalization'}
                  {activeModal === 'data' && 'Data & Privacy'}
                  {activeModal === 'dedicated' && 'Dedicated Inference'}
                  {activeModal === 'status' && 'Infrastructure Status'}
                  {activeModal === 'about' && 'About'}
                </div>
                <button onClick={closeModal} style={{ background:'rgba(255,255,255,0.06)', border:`1px solid ${theme.colors.border}`, borderRadius:8, padding:6, cursor:'pointer', color:'#e5e7eb' }}>
                  <X size={16} />
                </button>
              </div>
              <div className="modalBody">
                {activeModal === 'personalization' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent:'space-between', background: 'rgba(255,255,255,0.04)', border: `1px solid ${theme.colors.border}`, borderRadius: 12, padding: '10px 12px', position: 'relative' }}>
                      <div>
                        <div style={{ color:'#e5e7eb', fontWeight:700 }}>Reasoning Effort</div>
                        <div style={{ color:'#94a3b8', fontSize:12 }}>Set effort for reasoning models</div>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <button onClick={() => setShowReasoningMenu(v => !v)} title="Reasoning level"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                            background: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.colors.border}`,
                            borderRadius: '999px', color: theme.colors.text, fontSize: 12, cursor: 'pointer'
                          }}>
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: theme.colors.primary, display: 'inline-block' }} />
                          <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{reasoningLevel}</span>
                          <ChevronDown size={14} />
                        </button>
                        {showReasoningMenu && (
                          <div style={{ position: 'absolute', top: '42px', right: 0, background: 'rgba(26,28,34,0.98)', border: `1px solid ${theme.colors.border}`, borderRadius: 10, padding: 6, minWidth: 160, zIndex: 1000 }}>
                            {(['low','medium','high'] as const).map(lvl => (
                              <div key={lvl} onClick={() => { setReasoningLevel(lvl); setShowReasoningMenu(false); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: reasoningLevel===lvl? 'rgba(255,255,255,0.06)':'transparent' }}>
                                <span style={{ textTransform: 'capitalize' }}>{lvl}</span>
                                {reasoningLevel===lvl && <Check size={14} />}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,0.04)', border:`1px solid ${theme.colors.border}`, borderRadius:12, padding:'10px 12px' }}>
                      <div>
                        <div style={{ color:'#e5e7eb', fontWeight:700 }}>Math LaTeX Rendering</div>
                        <div style={{ color:'#94a3b8', fontSize:12 }}>Render all formulas with LaTeX</div>
                      </div>
                      <input type="checkbox" checked={mathLatexEnabled} onChange={(e)=>setMathLatexEnabled(e.target.checked)} />
                    </label>
                    <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,0.04)', border:`1px solid ${theme.colors.border}`, borderRadius:12, padding:'10px 12px' }}>
                      <div>
                        <div style={{ color:'#e5e7eb', fontWeight:700 }}>Use KaTeX Only</div>
                        <div style={{ color:'#94a3b8', fontSize:12 }}>Experimental: render ALL math with KaTeX</div>
                      </div>
                      <input type="checkbox" checked={katexOnlyEnabled} onChange={(e)=>setKatexOnlyEnabled(e.target.checked)} />
                    </label>
                  </div>
                )}

                {activeModal === 'data' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(255,255,255,0.04)', border:`1px solid ${theme.colors.border}`, borderRadius:12, padding:'10px 12px' }}>
                      <div>
                        <div style={{ color:'#e5e7eb', fontWeight:700 }}>Use data for training</div>
                        <div style={{ color:'#94a3b8', fontSize:12 }}>Allow anonymous usage to improve model quality</div>
                      </div>
                      <input type="checkbox" checked={useForTraining} onChange={(e)=>setUseForTraining(e.target.checked)} />
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
                      <button onClick={()=>{
                        if (confirm('Delete all active chats? Archived will be kept.')) {
                          try {
                            const raw = localStorage.getItem('switchai_chats');
                            const list = raw ? JSON.parse(raw) : [];
                            const toKeep = (Array.isArray(list) ? list : []).filter((c:any)=>!!c?.archived);
                            localStorage.setItem('switchai_chats', JSON.stringify(toKeep));
                            alert('Active chats deleted. Archived kept.');
                          } catch {}
                        }
                      }} style={{ background:'rgba(255,255,255,0.06)', border:`1px solid ${theme.colors.border}`, color:'#e7e7eb', borderRadius:12, padding:'10px 12px', cursor:'pointer' }}>
                        Delete active chats
                      </button>
                      <button onClick={()=>{
                        if (confirm('Delete archived chats only? Active will be kept.')) {
                          try {
                            const raw = localStorage.getItem('switchai_chats');
                            const list = raw ? JSON.parse(raw) : [];
                            const toKeep = (Array.isArray(list) ? list : []).filter((c:any)=>!c?.archived);
                            localStorage.setItem('switchai_chats', JSON.stringify(toKeep));
                            alert('Archived chats deleted. Active kept.');
                          } catch {}
                        }
                      }} style={{ background:'rgba(253, 164, 175, 0.08)', border:'1px solid rgba(253, 164, 175, 0.24)', color:'#fda4af', borderRadius:12, padding:'10px 12px', cursor:'pointer' }}>
                        Delete archived chats
                      </button>
                    </div>
                  </div>
                )}

                {activeModal === 'dedicated' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {/* Tabs */}
                    <div style={{ display:'flex', gap:8, marginBottom:4 }}>
                      {['Groq','Cerebras','OpenRouter'].map((t, i) => (
                        <button key={t} onClick={()=>setDedicatedTab(i as 0|1|2)} style={{ padding:'8px 12px', borderRadius:20, border: '1px solid rgba(255,255,255,0.12)', background: dedicatedTab===i ? '#a5f3fc' : 'transparent', color: dedicatedTab===i ? '#0b0f14' : '#94a3b8', fontWeight:800, cursor:'pointer' }}>{t}</button>
                      ))}
                    </div>
                    {dedicatedTab === 0 && (
                      <ProviderCard title="Groq" value={groqKey} setValue={setGroqKey} enabled={groqEnabled} hasKey={groqHasKey} setEnabled={setGroqEnabled} looksValid={groqLooksValid} docsUrl="https://console.groq.com/keys" placeholder="gsk_..." />
                    )}
                    {dedicatedTab === 1 && (
                      <ProviderCard title="Cerebras" value={cbKey} setValue={setCbKey} enabled={cbEnabled} hasKey={cbHasKey} setEnabled={setCbEnabled} looksValid={cbLooksValid} docsUrl="https://inference.cerebras.net" placeholder="csk-..." />
                    )}
                    {dedicatedTab === 2 && (
                      <ProviderCard title="OpenRouter" value={orKey} setValue={setOrKey} enabled={orEnabled} hasKey={orHasKey} setEnabled={setOrEnabled} looksValid={orLooksValid} docsUrl="https://openrouter.ai/keys" placeholder="sk-or-..." />
                    )}
                  </div>
                )}

                {activeModal === 'status' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ color:'#94a3b8' }}>Live infrastructure metrics</div>
                      <button onClick={fetchStatus} disabled={statusLoading} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.06)', border:`1px solid ${theme.colors.border}`, color:'#e5e7eb', cursor:'pointer' }}>
                        <RefreshCcw size={14} /> Refresh
                      </button>
                    </div>
                    {statusError && <div style={{ color:'#ef4444', fontSize:13 }}>{statusError}</div>}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:12 }}>
                      {/* AI Processing Card */}
                      <div style={{ background:'rgba(11,15,20,0.7)', border:`1px solid ${theme.colors.border}`, borderRadius:16, padding:14 }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ width:28, height:28, borderRadius:8, background:'rgba(59,130,246,0.12)', display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${theme.colors.border}` }}>🤖</div>
                            <div>
                              <div style={{ color:'#e5e7eb', fontWeight:700 }}>AI Processing</div>
                              <div style={{ color:'#94a3b8', fontSize:12 }}>Neural inference engine</div>
                            </div>
                          </div>
                          {aiStatus ? (()=>{ const h=getHealth(aiStatus?.today?.errorRate); return <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:999, background:h.bg, border:`1px solid rgba(255,255,255,0.12)` }}>
                            <span style={{ width:8, height:8, borderRadius:999, background:h.color }} />
                            <span style={{ color:h.color, fontSize:12, fontWeight:700 }}>{h.label}</span>
                          </div>; })() : <div style={{ color:'#94a3b8', fontSize:12 }}>{statusLoading ? 'Loading…' : 'No data'}</div>}
                        </div>
                        {aiStatus && (
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 }}>
                            <Metric label="TODAY" value={safeNum(aiStatus.today.requests)} />
                            <Metric label="SUCCESS" value={String(aiStatus.requests.successRate)} />
                            <Metric label="LATENCY" value={`${safeNum(aiStatus.today.avgProcessingTime)} ms`} />
                            <Metric label="UPTIME" value={`${safeNum(aiStatus.uptime.days)} days`} />
                          </div>
                        )}
                      </div>

                      {/* OCR Card */}
                      <div style={{ background:'rgba(11,15,20,0.7)', border:`1px solid ${theme.colors.border}`, borderRadius:16, padding:14 }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ width:28, height:28, borderRadius:8, background:'rgba(124,58,237,0.12)', display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${theme.colors.border}` }}>📄</div>
                            <div>
                              <div style={{ color:'#e5e7eb', fontWeight:700 }}>OCR Processing</div>
                              <div style={{ color:'#94a3b8', fontSize:12 }}>Document analysis engine</div>
                            </div>
                          </div>
                          {ocrStatus ? (()=>{ const h=getHealth(ocrStatus?.today?.errorRate); return <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:999, background:h.bg, border:`1px solid rgba(255,255,255,0.12)` }}>
                            <span style={{ width:8, height:8, borderRadius:999, background:h.color }} />
                            <span style={{ color:h.color, fontSize:12, fontWeight:700 }}>{h.label}</span>
                          </div>; })() : <div style={{ color:'#94a3b8', fontSize:12 }}>{statusLoading ? 'Loading…' : 'No data'}</div>}
                        </div>
                        {ocrStatus && (
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 }}>
                            <Metric label="TODAY" value={safeNum(ocrStatus.today.requests)} />
                            <Metric label="SUCCESS" value={String(ocrStatus.requests.successRate)} />
                            <Metric label="LATENCY" value={`${safeNum(ocrStatus.today.avgProcessingTime)} ms`} />
                            <Metric label="PAGES" value={safeNum(ocrStatus.ocr?.totalPagesProcessed ?? 0)} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeModal === 'about' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:14, alignItems:'center', textAlign:'center' }}>
                    <div style={{ width:72, height:72, borderRadius:16, padding:8, background:'linear-gradient(135deg,#06b6d4,#7c3aed)' }}>
                      <img src="/logo.png" alt="SwitchAi" style={{ width:'100%', height:'100%', objectFit:'contain', borderRadius:12, background:'#fff' }} />
                    </div>
                    <div style={{ fontSize:22, color:'#e5e7eb', fontWeight:700 }}>SwitchAi</div>
                    <div style={{ fontSize:12, color:'#94a3b8' }}>Fast, private, and responsive AI</div>
                    <div style={{ fontSize:13, color:'#cbd5e1', maxWidth:560 }}>SwitchAi gives you lightning-fast answers with privacy-first defaults and a clean, distraction-free chat UI.</div>
                    <div style={{ marginTop:6, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, width:'100%', maxWidth:560 }}>
                      <div style={{ background:'rgba(11,15,20,0.7)', border:`1px solid ${theme.colors.border}`, borderRadius:12, padding:12, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ color:'#94a3b8', fontSize:12 }}>App</span>
                        <span style={{ color:'#e5e7eb', fontWeight:700 }}>SwitchAi</span>
                      </div>
                      <div style={{ background:'rgba(11,15,20,0.7)', border:`1px solid ${theme.colors.border}`, borderRadius:12, padding:12, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ color:'#94a3b8', fontSize:12 }}>Version</span>
                        <span style={{ color:'#e5e7eb', fontWeight:700 }}>{(pkg as any)?.version || '1.0.0'}</span>
                      </div>
                    </div>
                    <div style={{ marginTop:8, color:'#94a3b8', fontSize:12 }}>Built for speed, privacy, and reliability.</div>
                  </div>
                )}
              </div>
              <div className="modalFooter" style={{ display:'flex', justifyContent:'flex-end' }}>
                <button onClick={closeModal} className="acceptBtn" style={{ width:'auto', padding:'10px 16px', height:40 }}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
