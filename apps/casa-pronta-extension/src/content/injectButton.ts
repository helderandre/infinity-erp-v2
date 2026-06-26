import type { CasaProntaPayload, NegocioResumo } from '../shared/types'
import { fillCasaProntaForm } from './formFiller'

const HOST_ID = 'mube-cp-root'

function formatPrice(value: number | null): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

const BASE_CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; }
  .mube-btn {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: linear-gradient(135deg, #A08456, #7A6240);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(122, 98, 64, 0.4);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .mube-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(122, 98, 64, 0.5); }
  .mube-btn:active { transform: translateY(0); }
  .mube-btn .zap { font-size: 16px; }

  .mube-panel {
    position: fixed;
    top: 16px;
    right: 16px;
    width: 420px;
    max-height: calc(100vh - 32px);
    z-index: 2147483647;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: #111827;
  }
  .mube-panel.hidden { display: none; }
  .mube-panel header {
    background: linear-gradient(135deg, #A08456, #7A6240);
    color: #fff;
    padding: 14px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .mube-panel header h2 { margin: 0; font-size: 15px; font-weight: 600; }
  .mube-panel header .close {
    background: rgba(255,255,255,0.15);
    border: none;
    color: #fff;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
  }
  .mube-panel header .close:hover { background: rgba(255,255,255,0.28); }
  .mube-panel .body {
    padding: 14px 18px;
    overflow-y: auto;
    font-size: 13px;
  }
  .mube-panel .empty {
    padding: 24px 18px;
    text-align: center;
    color: #6b7280;
    font-size: 13px;
  }
  .mube-panel .negocio-ref {
    background: #F9F5ED;
    color: #7A6240;
    padding: 6px 10px;
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 12px;
    display: inline-block;
    margin-bottom: 10px;
  }
  .mube-panel section {
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid #f3f4f6;
  }
  .mube-panel section:last-child { border-bottom: none; margin-bottom: 0; }
  .mube-panel h3 {
    margin: 0 0 6px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #6b7280;
    font-weight: 600;
  }
  .mube-panel .row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 3px 0;
  }
  .mube-panel .row .k { color: #6b7280; flex-shrink: 0; }
  .mube-panel .row .v { color: #111827; text-align: right; word-break: break-word; font-weight: 500; }
  .mube-panel footer {
    padding: 12px 18px;
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  .mube-panel footer button {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .mube-panel footer .cancel {
    background: #fff;
    color: #374151;
    border-color: #d1d5db;
  }
  .mube-panel footer .cancel:hover { background: #f3f4f6; }
  .mube-panel footer .fill {
    background: #A08456;
    color: #fff;
  }
  .mube-panel footer .fill:hover { background: #7A6240; }

  .mube-toast {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 2147483647;
    background: #111827;
    color: #fff;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    max-width: 360px;
    animation: slideIn 0.2s ease-out;
  }
  .mube-toast.success { background: #059669; }
  .mube-toast.error { background: #dc2626; }
  .mube-toast .title { font-weight: 600; margin-bottom: 4px; }
  .mube-toast .detail { font-size: 12px; opacity: 0.9; }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
`

function buildSection(title: string, rows: Array<[string, string]>): string {
  return `
    <section>
      <h3>${title}</h3>
      ${rows
        .map(
          ([k, v]) => `
        <div class="row">
          <span class="k">${escapeHtml(k)}</span>
          <span class="v">${escapeHtml(v)}</span>
        </div>`
        )
        .join('')}
    </section>
  `
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderPayloadPreview(payload: CasaProntaPayload, negocio: NegocioResumo | null): string {
  const ref = negocio
    ? `<div class="negocio-ref">${escapeHtml(negocio.referencia)}</div>`
    : ''

  const requerenteRows: Array<[string, string]> = [
    ['Nome', payload.requerente.nome],
    ['NIF/NIPC', payload.requerente.nif],
    ['Email', payload.requerente.email],
    ['Telefone', payload.requerente.telefone],
    ['Endereço', payload.requerente.endereco],
  ]

  const vendedoresRows: Array<[string, string]> = payload.vendedores.flatMap((v, i) => [
    [`V${i + 1} · Nome`, v.nome],
    [`V${i + 1} · NIF`, v.nif],
  ])

  const compradoresRows: Array<[string, string]> = payload.compradores.flatMap((c, i) => [
    [`C${i + 1} · Nome`, c.nome],
    [`C${i + 1} · NIF`, c.nif],
  ])

  const imovelRows: Array<[string, string]> = [
    ['Descrição em Ficha', payload.imovel.descricao_ficha],
    ['Artigo Matricial', payload.imovel.artigo_matricial],
    ['Fracção', payload.imovel.fracao_autonoma ?? '—'],
    ['Área Bruta Priv.', `${payload.imovel.area_bruta_privativa} m²`],
    ['Arrendado', payload.imovel.arrendado ? 'Sim' : 'Não'],
    ['Destino', payload.imovel.destino],
    ['Endereço', payload.imovel.endereco],
    ['Distrito', payload.imovel.distrito],
    ['Concelho', payload.imovel.concelho],
    ['Freguesia', payload.imovel.freguesia],
  ]

  const transmissaoRows: Array<[string, string]> = [
    ['Tipo', payload.transmissao.tipo_negocio.replace('_', ' ')],
    ['Preço', formatPrice(payload.transmissao.preco)],
    ['Data prevista', payload.transmissao.data_prevista],
  ]
  if (payload.transmissao.observacoes) {
    transmissaoRows.push(['Observações', payload.transmissao.observacoes])
  }

  return `
    ${ref}
    ${buildSection('Requerente', requerenteRows)}
    ${buildSection('Vendedores', vendedoresRows)}
    ${buildSection('Compradores', compradoresRows)}
    ${buildSection('Imóvel', imovelRows)}
    ${buildSection('Transmissão', transmissaoRows)}
  `
}

function renderEmptyState(): string {
  return `
    <div class="empty">
      <p><strong>Sem negócio activo.</strong></p>
      <p>Abre a extensão MUBE no canto do browser e escolhe um negócio.</p>
    </div>
  `
}

function showToast(
  shadow: ShadowRoot,
  type: 'success' | 'error' | 'info',
  title: string,
  detail?: string
) {
  const existing = shadow.querySelector('.mube-toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.className = `mube-toast ${type}`
  toast.innerHTML = `
    <div class="title">${escapeHtml(title)}</div>
    ${detail ? `<div class="detail">${escapeHtml(detail)}</div>` : ''}
  `
  shadow.appendChild(toast)
  setTimeout(() => toast.remove(), 5000)
}

interface InjectOptions {
  getActivePayload: () => Promise<{
    payload: CasaProntaPayload | null
    negocio: NegocioResumo | null
  }>
}

export function injectMubeButton(opts: InjectOptions): void {
  // Evita duplicar (defensive: executado em document_idle + observer)
  if (document.getElementById(HOST_ID)) return

  const host = document.createElement('div')
  host.id = HOST_ID
  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = BASE_CSS
  shadow.appendChild(style)

  const button = document.createElement('button')
  button.className = 'mube-btn'
  button.type = 'button'
  button.innerHTML = '<span class="zap">⚡</span><span>Preencher com MUBE</span>'
  shadow.appendChild(button)

  const panel = document.createElement('div')
  panel.className = 'mube-panel hidden'
  shadow.appendChild(panel)

  let currentPayload: CasaProntaPayload | null = null

  async function openPanel() {
    const { payload, negocio } = await opts.getActivePayload()
    currentPayload = payload

    panel.innerHTML = `
      <header>
        <h2>⚡ Preencher Casa Pronta</h2>
        <button class="close" type="button" aria-label="Fechar">✕</button>
      </header>
      <div class="body">
        ${payload ? renderPayloadPreview(payload, negocio) : renderEmptyState()}
      </div>
      ${
        payload
          ? `<footer>
               <button class="cancel" type="button">Cancelar</button>
               <button class="fill" type="button">Preencher campos</button>
             </footer>`
          : ''
      }
    `

    panel.classList.remove('hidden')
    button.style.display = 'none'

    panel.querySelector<HTMLButtonElement>('.close')?.addEventListener('click', closePanel)
    panel.querySelector<HTMLButtonElement>('.cancel')?.addEventListener('click', closePanel)
    panel.querySelector<HTMLButtonElement>('.fill')?.addEventListener('click', async () => {
      if (!currentPayload) return
      const fillBtn = panel.querySelector<HTMLButtonElement>('.fill')
      if (fillBtn) {
        fillBtn.disabled = true
        fillBtn.textContent = 'A preencher…'
      }
      try {
        const result = await fillCasaProntaForm(currentPayload)
        closePanel()
        const warningsDetail =
          result.warnings.length > 0
            ? `${result.warnings.length} aviso(s) — ver consola.`
            : undefined
        showToast(
          shadow,
          'success',
          `${result.filled.length} campos preenchidos`,
          warningsDetail ??
            'Revê o formulário antes de submeter. Lembra-te de copiar o código de acompanhamento depois.'
        )
        if (result.warnings.length > 0) {
          console.warn('[MUBE] avisos:', result.warnings)
        }
        if (result.missing.length > 0) {
          console.warn('[MUBE] campos não encontrados:', result.missing)
        }
      } catch (err) {
        console.error('[MUBE] erro ao preencher:', err)
        showToast(shadow, 'error', 'Erro ao preencher', String(err))
      }
    })
  }

  function closePanel() {
    panel.classList.add('hidden')
    button.style.display = ''
  }

  button.addEventListener('click', openPanel)

  document.body.appendChild(host)
  console.log('[MUBE] botão injectado')
}
