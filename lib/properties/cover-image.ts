// Single source of truth for "which photo represents this property?".
// Used by the list (table + cards), property card thumbnail, edit sheet
// header, public page hero, and any share-preview that needs an image.
//
// Priority:
//   1. The photo with `is_cover = true`
//   2. Otherwise, the photo with the lowest `order_index` (i.e. the user
//      dragged it to the front in the gallery)
//   3. Otherwise, the first item in the array (fallback)

export interface MinimalMedia {
  id?: string
  url?: string | null
  is_cover?: boolean | null
  order_index?: number | null
  media_type?: string | null
}

/** Return the chosen cover media or `undefined` when there are no photos. */
export function pickCoverMedia<T extends MinimalMedia>(
  media: T[] | null | undefined,
): T | undefined {
  if (!media || media.length === 0) return undefined
  const explicit = media.find((m) => m.is_cover)
  if (explicit) return explicit
  return [...media].sort(
    (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
  )[0]
}

/** Return only the URL — convenience for places that don't need the row. */
export function pickCoverImageUrl(
  media: MinimalMedia[] | null | undefined,
): string | undefined {
  return pickCoverMedia(media)?.url ?? undefined
}
