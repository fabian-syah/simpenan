// ============================================================
// Retry Utility — Exponential backoff with jitter
// ============================================================

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableStatuses: number[];
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

function isRetryableError(error: any, retryableStatuses: number[]): boolean {
  // Network errors (no status)
  if (!error.status && (error.message?.includes('network') || error.message?.includes('Network') || error.message?.includes('Failed to fetch') || error.name === 'TypeError')) {
    return true;
  }
  // HTTP status based
  if (error.status && retryableStatuses.includes(error.status)) {
    return true;
  }
  return false;
}

function getDelay(attempt: number, options: RetryOptions): number {
  const delay = Math.min(
    options.baseDelay * Math.pow(options.backoffMultiplier, attempt),
    options.maxDelay
  );
  // Add jitter: random 0-50% of delay
  return delay + Math.random() * delay * 0.5;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (attempt >= opts.maxRetries || !isRetryableError(error, opts.retryableStatuses)) {
        throw error;
      }
      const delay = getDelay(attempt, opts);
      opts.onRetry?.(attempt + 1, error);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError;
}
