// Slugify a PT-PT label into a value that matches the CHECK on
// taxonomy_extras.value: ^[a-z0-9_-]+$.
//
// Strips diacritics (Prédio → predio), lower-cases, collapses non-alphanumerics
// to '_', trims edges, caps at 64 chars.

export function slugifyTaxonomyValue(input: string): string {
  const combiningMarks = /[̀-ͯ]/g
  return input
    .normalize('NFD')
    .replace(combiningMarks, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
}
