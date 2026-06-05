export {
  computeFlexibleBadges,
  isStrictPass,
} from './compute-flexible-badges'

export { computeBuyerMismatches } from './compute-buyer-mismatches'
export type { SellerProfile, BuyerProfile } from './compute-buyer-mismatches'

export { computeHardMismatches } from './compute-hard-mismatches'
export type { BuyerHardWishes, PropertyHardFacts } from './compute-hard-mismatches'

export type {
  BadgeType,
  GeoSource,
  MatchBadge,
  MatchResult,
  NegocioMatchInput,
  PropertyMatchInput,
} from './types'

export { adminAreaLabel } from './zones'

export type {
  AdminAreaType,
  AdminAreaSearchResult,
  NegocioZone,
  NegocioZoneAdmin,
  NegocioZonePolygon,
} from './zones'
