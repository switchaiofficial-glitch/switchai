import { firestore, auth } from './firebase';
import { doc, getDoc, setDoc, updateDoc, increment, collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

/**
 * Token Service for Website
 * Manages user tokens, referrals, and token consumption
 */

export interface UserTokenData {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  referralCode: string;
  referredBy?: string;
  referralCount: number;
  referredUsers?: string[];
  createdAt: any;
  updatedAt: any;
}

export interface ReferralData {
  referrerId: string;
  referredUserId: string;
  referredUserEmail: string;
  referralCode: string;
  tokensAwarded: number;
  status: 'pending' | 'completed';
  createdAt: any;
  completedAt?: any;
}

export interface TokenTransaction {
  userId: string;
  type: 'initial' | 'referral' | 'consumption' | 'bonus' | 'admin';
  amount: number;
  balanceAfter: number;
  description: string;
  metadata?: any;
  createdAt: any;
}

const CACHE_KEY = 'tokenBalance';
const CACHE_DURATION = 300000; // 5 minutes
const CACHE_KEY_FULL = 'tokenDataFull';

// Cache for token balance and full data
let cachedBalance: number | null = null;
let cacheTimestamp: number = 0;
let cachedFullData: UserTokenData | null = null;
let fullDataTimestamp: number = 0;

/**
 * Generate a deterministic 6-character referral code for a user
 */
function generateReferralCode(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const code = Math.abs(hash).toString(36).toUpperCase().padStart(6, '0').substring(0, 6);
  return code;
}

/**
 * Get the initial token amount from Firebase config
 */
export async function getInitialTokenAmount(): Promise<number> {
  try {
    const configDoc = await getDoc(doc(firestore, 'config', 'tokens'));
    if (configDoc.exists()) {
      const data = configDoc.data();
      return data.initialAmount || 5000000;
    }
    return 5000000;
  } catch (error) {
    console.error('Error fetching initial token amount:', error);
    return 5000000;
  }
}

/**
 * Get the referral reward amount from Firebase config
 */
export async function getReferralRewardAmount(): Promise<number> {
  try {
    const configDoc = await getDoc(doc(firestore, 'config', 'tokens'));
    if (configDoc.exists()) {
      const data = configDoc.data();
      return data.referralReward || 1000000;
    }
    return 1000000;
  } catch (error) {
    console.error('Error fetching referral reward amount:', error);
    return 1000000;
  }
}

/**
 * Initialize token account for a new user
 */
export async function initializeUserTokens(userId: string): Promise<void> {
  try {
    const userTokenRef = doc(firestore, 'users', userId, 'tokens', 'balance');
    const existingDoc = await getDoc(userTokenRef);
    
    if (!existingDoc.exists()) {
      const initialAmount = await getInitialTokenAmount();
      const referralCode = generateReferralCode(userId);
      
      const tokenData: UserTokenData = {
        balance: initialAmount,
        totalEarned: initialAmount,
        totalSpent: 0,
        referralCode,
        referralCount: 0,
        referredUsers: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      await setDoc(userTokenRef, tokenData);
      
      // Create referralCodes document for O(1) lookup
      const referralCodeDocRef = doc(firestore, 'referralCodes', referralCode);
      await setDoc(referralCodeDocRef, {
        userId,
        createdAt: serverTimestamp(),
      });
      
      // Log initial token grant
      await logTokenTransaction(userId, {
        type: 'initial',
        amount: initialAmount,
        balanceAfter: initialAmount,
        description: 'Initial token grant for new user',
      });
      
      console.log(`✓ Initialized ${initialAmount} tokens for user ${userId} with code ${referralCode}`);
    }
  } catch (error) {
    console.error('Error initializing user tokens:', error);
    throw error;
  }
}

/**
 * Get user's current token balance (cached)
 */
export async function getTokenBalance(): Promise<number> {
  try {
    const now = Date.now();
    if (cachedBalance !== null && (now - cacheTimestamp) < CACHE_DURATION) {
      return cachedBalance;
    }

    const user = auth.currentUser;
    if (!user) return 0;

    const userTokenRef = doc(firestore, 'users', user.uid, 'tokens', 'balance');
    const tokenDoc = await getDoc(userTokenRef);
    
    if (tokenDoc.exists()) {
      const balance = tokenDoc.data().balance || 0;
      cachedBalance = balance;
      cacheTimestamp = now;
      return balance;
    }
    
    await initializeUserTokens(user.uid);
    return await getTokenBalance();
  } catch (error) {
    console.error('Error getting token balance:', error);
    return 0;
  }
}

/**
 * Get full user token data
 */
export async function getUserTokenData(): Promise<UserTokenData | null> {
  try {
    const now = Date.now();
    if (cachedFullData !== null && (now - fullDataTimestamp) < CACHE_DURATION) {
      return cachedFullData;
    }

    const user = auth.currentUser;
    if (!user) return null;

    const userTokenRef = doc(firestore, 'users', user.uid, 'tokens', 'balance');
    const tokenDoc = await getDoc(userTokenRef);
    
    if (tokenDoc.exists()) {
      const data = tokenDoc.data() as UserTokenData;
      cachedFullData = data;
      fullDataTimestamp = now;
      return data;
    }
    
    await initializeUserTokens(user.uid);
    return await getUserTokenData();
  } catch (error) {
    console.error('Error getting user token data:', error);
    return null;
  }
}

/**
 * Subscribe to real-time token balance updates
 */
export function subscribeToTokenBalance(userId: string, callback: (balance: number) => void): () => void {
  const userTokenRef = doc(firestore, 'users', userId, 'tokens', 'balance');
  
  const unsubscribe = onSnapshot(userTokenRef, (snapshot) => {
    if (snapshot.exists()) {
      const balance = snapshot.data().balance || 0;
      cachedBalance = balance;
      cacheTimestamp = Date.now();
      callback(balance);
    }
  }, (error) => {
    console.error('Error subscribing to token balance:', error);
  });
  
  return unsubscribe;
}

/**
 * Consume tokens (deduct from balance)
 */
export async function consumeTokens(amount: number, description: string, metadata?: any): Promise<boolean> {
  try {
    const user = auth.currentUser;
    if (!user) return false;

    const userTokenRef = doc(firestore, 'users', user.uid, 'tokens', 'balance');
    const tokenDoc = await getDoc(userTokenRef);
    
    if (!tokenDoc.exists()) {
      await initializeUserTokens(user.uid);
      return await consumeTokens(amount, description, metadata);
    }
    
    const currentBalance = tokenDoc.data().balance || 0;
    
    if (currentBalance < amount) {
      console.warn('Insufficient tokens');
      return false;
    }
    
    const newBalance = currentBalance - amount;
    
    await updateDoc(userTokenRef, {
      balance: newBalance,
      totalSpent: increment(amount),
      updatedAt: serverTimestamp(),
    });
    
    await logTokenTransaction(user.uid, {
      type: 'consumption',
      amount: -amount,
      balanceAfter: newBalance,
      description,
      metadata,
    });
    
    cachedBalance = newBalance;
    cacheTimestamp = Date.now();
    
    return true;
  } catch (error) {
    console.error('Error consuming tokens:', error);
    return false;
  }
}

/**
 * Log a token transaction
 */
async function logTokenTransaction(userId: string, transaction: Omit<TokenTransaction, 'userId' | 'createdAt'>): Promise<void> {
  try {
    const transactionsRef = collection(firestore, 'users', userId, 'tokenTransactions');
    await addDoc(transactionsRef, {
      ...transaction,
      userId,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error logging token transaction:', error);
  }
}

/**
 * Get user's referral code
 */
export async function getUserReferralCode(): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;

    const tokenData = await getUserTokenData();
    return tokenData?.referralCode || null;
  } catch (error) {
    console.error('Error getting referral code:', error);
    return null;
  }
}

/**
 * Get user's referrals
 */
export async function getUserReferrals(): Promise<ReferralData[]> {
  try {
    const user = auth.currentUser;
    if (!user) return [];

    const referralsRef = collection(firestore, 'referrals');
    const q = query(referralsRef, where('referrerId', '==', user.uid));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => doc.data() as ReferralData);
  } catch (error) {
    console.error('Error getting referrals:', error);
    return [];
  }
}

/**
 * Apply a referral code
 */
export async function applyReferralCode(code: string): Promise<{ success: boolean; message: string }> {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, message: 'User not authenticated' };
    }

    const upperCode = code.toUpperCase().trim();
    
    // Check if user already has a referrer
    const userTokenRef = doc(firestore, 'users', user.uid, 'tokens', 'balance');
    const userTokenDoc = await getDoc(userTokenRef);
    
    if (userTokenDoc.exists() && userTokenDoc.data().referredBy) {
      return { success: false, message: 'You have already used a referral code' };
    }
    
    // Look up the referral code
    const referralCodeRef = doc(firestore, 'referralCodes', upperCode);
    const referralCodeDoc = await getDoc(referralCodeRef);
    
    if (!referralCodeDoc.exists()) {
      return { success: false, message: 'Invalid referral code' };
    }
    
    const referrerId = referralCodeDoc.data().userId;
    
    if (referrerId === user.uid) {
      return { success: false, message: 'You cannot use your own referral code' };
    }
    
    // Award tokens to referrer
    const rewardAmount = await getReferralRewardAmount();
    const referrerTokenRef = doc(firestore, 'users', referrerId, 'tokens', 'balance');
    const referrerTokenDoc = await getDoc(referrerTokenRef);
    
    await updateDoc(referrerTokenRef, {
      balance: increment(rewardAmount),
      totalEarned: increment(rewardAmount),
      referralCount: increment(1),
      referredUsers: [...(referrerTokenDoc.exists() ? (referrerTokenDoc.data().referredUsers || []) : []), user.uid],
      updatedAt: serverTimestamp(),
    });
    
    // Update user's referredBy
    await updateDoc(userTokenRef, {
      referredBy: referrerId,
      updatedAt: serverTimestamp(),
    });
    
    // Create referral record
    await addDoc(collection(firestore, 'referrals'), {
      referrerId,
      referredUserId: user.uid,
      referredUserEmail: user.email || '',
      referralCode: upperCode,
      tokensAwarded: rewardAmount,
      status: 'completed',
      createdAt: serverTimestamp(),
      completedAt: serverTimestamp(),
    });
    
    // Log transaction for referrer
    await logTokenTransaction(referrerId, {
      type: 'referral',
      amount: rewardAmount,
      balanceAfter: 0, // Will be updated
      description: `Referral reward for inviting ${user.email || 'a user'}`,
      metadata: { referredUserId: user.uid, referralCode: upperCode },
    });
    
    return { success: true, message: `Referral code applied! ${formatTokens(rewardAmount)} tokens awarded to your referrer.` };
  } catch (error) {
    console.error('Error applying referral code:', error);
    return { success: false, message: 'Failed to apply referral code' };
  }
}

/**
 * Format token count for display
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * Clear token cache
 */
export function clearTokenCache(): void {
  cachedBalance = null;
  cacheTimestamp = 0;
  cachedFullData = null;
  fullDataTimestamp = 0;
}
