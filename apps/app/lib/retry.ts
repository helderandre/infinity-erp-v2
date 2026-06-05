// ============================================================
// retry.ts — Lógica de retry com exponential backoff
// Fase 2 do Sistema de Automações
// ============================================================

export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 300_000, // 5 minutos
  backoffMultiplier: 2,
}

/**
 * Calcula o delay para a próxima tentativa.
 * Exponential backoff + jitter aleatório.
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt)
  const jitter = Math.random() * 1000
  return Math.min(exponentialDelay + jitter, config.maxDelayMs)
}

/**
 * Calcula o timestamp da próxima tentativa.
 */
export function calculateNextRetryAt(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Date {
  const delayMs = calculateRetryDelay(attempt, config)
  return new Date(Date.now() + delayMs)
}
