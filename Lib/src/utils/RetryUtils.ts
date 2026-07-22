import { CrowniclesLogger } from "../logs/CrowniclesLogger";
import { Millisecond } from "../types/TimeTypes";

export interface RetryOptions {

	/**
	 * Maximum number of attempts (including the first one) before giving up.
	 */
	maxAttempts: number;

	/**
	 * Base delay used for the exponential backoff (delay of the first retry).
	 */
	baseDelay: Millisecond;

	/**
	 * Upper bound applied to the exponential backoff delay.
	 */
	maxDelay: Millisecond;

	/**
	 * Human-readable name of the operation, used in retry logs.
	 */
	operationName: string;
}

/**
 * Execute an async operation, retrying it with exponential backoff when it throws.
 * Every failed attempt (except the last) is logged as a warning and followed by a capped backoff delay.
 * If all attempts fail, the last error is rethrown so the caller can handle it.
 * @param operation - The async operation to execute
 * @param options - Retry configuration
 */
export async function retryWithBackoff<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
		try {
			return await operation();
		}
		catch (error) {
			lastError = error;
			if (attempt === options.maxAttempts) {
				break;
			}
			const delay = Math.min(options.baseDelay * 2 ** (attempt - 1), options.maxDelay);
			CrowniclesLogger.warn(`${options.operationName} failed (attempt ${attempt}/${options.maxAttempts}), retrying in ${delay}ms`, {
				reason: error instanceof Error ? error.message : String(error)
			});
			await new Promise(resolve => setTimeout(resolve, delay));
		}
	}
	throw lastError;
}
