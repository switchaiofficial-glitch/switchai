import { auth } from '@/lib/firebase';
import { formatTokens, getUserTokenData, subscribeToTokenBalance, type UserTokenData } from '@/lib/tokenService';
import { Coins, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import SettingsLayout from '../../components/SettingsLayout';
import '../../styles/animations.css';

export default function TokensPage() {
  const [tokenData, setTokenData] = useState<UserTokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const data = await getUserTokenData();
      setTokenData(data);
    } catch (error) {
      console.error('Error loading token data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    
    const unsubscribe = subscribeToTokenBalance(uid, async (balance) => {
      setTokenData(prev => prev ? { ...prev, balance } : null);
    });
    
    return () => unsubscribe();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  return (
    <SettingsLayout title="Tokens" subtitle="View your token balance and usage">
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <div className="animate-pulse" style={{ color: '#666666', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="animate-spin" style={{ 
              width: 20, 
              height: 20, 
              border: '2px solid rgba(255, 255, 255, 0.1)',
              borderTopColor: '#ffffff',
              borderRadius: '50%',
            }} />
            Loading...
          </div>
        </div>
      ) : (
        <>
          {/* Balance Card with animation */}
          <div className="animate-fade-in-up" style={{ 
            background: 'rgba(255, 255, 255, 0.04)', 
            borderRadius: 16, 
            padding: 28, 
            marginBottom: 20, 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
            position: 'relative', 
            overflow: 'hidden',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}>
            {/* Subtle glow effect */}
            <div style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              height: '100%', 
              background: 'radial-gradient(circle at top left, rgba(16, 185, 129, 0.1) 0%, transparent 50%)',
              pointerEvents: 'none',
            }} />
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Coins size={22} color="#10b981" />
                <div style={{ color: '#888888', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your Balance</div>
              </div>
              <div style={{ 
                fontSize: 52, 
                fontWeight: 800, 
                color: '#ffffff', 
                marginBottom: 8,
                letterSpacing: '-2px',
                lineHeight: 1,
              }}>
                {formatTokens(tokenData?.balance || 0)}
              </div>
              <div style={{ color: '#666666', fontSize: 15, fontWeight: 500 }}>tokens available</div>
            </div>
          </div>

          {/* Stats Grid with staggered animations */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div className="animate-fade-in-up" style={{ 
              background: 'rgba(255,255,255,0.04)', 
              borderRadius: 12, 
              padding: 18, 
              border: '1px solid rgba(255, 255, 255, 0.08)',
              transition: 'all 0.3s ease',
              animationDelay: '100ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <TrendingUp size={18} color="#10b981" />
                <div style={{ color: '#888888', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Earned</div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981', letterSpacing: '-1px' }}>
                {formatTokens(tokenData?.totalEarned || 0)}
              </div>
            </div>

            <div className="animate-fade-in-up" style={{ 
              background: 'rgba(255,255,255,0.04)', 
              borderRadius: 12, 
              padding: 18, 
              border: '1px solid rgba(255, 255, 255, 0.08)',
              transition: 'all 0.3s ease',
              animationDelay: '150ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <TrendingDown size={18} color="#f59e0b" />
                <div style={{ color: '#888888', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Spent</div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b', letterSpacing: '-1px' }}>
                {formatTokens(tokenData?.totalSpent || 0)}
              </div>
            </div>

            <div className="animate-fade-in-up" style={{ 
              background: 'rgba(255,255,255,0.04)', 
              borderRadius: 12, 
              padding: 18, 
              border: '1px solid rgba(255, 255, 255, 0.08)',
              transition: 'all 0.3s ease',
              animationDelay: '200ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Sparkles size={18} color="#a78bfa" />
                <div style={{ color: '#888888', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Referrals</div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#a78bfa', letterSpacing: '-1px' }}>
                {tokenData?.referralCount || 0}
              </div>
            </div>
          </div>

          {/* Earn More Section with animation */}
          <div className="animate-fade-in-up" style={{ 
            background: 'rgba(255,255,255,0.04)', 
            borderRadius: 12, 
            padding: 24, 
            border: '1px solid rgba(255, 255, 255, 0.08)',
            animationDelay: '250ms',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', marginBottom: 16, letterSpacing: '-0.3px' }}>Earn More Tokens</div>
            
            <div style={{ 
              padding: 20, 
              background: 'rgba(255,255,255,0.02)', 
              borderRadius: 12, 
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}>
              <div style={{ color: '#888888', fontSize: 14, lineHeight: 1.7 }}>
                <div style={{ color: '#ffffff', fontWeight: 700, marginBottom: 12, fontSize: 15 }}>How to earn:</div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <li style={{ color: '#888888' }}>Share your referral code with friends</li>
                  <li style={{ color: '#888888' }}>They sign up using your code</li>
                  <li style={{ color: '#888888' }}>You both get rewarded!</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </SettingsLayout>
  );
}
