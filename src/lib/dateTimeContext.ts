/**
 * Date/Time Context Service for Website
 * Detects when user asks about date/time and provides local context
 */

/**
 * Detect if a user prompt is asking about current date, time, or day
 */
export function isDateTimeQuery(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  
  const lower = text.toLowerCase().trim();
  
  const patterns = [
    /\b(what|whats|what's)\s+(is\s+)?(the\s+)?(current\s+|today's\s+|todays\s+)?(date|time|day)\b/i,
    /\b(what|whats|what's)\s+(day|date|time)\s+is\s+it\b/i,
    /\btell\s+me\s+(the\s+)?(current\s+|today's\s+|todays\s+)?(date|time|day)\b/i,
    /\b(what|whats|what's)\s+(is\s+)?today\b/i,
    /\btoday'?s\s+date\b/i,
    /\bcurrent\s+(date|time|day)\b/i,
    /\bwhat\s+time\s+is\s+it\b/i,
    /\bwhat\s+day\s+is\s+it\b/i,
    /\bwhat\s+(is\s+)?the\s+time\b/i,
    /\bcurrent\s+time\b/i,
    /\btime\s+now\b/i,
    /\bright\s+now\b.*\b(time|date|day)\b/i,
    /\btoday\b.*\bdate\b/i,
    /\bdate\b.*\btoday\b/i,
    /\bwhat\s+date\b/i,
    /\bwhat\s+day\b/i,
    /\bday\s+of\s+(the\s+)?week\b/i,
    /\btoday\b.*\bday\b/i,
    /\bwhat\s+month\b/i,
    /\bcurrent\s+month\b/i,
    /\bwhat\s+year\b/i,
    /\bcurrent\s+year\b/i,
  ];
  
  return patterns.some(pattern => pattern.test(lower));
}

/**
 * Get formatted local date and time
 */
export function getLocalDateTimeContext(): string {
  try {
    const now = new Date();
    
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedDate = dateFormatter.format(now);
    
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    const formattedTime = timeFormatter.format(now);
    
    const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now);
    
    const isoDate = now.toISOString().split('T')[0];
    
    const context = `Current Date & Time (User's Local Time):
- Full Date: ${formattedDate}
- Time: ${formattedTime}
- Day of Week: ${dayOfWeek}
- ISO Date: ${isoDate}
- Timezone: ${timezone}
- Unix Timestamp: ${now.getTime()}`;
    
    return context;
  } catch (error) {
    const now = new Date();
    return `Current Date & Time: ${now.toISOString()} (UTC)`;
  }
}

/**
 * Create a system message with date/time context
 */
export function createDateTimeSystemMessage(): { role: 'system'; content: string } {
  const context = getLocalDateTimeContext();
  return {
    role: 'system',
    content: `IMPORTANT: The user is asking about the current date or time. Here is their local date and time information:

${context}

Please use this information to answer their question accurately. Remember that this is the user's LOCAL time in their timezone.`,
  };
}
