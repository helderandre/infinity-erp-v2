'use client'

import { useEffect, useState } from 'react'
import {
  mapNegocioContactsToParticipants,
  type PrefillParticipant,
} from '@/lib/negocios/prefill-from-negocio'

/**
 * Contactos associados (não-titulares) de uma oportunidade, prontos para
 * semear proprietários (angariação) ou clientes (fecho). Devolve um array
 * vazio enquanto carrega / quando não há associações.
 */
export function useNegocioParticipants(negocioId: string | null | undefined): PrefillParticipant[] {
  const [participants, setParticipants] = useState<PrefillParticipant[]>([])

  useEffect(() => {
    if (!negocioId) {
      setParticipants([])
      return
    }
    let cancelled = false
    fetch(`/api/crm/negocios/${negocioId}/contactos`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => {
        if (!cancelled) setParticipants(mapNegocioContactsToParticipants(j.data))
      })
      .catch(() => {
        if (!cancelled) setParticipants([])
      })
    return () => {
      cancelled = true
    }
  }, [negocioId])

  return participants
}
