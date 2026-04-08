// @ts-nocheck
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { RATING_FIELDS, DISCOVERY_OPTIONS } from '@/types/visit-ficha'
import { Star, CheckCircle2, Loader2, Building2, Send } from 'lucide-react'

export default function PublicFichaPage() {
  const { propertySlug } = useParams<{ propertySlug: string }>()
  const searchParams = useSearchParams()
  // Quando a ficha é aberta a partir de uma visita específica (link partilhado
  // pelo buyer agent depois de a visita ser marcada como completed), o ?visit=<uuid>
  // associa a resposta à linha em `visits` para fechar o ciclo no histórico.
  const visitId = searchParams.get('visit')
  const [property, setProperty] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientIdNumber, setClientIdNumber] = useState('')
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0])
  const [visitTime, setVisitTime] = useState('')
  const [ratings, setRatings] = useState<Record<string, number | null>>({})
  const [hoverRatings, setHoverRatings] = useState<Record<string, number>>({})
  const [likedMost, setLikedMost] = useState('')
  const [likedLeast, setLikedLeast] = useState('')
  const [wouldBuy, setWouldBuy] = useState<boolean | null>(null)
  const [wouldBuyReason, setWouldBuyReason] = useState('')
  const [perceivedValue, setPerceivedValue] = useState('')
  const [hasPropertyToSell, setHasPropertyToSell] = useState<boolean | null>(null)
  const [discoverySource, setDiscoverySource] = useState<string | null>(null)
  const [consentShare, setConsentShare] = useState(false)

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSigned, setHasSigned] = useState(false)

  // Load property by slug
  useEffect(() => {
    const fetchProperty = async () => {
      try {
        // Try as slug first, then as ID — public endpoint, no auth needed
        const res = await fetch(`/api/fichas/property?slug=${propertySlug}`)
        if (!res.ok) throw new Error('Imóvel não encontrado')
        const json = await res.json()
        if (!json.data) throw new Error('Imóvel não encontrado')
        setProperty(json.data)
      } catch {
        setError('Imóvel não encontrado. Verifique o link.')
      } finally {
        setIsLoading(false)
      }
    }
    fetchProperty()
  }, [propertySlug])

  // Signature drawing
  const getCoords = (e: any) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches?.[0]?.clientX ?? e.clientX
    const clientY = e.touches?.[0]?.clientY ?? e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const startDraw = (e: any) => {
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    setIsDrawing(true)
    const { x, y } = getCoords(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: any) => {
    if (!isDrawing) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getCoords(e)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#000'
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSigned(true)
  }

  const endDraw = () => setIsDrawing(false)

  const clearSignature = () => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height)
    setHasSigned(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!property || !clientName.trim()) return

    setIsSubmitting(true)
    try {
      let signatureData: string | null = null
      if (hasSigned && canvasRef.current) {
        signatureData = canvasRef.current.toDataURL('image/png')
      }

      const res = await fetch('/api/fichas/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: property.id,
          visit_id: visitId || null,
          client_name: clientName.trim(),
          client_phone: clientPhone.trim() || null,
          client_email: clientEmail.trim() || null,
          client_id_number: clientIdNumber.trim() || null,
          visit_date: visitDate,
          visit_time: visitTime || null,
          ...ratings,
          liked_most: likedMost.trim() || null,
          liked_least: likedLeast.trim() || null,
          would_buy: wouldBuy,
          would_buy_reason: wouldBuyReason.trim() || null,
          perceived_value: perceivedValue ? Number(perceivedValue) : null,
          has_property_to_sell: hasPropertyToSell,
          discovery_source: discoverySource,
          consent_share_with_owner: consentShare,
          signature_data: signatureData,
        }),
      })

      if (!res.ok) throw new Error('Erro ao enviar ficha')
      setIsSubmitted(true)
    } catch {
      setError('Erro ao enviar. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    )
  }

  if (error && !property) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 px-4">
        <Building2 className="h-12 w-12 text-neutral-300 mb-4" />
        <h1 className="text-xl font-semibold text-neutral-700">{error}</h1>
      </div>
    )
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 px-4 text-center">
        <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-800">Obrigado!</h1>
        <p className="text-neutral-500 mt-2 max-w-sm">
          A sua ficha de visita foi enviada com sucesso. Agradecemos o seu feedback sobre o imóvel.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-neutral-900 text-white px-4 py-8 sm:py-12">
        <div className="max-w-lg mx-auto text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-medium">Relatório de Visita</p>
          <h1 className="text-xl sm:text-2xl font-bold mt-2">{property?.title}</h1>
          <p className="text-sm text-neutral-400 mt-1">
            {[property?.city, property?.zone].filter(Boolean).join(' · ')}
          </p>
          {property?.external_ref && (
            <p className="text-xs text-neutral-500 mt-1">Ref: {property.external_ref}</p>
          )}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 py-8 space-y-8">
        {/* Client Info */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Dados Pessoais</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-1 block">Nome *</label>
              <input required value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-shadow" placeholder="Nome completo" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">Telemóvel</label>
                <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-shadow" placeholder="+351 9XX XXX XXX" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">Email</label>
                <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-shadow" placeholder="email@exemplo.pt" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">BI/CC</label>
                <input value={clientIdNumber} onChange={(e) => setClientIdNumber(e.target.value)} className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-shadow" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">Data *</label>
                <input required type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-shadow" />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">Hora</label>
                <input type="time" value={visitTime} onChange={(e) => setVisitTime(e.target.value)} className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-shadow" />
              </div>
            </div>
          </div>
        </section>

        {/* Ratings */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Avaliação do Imóvel</h2>
          <div className="space-y-4">
            {RATING_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3">
                <span className="text-sm font-medium text-neutral-700">{field.label}</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRatings((prev) => ({ ...prev, [field.key]: star }))}
                      onMouseLeave={() => setHoverRatings((prev) => ({ ...prev, [field.key]: 0 }))}
                      onClick={() => setRatings((prev) => ({ ...prev, [field.key]: prev[field.key] === star ? null : star }))}
                      className="p-0.5 transition-transform hover:scale-110"
                    >
                      <Star className={cn('h-5 w-5', star <= (hoverRatings[field.key] || ratings[field.key] || 0) ? 'fill-amber-400 text-amber-400' : 'text-neutral-200')} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Open Questions */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Impressões</h2>
          <div>
            <label className="text-xs font-medium text-neutral-600 mb-1 block">O que mais gostou?</label>
            <textarea value={likedMost} onChange={(e) => setLikedMost(e.target.value)} rows={3} className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-shadow resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-600 mb-1 block">O que menos gostou?</label>
            <textarea value={likedLeast} onChange={(e) => setLikedLeast(e.target.value)} rows={3} className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-shadow resize-none" />
          </div>

          {/* Would buy */}
          <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4 space-y-3">
            <p className="text-sm font-medium text-neutral-700">Compraria/arrendaria este imóvel?</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setWouldBuy(true)} className={cn('flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all', wouldBuy === true ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50')}>Sim</button>
              <button type="button" onClick={() => setWouldBuy(false)} className={cn('flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all', wouldBuy === false ? 'bg-red-50 border-red-300 text-red-700' : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50')}>Não</button>
            </div>
            {wouldBuy !== null && (
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">Porquê?</label>
                <input value={wouldBuyReason} onChange={(e) => setWouldBuyReason(e.target.value)} className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-shadow" />
              </div>
            )}
          </div>

          {/* Perceived value */}
          <div>
            <label className="text-xs font-medium text-neutral-600 mb-1 block">Quanto vale para si este imóvel? (€)</label>
            <input type="number" value={perceivedValue} onChange={(e) => setPerceivedValue(e.target.value)} className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-shadow" placeholder="250000" />
          </div>

          {/* Has property to sell */}
          <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4 space-y-3">
            <p className="text-sm font-medium text-neutral-700">Tem algum imóvel para vender?</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setHasPropertyToSell(true)} className={cn('flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all', hasPropertyToSell === true ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50')}>Sim</button>
              <button type="button" onClick={() => setHasPropertyToSell(false)} className={cn('flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all', hasPropertyToSell === false ? 'bg-red-50 border-red-300 text-red-700' : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50')}>Não</button>
            </div>
          </div>
        </section>

        {/* Discovery source */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Como conheceu este imóvel?</h2>
          <div className="flex flex-wrap gap-2">
            {DISCOVERY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDiscoverySource(discoverySource === opt.value ? null : opt.value)}
                className={cn('px-4 py-2 rounded-full text-sm font-medium border transition-all', discoverySource === opt.value ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* Signature */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Assinatura</h2>
            {hasSigned && (
              <button type="button" onClick={clearSignature} className="text-xs text-neutral-400 hover:text-neutral-600 underline">Limpar</button>
            )}
          </div>
          <div className="rounded-xl border-2 border-dashed border-neutral-200 bg-white overflow-hidden">
            <canvas
              ref={canvasRef}
              width={400}
              height={150}
              className="w-full touch-none cursor-crosshair"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>
          {!hasSigned && (
            <p className="text-[11px] text-neutral-400 text-center">Desenhe a sua assinatura acima</p>
          )}
        </section>

        {/* Consent */}
        <section>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentShare}
              onChange={(e) => setConsentShare(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-neutral-300"
            />
            <span className="text-xs text-neutral-500 leading-relaxed">
              Autorizo que os dados aqui constantes sejam conhecidos pelo proprietário, para confirmação da visita.
            </span>
          </label>
        </section>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || !clientName.trim()}
          className="w-full bg-neutral-900 text-white py-4 rounded-xl text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {isSubmitting ? 'A enviar...' : 'Enviar Ficha de Visita'}
        </button>

        <p className="text-[10px] text-neutral-400 text-center leading-relaxed">
          Infinity Group — Real Estate Signature by Filipe Pereira
        </p>
      </form>
    </div>
  )
}
