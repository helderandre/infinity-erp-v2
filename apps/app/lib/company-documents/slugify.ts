// Slugify a PT-PT label into a URL/DB-safe slug.
// Matches the CHECK constraint `^[a-z0-9-]+$` on company_document_categories.slug.
export function slugifyCategory(input: string): string {
  const combiningMarks = /[̀-ͯ]/g
  return input
    .normalize('NFD')
    .replace(combiningMarks, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}
