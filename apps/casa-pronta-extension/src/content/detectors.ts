/**
 * Detecta se estamos numa página do Casa Pronta que contém o formulário
 * de Direito de Preferência (Passo 1 do fluxo de submissão de anúncio).
 *
 * A heurística combina URL + presença de elementos chave. É resiliente a
 * pequenas variações de path e funciona em navegação directa ou após redirect.
 */

export function isCasaProntaPreferenciasHost(): boolean {
  return location.hostname === 'www.casapronta.pt' || location.hostname === 'casapronta.pt'
}

export function isPrePasso1Url(): boolean {
  return /\/CasaPronta\/preferencias\/PrePasso1\.jsp/i.test(location.pathname)
}

/**
 * Verifica se o DOM contém os elementos esperados do formulário de preferência.
 * Usa os `id`/`name` extraídos directamente do HTML real do Casa Pronta.
 */
export function hasPrePasso1Form(): boolean {
  const form = document.forms.namedItem('init') as HTMLFormElement | null
  if (!form) return false
  return !!(
    document.getElementById('requerente') &&
    document.getElementById('nome_firma1V') &&
    document.getElementById('nome_firma1C') &&
    document.getElementById('distrito')
  )
}

/** Combinação final: URL + form presente. */
export function isCasaProntaPreferenciasForm(): boolean {
  return isCasaProntaPreferenciasHost() && isPrePasso1Url() && hasPrePasso1Form()
}
