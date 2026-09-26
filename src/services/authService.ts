/**
 * Auth Service (Mock)
 *
 * Simulates Developer A's authenticateWorker() and isSessionActive() functions.
 * Swap this file for the real implementation when Developer A's modules are ready.
 */

// ─── Mock credentials ───────────────────────────────────────────────
const MOCK_WORKER_PIN = '1234';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60_000; // 60 seconds

// ─── In-memory state ─────────────────────────────────────────────────
let failedAttempts = 0;
let lockoutUntil: number | null = null;
let lastActivityTimestamp = Date.now();

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5-minute inactivity auto-lock

// ─── Exposed Functions ───────────────────────────────────────────────

/**
 * Authenticate a health worker by their 4-digit PIN.
 * Returns { success, attemptsRemaining, lockoutSeconds }
 */
export function authenticateWorker(pin: string): {
  success: boolean;
  attemptsRemaining: number;
  lockoutSeconds: number;
} {
  // Check lockout
  if (lockoutUntil !== null) {
    const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
    if (remaining > 0) {
      return { success: false, attemptsRemaining: 0, lockoutSeconds: remaining };
    }
    // Lockout expired — reset
    lockoutUntil = null;
    failedAttempts = 0;
  }

  // Check PIN
  if (pin === MOCK_WORKER_PIN) {
    failedAttempts = 0;
    lastActivityTimestamp = Date.now();
    return { success: true, attemptsRemaining: MAX_ATTEMPTS, lockoutSeconds: 0 };
  }

  // Failed attempt
  failedAttempts += 1;
  const attemptsRemaining = MAX_ATTEMPTS - failedAttempts;

  if (failedAttempts >= MAX_ATTEMPTS) {
    lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
    return {
      success: false,
      attemptsRemaining: 0,
      lockoutSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
    };
  }

  return { success: false, attemptsRemaining, lockoutSeconds: 0 };
}

/**
 * Check if the current session is still active (not timed out due to inactivity).
 */
export function isSessionActive(): boolean {
  return Date.now() - lastActivityTimestamp < SESSION_TIMEOUT_MS;
}

/**
 * Touch the session to reset the inactivity timer.
 */
export function touchSession(): void {
  lastActivityTimestamp = Date.now();
}

/**
 * Reset auth state (for logout).
 */
export function resetAuth(): void {
  failedAttempts = 0;
  lockoutUntil = null;
  lastActivityTimestamp = 0;
}
