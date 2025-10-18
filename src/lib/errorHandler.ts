/**
 * Enhanced Error Handler for Website
 * Provides user-friendly error messages and retry logic
 * Based on mobile app implementation
 */

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public provider: string,
    public retryable: boolean = false,
    public userMessage?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Map HTTP status codes to user-friendly messages
 */
function getStatusMessage(statusCode: number, provider: string): string {
  switch (statusCode) {
    case 400:
      return 'Invalid request. Please check your input and try again.';
    case 401:
      return 'Authentication failed. Please check your API key in settings.';
    case 403:
      return 'Access denied. Your API key may not have permission for this operation.';
    case 404:
      return 'Model not found. The selected model may not be available.';
    case 408:
      return 'Request timeout. Please try again.';
    case 429:
      return 'Rate limit exceeded. Please wait a moment and try again.';
    case 500:
      return `${provider} server error. Please try again in a moment.`;
    case 502:
      return `${provider} is temporarily unavailable. Please try again.`;
    case 503:
      return `${provider} is under maintenance. Please try again later.`;
    case 504:
      return 'Gateway timeout. The request took too long. Please try again.';
    default:
      return `An error occurred (${statusCode}). Please try again.`;
  }
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false;

  // Network errors are retryable
  if (error.name === 'NetworkError' || error.message?.includes('network')) {
    return true;
  }

  // Timeout errors are retryable
  if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
    return true;
  }

  // Check status code
  if (error.statusCode || error.status) {
    const code = error.statusCode || error.status;
    // Retryable status codes
    return [408, 429, 500, 502, 503, 504].includes(code);
  }

  return false;
}

/**
 * Handle API errors and convert to APIError
 */
export function handleAPIError(error: any, provider: string): APIError {
  // Already an APIError
  if (error instanceof APIError) {
    return error;
  }

  // Abort error
  if (error.name === 'AbortError') {
    return new APIError(
      'Request was cancelled',
      0,
      provider,
      false,
      'Request cancelled'
    );
  }

  // Network error
  if (error.name === 'NetworkError' || error.message?.includes('Failed to fetch')) {
    return new APIError(
      'Network error',
      0,
      provider,
      true,
      'Network connection failed. Please check your internet connection.'
    );
  }

  // Timeout error
  if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
    return new APIError(
      'Request timeout',
      408,
      provider,
      true,
      'Request timed out. Please try again.'
    );
  }

  // HTTP error with status code
  if (error.statusCode || error.status) {
    const statusCode = error.statusCode || error.status;
    const retryable = isRetryableError(error);
    const userMessage = getStatusMessage(statusCode, provider);

    return new APIError(
      error.message || `HTTP ${statusCode}`,
      statusCode,
      provider,
      retryable,
      userMessage
    );
  }

  // Generic error
  return new APIError(
    error.message || 'Unknown error',
    500,
    provider,
    false,
    'An unexpected error occurred. Please try again.'
  );
}

/**
 * Parse error from fetch response
 */
export async function parseErrorResponse(response: Response, provider: string): Promise<APIError> {
  let errorMessage = '';
  
  try {
    const text = await response.text();
    
    // Try to parse as JSON
    try {
      const json = JSON.parse(text);
      errorMessage = json.error?.message || json.message || text;
    } catch {
      errorMessage = text;
    }
  } catch {
    errorMessage = response.statusText;
  }

  const retryable = isRetryableError({ statusCode: response.status });
  const userMessage = getStatusMessage(response.status, provider);

  return new APIError(
    errorMessage || `HTTP ${response.status}`,
    response.status,
    provider,
    retryable,
    userMessage
  );
}

/**
 * Validate messages before sending to API
 */
export function validateMessages(messages: any[]): { valid: boolean; error?: string } {
  if (!Array.isArray(messages)) {
    return { valid: false, error: 'Messages must be an array' };
  }

  if (messages.length === 0) {
    return { valid: false, error: 'Messages array cannot be empty' };
  }

  if (messages.length > 100) {
    return { valid: false, error: 'Too many messages (max 100)' };
  }

  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') {
      return { valid: false, error: 'Invalid message format' };
    }

    if (!msg.role || !msg.content) {
      return { valid: false, error: 'Message must have role and content' };
    }

    if (typeof msg.content === 'string' && msg.content.length > 100000) {
      return { valid: false, error: 'Message content too long (max 100k chars)' };
    }
  }

  return { valid: true };
}

/**
 * Sanitize error message for display
 */
export function sanitizeErrorMessage(error: any): string {
  if (error instanceof APIError && error.userMessage) {
    return error.userMessage;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error?.message) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

/**
 * Log error to console with context
 */
export function logError(error: any, context: string): void {
  console.error(`[${context}] Error:`, {
    message: error.message,
    statusCode: error.statusCode || error.status,
    provider: error.provider,
    retryable: error.retryable,
    stack: error.stack,
  });
}
