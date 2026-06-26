import type { CasaProntaPayload } from '../shared/types'

/**
 * Preenchimento completo do formulário Casa Pronta (PrePasso1.jsp).
 *
 * Cobre:
 *  - Campos de texto, textarea, radios (síncrono)
 *  - Selects simples: unid. medida, destino, tipo_negocio, moeda (por texto)
 *  - Multi-vendedor / multi-comprador (mostra `#vendedorN` / `#compradorN`
 *    que o JSP já renderiza escondidos com classe `.hide`)
 *  - Cascading selects Distrito → Concelho → Freguesia (dispara `change`
 *    para que o inline `onchange="changeDistrito()"` da página faça o AJAX,
 *    depois faz polling até o próximo select estar populado)
 *
 * Tolerante a campos em falta: regista warnings mas não lança.
 */

export interface FillResult {
  filled: string[]
  missing: string[]
  warnings: string[]
}

// ---------- helpers síncronos ----------

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\s+/g, ' ')
    .trim()
}

function setTextInput(id: string, value: string | undefined | null, result: FillResult): void {
  const el = document.getElementById(id) as HTMLInputElement | null
  if (!el) {
    result.missing.push(id)
    return
  }
  el.value = value ?? ''
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  result.filled.push(id)
}

function setTextarea(id: string, value: string | undefined | null, result: FillResult): void {
  const el = document.getElementById(id) as HTMLTextAreaElement | null
  if (!el) {
    result.missing.push(id)
    return
  }
  el.value = value ?? ''
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  result.filled.push(id)
}

function setRadioByName(name: string, value: string, result: FillResult): void {
  const radios = document.querySelectorAll<HTMLInputElement>(
    `input[type="radio"][name="${name}"]`
  )
  if (radios.length === 0) {
    result.missing.push(`radio:${name}`)
    return
  }
  let found = false
  for (const r of radios) {
    if (r.value === value) {
      r.checked = true
      r.dispatchEvent(new Event('change', { bubbles: true }))
      found = true
    }
  }
  if (found) result.filled.push(`radio:${name}=${value}`)
  else result.warnings.push(`Radio "${name}" sem option value="${value}"`)
}

/**
 * Seleciona uma option de um <select> comparando pelo texto visível.
 * Match normalizado (case-insensitive, sem acentos) e ignora o placeholder.
 * Dispara `change` para que o inline onchange da página corra.
 */
function setSelectByText(
  id: string,
  text: string | undefined | null,
  result: FillResult
): boolean {
  if (!text) return false
  const el = document.getElementById(id) as HTMLSelectElement | null
  if (!el) {
    result.missing.push(id)
    return false
  }
  const target = normalizeText(text)
  for (const opt of Array.from(el.options)) {
    if (!opt.value) continue // ignora placeholder "--escolha--"
    if (normalizeText(opt.textContent ?? '') === target) {
      el.value = opt.value
      el.dispatchEvent(new Event('change', { bubbles: true }))
      result.filled.push(`select:${id}=${opt.value}`)
      return true
    }
  }
  // Fallback: match por prefixo (freguesias por vezes têm sufixos longos)
  for (const opt of Array.from(el.options)) {
    if (!opt.value) continue
    const optNorm = normalizeText(opt.textContent ?? '')
    if (optNorm.startsWith(target) || target.startsWith(optNorm)) {
      el.value = opt.value
      el.dispatchEvent(new Event('change', { bubbles: true }))
      result.filled.push(`select:${id}=${opt.value} (fallback)`)
      result.warnings.push(
        `Select "${id}": usado fallback para "${text}" → "${opt.textContent?.trim()}"`
      )
      return true
    }
  }
  result.warnings.push(`Select "${id}": nenhuma option corresponde a "${text}"`)
  return false
}

/**
 * Mostra uma linha adicional de vendedor/comprador (o JSP pré-renderiza
 * todas as 11 escondidas com classe `.hide`).
 */
function showParteRow(tipo: 'vendedor' | 'comprador', index: number): boolean {
  const el = document.getElementById(`${tipo}${index}`)
  if (!el) return false
  el.classList.remove('hide')
  el.style.display = ''
  return true
}

// ---------- helpers assíncronos (cascading) ----------

/**
 * Espera que um <select> tenha pelo menos `minOptions` opções reais (sem
 * contar placeholder com value vazio). Necessário para os cascading
 * Distrito → Concelho → Freguesia, que são populados por AJAX.
 */
async function waitForOptionsLoaded(
  selectId: string,
  minOptions = 1,
  timeoutMs = 5000
): Promise<boolean> {
  const start = Date.now()
  return new Promise((resolve) => {
    const check = () => {
      const el = document.getElementById(selectId) as HTMLSelectElement | null
      if (el) {
        const realOptions = Array.from(el.options).filter((o) => o.value !== '').length
        if (realOptions >= minOptions) {
          resolve(true)
          return
        }
      }
      if (Date.now() - start > timeoutMs) {
        resolve(false)
        return
      }
      setTimeout(check, 100)
    }
    check()
  })
}

/**
 * Sequência encadeada: Distrito → espera → Concelho → espera → Freguesia.
 * Depende de o Distrito estar já populado à entrada (é estático no JSP).
 */
