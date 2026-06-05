/**
 * Hook helpers para geocodificar imóveis automaticamente.
 *
 * Usados pelos endpoints POST/PUT de `/api/properties` quando o user
 * grava sem definir lat/lng no mapa picker.
 */

import { geocodeProperty } from './mapbox'

interface PropertyAddressLike {
  address_street?: string | null
  postal_code?: string | null
  city?: string | null
  zone?: string | null
  latitude?: number | null
  longitude?: number | null
}

/**
 * Geocodifica e injecta lat/lng no objecto se:
 *   - lat OU lng estão null/undefined
 *   - Há pelo menos um campo de morada utilizável
 *
 * Mutação in-place do `target` para preservar o resto dos campos.
 * Devolve `true` se geocodificou com sucesso, `false` se não foi possível.
 */
export async function fillCoordsIfMissing(target: PropertyAddressLike): Promise<boolean> {
  const hasCoords = target.latitude != null && target.longitude != null
  if (hasCoords) return false

  const result = await geocodeProperty(target)
  if (!result) return false

  target.latitude = result.latitude
  target.longitude = result.longitude
  return true
}

/**
 * Versão fire-and-forget para PUT: após o save, se a row resultante
 * não tem coords mas tem morada, geocodifica e patch.
 *
 * Não bloqueia a resposta ao cliente.
 */
export function geocodeInBackground(
  supabase: { from: (t: string) => any },
  propertyId: string
): void {
  void (async () => {
    try {
      const { data: row } = await supabase
        .from('dev_properties')
        .select('id, latitude, longitude, address_street, postal_code, city, zone')
        .eq('id', propertyId)
        .single()

      if (!row) return
      if (row.latitude != null && row.longitude != null) return

      const result = await geocodeProperty({
        address_street: row.address_street,
        postal_code: row.postal_code,
        city: row.city,
        zone: row.zone,
      })
      if (!result) return

      await supabase
        .from('dev_properties')
        .update({ latitude: result.latitude, longitude: result.longitude })
        .eq('id', propertyId)
    } catch (err) {
      console.warn('[geocoding] Background geocoding falhou:', err instanceof Error ? err.message : err)
    }
  })()
}
