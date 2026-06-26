import { isCasaProntaPreferenciasForm, isPrePasso1Url } from './detectors'
import { injectMubeButton } from './injectButton'
import { fetchNegocios, fetchNegocioPayload } from '../shared/negocios'
import type { CasaProntaPayload, NegocioResumo } from '../shared/types'

console.log('[MUBE] content script carregado em', location.href)

async function getActivePayload(): Promise<{
  payload: CasaProntaPayload | null
  negocio: NegocioResumo | null
}> {
  const res = await chrome.storage.local.get('mube.activeNegocioId')
  const id = typeof res['mube.activeNegocioId'] === 'string' ? res['mube.activeNegocioId'] : null
  if (!id) return { payload: null, negocio: null }

  const [payload, list] = await Promise.all([fetchNegocioPayload(id), fetchNegocios()])
  const negocio = list.find((n) => n.id === id) ?? null
  return { payload, negocio }
}

function tryInject() {
  if (isCasaProntaPreferenciasForm()) {
    injectMubeButton({ getActivePayload })
    return true
  }
  return false
}

function init() {
  // Só vale a pena tentar se o URL encaixa — evita observer em páginas irrelevantes
  if (!isPrePasso1Url()) return

  if (tryInject()) return

  // Fallback: espera que o form apareça no DOM (caso o content script corra
  // antes do JSP terminar de renderizar)
  const observer = new MutationObserver(() => {
    if (tryInject()) {
      observer.disconnect()
    }
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })

  // Defesa: desiste após 10s
  setTimeout(() => observer.disconnect(), 10_000)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
  init()
}
