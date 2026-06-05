const EMAIL_RE =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

export function isValidEmail(input: string): boolean {
  if (!input) return false
  return EMAIL_RE.test(input.trim())
}
