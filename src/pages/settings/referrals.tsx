import { auth } from '@/lib/firebase';
import { applyReferralCode, formatTokens, getReferralRewardAmount, getUserReferralCode, getUserReferrals, type ReferralData } from '@/lib/tokenService';
import { Check, ChevronLeft, Copy, Gift, Share2, UserPlus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../theme';

export default function ReferralsPage() {
  const navigate = useNavigate();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<ReferralData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(1000000);
  const [inputCode, setInputCode] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadData = async () => {
    try {
      const [code, userReferrals, reward] = await Promise.all([
        getUserReferralCode(),
        getUserReferrals(),
        getReferralRewardAmount(),
      ]);
      
      setReferralCode(code);
      setReferrals(userReferrals);
      setRewardAmount(reward);
    } catch (error) {
      console.error('Error loading referral data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleShare = async () => {
    if (!referralCode) return;
    const text = `Join SwitchAI and get ${formatTokens(rewardAmount)} tokens! Use my referral code: ${referralCode}`;
    
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      alert('Referral message copied to clipboard!');
    }
  };

  const handleApplyCode = async () => {
    if (!inputCode.trim() || isApplying) return;
    
    setIsApplying(true);
    const result = await applyReferralCode(inputCode.trim());
    setIsApplying(false);
    
    alert(result.message);
    
    if (result.success) {
      setInputCode('');
      loadData();
    }
  };

  return (
    <div style={{ minHeight: '100dvh', background: `linear-gradient(180deg, ${theme.gradients.background.join(', ')})`, color: theme.colors.text }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: `1px solid ${theme.colors.border}`, background: 'rgba(11, 15, 20, 0.7)', backdropFilter: 'blur(10px)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#e5e7eb', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ fontSize: 20, fontWeight: 800, marginLeft: 8 }}>Referrals</div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
            <div style={{ color: '#94a3b8' }}>Loading...</div>
          </div>
        ) : (
          <>
            {/* Reward Info */}
            <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(59, 130, 246, 0.15))', borderRadius: 20, padding: 24, marginBottom: 20, border: `1px solid ${theme.colors.border}`, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', filter: 'blur(40px)' }} />
              
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Gift size={20} color="#10b981" />
                  <div style={{ color: '#94a3b8', fontSize: 14, fontWeight: 700 }}>Referral Reward</div>
                </div>
                <div style={{ fontSize: 48, fontWeight: 800, color: '#e5e7eb', marginBottom: 8 }}>
                  {formatTokens(rewardAmount)}
                </div>
                <div style={{ color: '#cbd5e1', fontSize: 14 }}>tokens per successful referral</div>
              </div>
            </div>

            {/* Your Referral Code */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, marginBottom: 20, border: `1px solid ${theme.colors.border}` }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#e5e7eb', marginBottom: 12 }}>Your Referral Code</div>
              
              {referralCode && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ flex: 1, background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 12, padding: '16px 20px', fontSize: 32, fontWeight: 800, color: '#60a5fa', textAlign: 'center', letterSpacing: 4 }}>
                      {referralCode}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#93c5fd', borderRadius: 12, padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}>
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                      {copied ? 'Copied!' : 'Copy Code'}
                    </button>
                    <button onClick={handleShare} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#60a5fa', border: 'none', color: '#0b0f14', borderRadius: 12, padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}>
                      <Share2 size={18} />
                      Share
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Apply Referral Code */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, marginBottom: 20, border: `1px solid ${theme.colors.border}` }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#e5e7eb', marginBottom: 12 }}>Have a Referral Code?</div>
              
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="Enter code"
                  maxLength={6}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${theme.colors.border}`, borderRadius: 12, padding: '12px 16px', color: '#e5e7eb', fontSize: 16, outline: 'none' }}
                />
                <button onClick={handleApplyCode} disabled={!inputCode.trim() || isApplying} style={{ background: '#60a5fa', border: 'none', color: '#0b0f14', borderRadius: 12, padding: '12px 24px', fontWeight: 800, cursor: 'pointer', opacity: (!inputCode.trim() || isApplying) ? 0.5 : 1 }}>
                  {isApplying ? 'Applying...' : 'Apply'}
                </button>
              </div>
            </div>

            {/* Referral Stats */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 20, border: `1px solid ${theme.colors.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#e5e7eb' }}>Your Referrals</div>
                <div style={{ background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#93c5fd', borderRadius: 999, padding: '4px 12px', fontSize: 14, fontWeight: 800 }}>
                  {referrals.length} total
                </div>
              </div>

              {referrals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                  <UserPlus size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No referrals yet</div>
                  <div style={{ fontSize: 14 }}>Share your code to start earning!</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {referrals.map((ref, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: `1px solid ${theme.colors.border}` }}>
                      <div>
                        <div style={{ color: '#e5e7eb', fontWeight: 700, marginBottom: 4 }}>
                          {ref.referredUserEmail || 'User'}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 12 }}>
                          {ref.status === 'completed' ? 'Completed' : 'Pending'}
                        </div>
                      </div>
                      <div style={{ color: '#10b981', fontWeight: 800, fontSize: 18 }}>
                        +{formatTokens(ref.tokensAwarded)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
