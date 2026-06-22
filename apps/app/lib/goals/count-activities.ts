type ActivityLike = { activity_type?: string | null; quantity?: number | null }

/**
 * Count activities of a given type as EFFORT, summing `quantity`.
 *
 * A manually-declared row like "20 calls today" is stored as a single row with
 * quantity=20 — counting rows (`.filter().length`) would read it as 1, which is
 * why different goals screens disagreed. The call-outcome flow always writes
 * quantity=1, so this only changes bulk manual declarations.
 */
export function countByType(acts: ActivityLike[] | null | undefined, type: string): number {
  return (acts ?? []).reduce(
    (sum, a) => (a.activity_type === type ? sum + (a.quantity ?? 1) : sum),
    0,
  )
}

/** Total effort across all activity types, summing `quantity`. */
export function sumQuantity(acts: ActivityLike[] | null | undefined): number {
  return (acts ?? []).reduce((sum, a) => sum + (a.quantity ?? 1), 0)
}
