/**
 * User Name Context Service (Website)
 * Detects when user asks about their name and provides their full name from Google account
 */

import { auth } from './firebase';

/**
 * Detect if a user prompt is asking about their name
 */
export function isUserNameQuery(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  
  const lower = text.toLowerCase().trim();
  
  // Common name question patterns
  const patterns = [
    // Direct questions
    /\b(what|whats|what's)\s+(is\s+)?(my\s+)?(full\s+)?name\b/i,
    /\b(what|whats|what's)\s+(do\s+you\s+)?call\s+me\b/i,
    /\btell\s+me\s+(my\s+)?(full\s+)?name\b/i,
    
    // Who am I
    /\bwho\s+am\s+i\b/i,
    /\bwhat'?s\s+my\s+name\b/i,
    /\bdo\s+you\s+know\s+(my\s+)?name\b/i,
    /\bwhat\s+is\s+my\s+name\b/i,
    
    // Remember my name
    /\bremember\s+my\s+name\b/i,
    /\bmy\s+name\s+is\b/i, // When asking "what is my name" not stating it
    
    // Variations
    /\bwho\s+is\s+the\s+user\b/i,
    /\bwhat\s+do\s+i\s+go\s+by\b/i,
  ];
  
  // Must contain "my" or "i" or "user" to avoid false positives
  const hasPersonalReference = /\b(my|i|me|user)\b/i.test(lower);
  
  // Check if asking about name
  const isNameQuestion = patterns.some(pattern => pattern.test(lower));
  
  // Exclude if user is STATING their name (not asking)
  const isStatingName = /\bmy\s+name\s+is\s+[A-Z]/i.test(text);
  
  return isNameQuestion && hasPersonalReference && !isStatingName;
}

/**
 * Get user's full name from Firebase Auth (Google Sign-In)
 */
export function getUserFullName(): string | null {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    
    // Get display name from Google Sign-In
    const displayName = user.displayName;
    if (displayName && displayName.trim()) {
      return displayName.trim();
    }
    
    // Fallback to email username if no display name
    const email = user.email;
    if (email) {
      const username = email.split('@')[0];
      // Capitalize first letter
      return username.charAt(0).toUpperCase() + username.slice(1);
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user name:', error);
    return null;
  }
}

/**
 * Get formatted user name context
 */
export function getUserNameContext(): string | null {
  const fullName = getUserFullName();
  if (!fullName) return null;
  
  return `User's Full Name: ${fullName}`;
}

/**
 * Create a system message with user name context
 */
export function createUserNameSystemMessage(): { role: 'system'; content: string } | null {
  const context = getUserNameContext();
  if (!context) return null;
  
  return {
    role: 'system',
    content: `IMPORTANT: The user is asking about their name. Here is their information:

${context}

Please use this information to answer their question accurately. This is the name they used when signing in with Google.`,
  };
}

/**
 * Check if we should inject user name context
 * Returns the system message if needed, null otherwise
 */
export function maybeInjectUserNameContext(userMessage: string): { role: 'system'; content: string } | null {
  if (!isUserNameQuery(userMessage)) return null;
  return createUserNameSystemMessage();
}
