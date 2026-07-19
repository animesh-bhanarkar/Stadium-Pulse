/**
 * Shared utility for retrying asynchronous operations with backoff.
 * 
 * @param {Function} asyncFn - The async function to execute.
 * @param {Object} options - Configuration options.
 * @param {number} [options.maxAttempts=3] - Maximum number of attempts.
 * @param {number[]} [options.delays=[1000, 2000]] - Array of delays in milliseconds before each retry.
 * @param {Function} options.retryableCheck - Function that receives the error and returns true if it should be retried.
 * @param {string} options.logPrefix - Prefix for the error log header (e.g., 'Chat API Error').
 * @param {string} [options.logDivider='================================='] - Divider string for the bottom of the error log.
 * @returns {Promise<any>} The result of asyncFn.
 * @throws {Error} The last error encountered if all retries fail or a non-retryable error occurs.
 */
async function retryWithBackoff(asyncFn, {
    maxAttempts = 3,
    delays = [1000, 2000],
    retryableCheck,
    logPrefix,
    logDivider = '================================='
}) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await asyncFn(); // success
        } catch (error) {
            lastError = error;
            const errMsg = error?.message || String(error);
            const errStatus = error?.status ?? error?.statusCode ?? error?.code ?? 'N/A';
            let errJson;
            try { errJson = JSON.stringify(error, Object.getOwnPropertyNames(error), 2); }
            catch (_) { errJson = String(error); }

            console.error(`=== ${logPrefix} (attempt ${attempt}/${maxAttempts}) ===`);
            console.error("status/code:", errStatus);
            console.error("message:", errMsg);
            console.error("full error object:", errJson);
            console.error(logDivider);

            // Check if we should retry
            if (!retryableCheck(error) || attempt === maxAttempts) {
                throw error; // throw to be caught by the route handler
            }

            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, delays[attempt - 1] || 1000));
        }
    }
    throw lastError; // Fallback, shouldn't reach here due to attempt === maxAttempts check above
}

module.exports = { retryWithBackoff };
