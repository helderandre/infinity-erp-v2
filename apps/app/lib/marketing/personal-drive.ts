/**
 * Per-consultor personal-drive quota for `marketing_resources` rows
 * with scope='personal'.
 *
 * Enforced server-side in /api/marketing/recursos/upload before R2 PUT.
 * Surfaced client-side in the personal drive UI via /api/marketing/recursos/usage.
 */
export const PERSONAL_DRIVE_LIMIT_BYTES = 500 * 1024 * 1024 // 500 MB
