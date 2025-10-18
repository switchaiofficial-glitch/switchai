/**
 * Model Usage Logger for Website
 * Tracks AI model usage and token consumption
 * Based on mobile app implementation
 */

import { addDoc, collection, doc, getDoc, increment, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, firestore } from './firebase';

export interface UsageLogEntry {
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens: number;
  userId?: string;
  timestamp: any;
  cost?: number;
}

/**
 * Estimate tokens from text (rough approximation)
 * ~4 characters per token on average
 */
export function estimateTokensFromText(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Log model usage to Firestore
 */
export async function logModelUsage(params: {
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens: number;
  userId?: string;
}): Promise<void> {
  try {
    const userId = params.userId || auth.currentUser?.uid;
    if (!userId) return;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Log to user's usage collection
    const usageRef = collection(firestore, 'users', userId, 'usage');
    await addDoc(usageRef, {
      provider: params.provider,
      model: params.model,
      promptTokens: params.promptTokens || 0,
      completionTokens: params.completionTokens || 0,
      totalTokens: params.totalTokens,
      timestamp: serverTimestamp(),
      date: today,
    });

    // Update daily aggregate
    const dailyRef = doc(firestore, 'users', userId, 'usage_daily', today);
    const dailyDoc = await getDoc(dailyRef);

    if (dailyDoc.exists()) {
      await updateDoc(dailyRef, {
        totalTokens: increment(params.totalTokens),
        requestCount: increment(1),
        [`models.${params.model}`]: increment(params.totalTokens),
        [`providers.${params.provider}`]: increment(params.totalTokens),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(dailyRef, {
        date: today,
        totalTokens: params.totalTokens,
        requestCount: 1,
        models: { [params.model]: params.totalTokens },
        providers: { [params.provider]: params.totalTokens },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    console.log(`[Usage] Logged ${params.totalTokens} tokens for ${params.model}`);
  } catch (error) {
    console.error('[Usage] Error logging model usage:', error);
  }
}

/**
 * Increment model usage counter (simplified version)
 */
export async function incrementModelUsage(params: {
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens: number;
  userId?: string;
}): Promise<void> {
  await logModelUsage(params);
}

/**
 * Log OpenAI-style usage (from API response)
 */
export async function logOpenAIStyleUsage(
  provider: string,
  model: string,
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  }
): Promise<void> {
  if (!usage || !usage.total_tokens) return;

  await logModelUsage({
    provider,
    model,
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  });
}

/**
 * Get today's usage for current user
 */
export async function getTodayUsage(): Promise<{
  totalTokens: number;
  requestCount: number;
  models: Record<string, number>;
  providers: Record<string, number>;
} | null> {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return null;

    const today = new Date().toISOString().split('T')[0];
    const dailyRef = doc(firestore, 'users', userId, 'usage_daily', today);
    const dailyDoc = await getDoc(dailyRef);

    if (!dailyDoc.exists()) {
      return {
        totalTokens: 0,
        requestCount: 0,
        models: {},
        providers: {},
      };
    }

    const data = dailyDoc.data();
    return {
      totalTokens: data.totalTokens || 0,
      requestCount: data.requestCount || 0,
      models: data.models || {},
      providers: data.providers || {},
    };
  } catch (error) {
    console.error('[Usage] Error getting today usage:', error);
    return null;
  }
}

/**
 * Estimate cost based on tokens (rough approximation)
 * Costs vary by provider and model
 */
export function estimateCost(tokens: number, provider: string, model: string): number {
  // Rough cost estimates (per 1M tokens)
  const costPer1M: Record<string, number> = {
    'groq': 0.10, // Very cheap
    'openrouter': 0.50, // Varies
    'cerebras': 0.10,
    'mistral': 0.25,
    'google': 0.15,
  };

  const rate = costPer1M[provider.toLowerCase()] || 0.50;
  return (tokens / 1000000) * rate;
}
