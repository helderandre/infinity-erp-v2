export function normalizeVariableKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_\-\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}