async function fillCascadingLocation(
  distrito: string,
  concelho: string,
  freguesia: string,
  result: FillResult
): Promise<void> {
  // 1) Distrito — já deve ter opções quando a página abre
  const distritoLoaded = await waitForOptionsLoaded('distrito', 1, 3000)
  if (!distritoLoaded) {
    result.warnings.push('Select `distrito` não carregou (timeout).')
    return
  }
  if (!setSelectByText('distrito', distrito, result)) return

  // 2) Concelho — aguarda AJAX despoletado pelo change do distrito
  const concelhoLoaded = await waitForOptionsLoaded('concelho', 1, 5000)
  if (!concelhoLoaded) {
    result.warnings.push('Concelhos não carregaram após seleccionar Distrito (AJAX timeout).')
    return
  }
  if (!setSelectByText('concelho', concelho, result)) return

  // 3) Freguesia — aguarda segundo AJAX
  const freguesiaLoaded = await waitForOptionsLoaded('freguesia', 1, 5000)
  if (!freguesiaLoaded) {
    result.warnings.push('Freguesias não carregaram após seleccionar Concelho (AJAX timeout).')
    return
  }
  setSelectByText('freguesia', freguesia, result)
}

// ---------- conversões ----------

/** Converte ISO (YYYY-MM-DD) para DD-MM-AAAA exigido pelo Casa Pronta. */
export function isoToDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}-${m}-${y}`
}

function formatPrecoForInput(preco: number): string {
  return String(Math.round(preco))
}

/** Mapeia a key do payload para o texto que aparece no select `destino`. */
function destinoText(key: string): string {
  const map: Record<string, string> = {
    habitacao: 'Habitação',
    comercio: 'Comércio',
    industria: 'Indústria',
    outro: 'Outro',
  }
  return map[key] ?? key
}

function tipoNegocioText(key: string): string {
  const map: Record<string, string> = {
    compra_venda: 'Compra e venda',
    dacao: 'Dação em Pagamento',
    permuta: 'Permuta',
    doacao: 'Doação',
  }
  return map[key] ?? key
}

function unidadeMedidaText(key: string): string {
  const map: Record<string, string> = {
    m2: 'Metros',
    hectares: 'Hectares',
  }
  return map[key] ?? 'Metros'
}

// ---------- entry point ----------

export async function fillCasaProntaForm(payload: CasaProntaPayload): Promise<FillResult> {
  const result: FillResult = { filled: [], missing: [], warnings: [] }

  // --- Dados do Requerente ---
  setTextInput('requerente', payload.requerente.nome, result)
  setTextInput('nif', payload.requerente.nif, result)
  setTextInput('email', payload.requerente.email, result)
  setTextInput('telefone', payload.requerente.telefone, result)
  setTextInput('morada_requerente', payload.requerente.endereco, result)

  // --- Vendedores (1 a N, máx 11) ---
  payload.vendedores.slice(0, 11).forEach((v, i) => {
    const idx = i + 1
    if (idx > 1) showParteRow('vendedor', idx)
    setTextInput(`nome_firma${idx}V`, v.nome, result)
    setTextInput(`nif${idx}V`, v.nif, result)
  })
  const countVendEl = document.getElementById('countvendedores') as HTMLInputElement | null
  if (countVendEl) countVendEl.value = String(Math.min(payload.vendedores.length, 11))
  if (payload.vendedores.length > 11) {
    result.warnings.push(`Mais de 11 vendedores no payload; só os primeiros 11 foram inseridos.`)
  }

  // --- Compradores (1 a N, máx 11) ---
  payload.compradores.slice(0, 11).forEach((c, i) => {
    const idx = i + 1
    if (idx > 1) showParteRow('comprador', idx)
    setTextInput(`nome_firma${idx}C`, c.nome, result)
    setTextInput(`nif${idx}C`, c.nif, result)
  })
  const countCompEl = document.getElementById('countcompradores') as HTMLInputElement | null
  if (countCompEl) countCompEl.value = String(Math.min(payload.compradores.length, 11))
  if (payload.compradores.length > 11) {
    result.warnings.push(`Mais de 11 compradores no payload; só os primeiros 11 foram inseridos.`)
  }

  // --- Identificação do Imóvel ---
  setTextInput('ficha', payload.imovel.descricao_ficha, result)
  setTextInput('artigo', payload.imovel.artigo_matricial, result)
  if (payload.imovel.quota_parte) setTextInput('quota_parte', payload.imovel.quota_parte, result)
  if (payload.imovel.fracao_autonoma)
    setTextInput('fraccao', payload.imovel.fracao_autonoma, result)

  setTextInput('imo_area2', String(payload.imovel.area_bruta_privativa), result)
  setSelectByText('imo_areamedida2', unidadeMedidaText(payload.imovel.unidade_medida), result)

  if (payload.imovel.area_total != null) {
    setTextInput('imo_area1', String(payload.imovel.area_total), result)
    setSelectByText(
      'imo_areamedida1',
      unidadeMedidaText(payload.imovel.unidade_medida_total ?? payload.imovel.unidade_medida),
      result
    )
  }

  setRadioByName('arrendado', payload.imovel.arrendado ? 'Y' : 'N', result)
  setSelectByText('destino', destinoText(payload.imovel.destino), result)

  // --- Localização ---
  setTextInput('morada', payload.imovel.endereco, result)

  // Cascading selects (Distrito → Concelho → Freguesia) — assíncrono
  await fillCascadingLocation(
    payload.imovel.distrito,
    payload.imovel.concelho,
    payload.imovel.freguesia,
    result
  )

  // --- Dados da Transmissão ---
  setSelectByText('tipo_negocio', tipoNegocioText(payload.transmissao.tipo_negocio), result)
  setTextInput('valor', formatPrecoForInput(payload.transmissao.preco), result)
  setSelectByText('moeda', 'Euros', result)
  setTextInput('data_previsivel', isoToDDMMYYYY(payload.transmissao.data_prevista), result)
  if (payload.transmissao.observacoes) {
    setTextarea('observacoes', payload.transmissao.observacoes, result)
  }

  return result
}
