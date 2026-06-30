"use client";

import { X, Loader2, Check, AlertCircle } from 'lucide-react';
import { useEffect, useState, useRef, FormEvent } from 'react';
import { supabase } from '../../lib/supabase';

export interface LeadConsultantInfo {
  id: string;
  name: string;
  photoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface LeadContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyTitle?: string;
  propertyId?: string;
  propertySlug?: string;
  propertyExternalRef?: string;
  consultant?: LeadConsultantInfo | null;
}

const FALLBACK_PHOTO = 'https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/agents/39fa64ed-b002-400e-a4a7-8439746e358d/profile.webp';

// Production Turnstile site key (public — safe to ship in bundle). Override via NEXT_PUBLIC_TURNSTILE_SITE_KEY if needed.
const DEFAULT_TURNSTILE_SITE_KEY = '0x4AAAAAADDZ7hHj6m1tuBNg';
const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || DEFAULT_TURNSTILE_SITE_KEY;
const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement | string,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible' | 'invisible';
          appearance?: 'always' | 'execute' | 'interaction-only';
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

export function LeadContactModal({
  isOpen,
  onClose,
  propertyTitle,
  propertyId,
  propertySlug,
  propertyExternalRef,
  consultant,
}: LeadContactModalProps) {
  const [fallbackConsultant, setFallbackConsultant] = useState<LeadConsultantInfo | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileMountRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  // Fetch fallback consultant when property has no responsible consultor
  useEffect(() => {
    if (!isOpen || consultant?.id || !supabase) return;

    let cancelled = false;
    async function fetchFallback() {
      try {
        const { data, error } = await supabase!
          .from('dev_users')
          .select(`
            id,
            commercial_name,
            professional_email,
            dev_consultant_profiles ( phone_commercial, profile_photo_url )
          `)
          .ilike('commercial_name', '%mariana%cabral%')
          .maybeSingle();

        if (cancelled || error || !data) return;
        const profileRaw = (data as any).dev_consultant_profiles;
        const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
        setFallbackConsultant({
          id: data.id as string,
          name: (data.commercial_name as string) || 'Mariana Cabral',
          email: (data.professional_email as string) || null,
          phone: profile?.phone_commercial || null,
          photoUrl: profile?.profile_photo_url || null,
        });
      } catch (err) {
        console.warn('⚠️ Could not fetch fallback consultant:', err);
      }
    }

    fetchFallback();
    return () => {
      cancelled = true;
    };
  }, [isOpen, consultant?.id]);

  // Reset state each time the modal opens
  useEffect(() => {
    if (isOpen) {
      setSubmitted(false);
      setError(null);
      setSubmitting(false);
      setName('');
      setPhone('');
      setEmail('');
      setMessage(propertyTitle ? `Olá, tenho interesse em: ${propertyTitle}.` : '');
      setConsent(false);
      setTurnstileToken(null);
    }
  }, [isOpen, propertyTitle]);

  // Inject Turnstile script once
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (window.turnstile) return;
    if (document.querySelector(`script[src="${TURNSTILE_SCRIPT_SRC}"]`)) return;
    const s = document.createElement('script');
    s.src = TURNSTILE_SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }, []);

  // Render Turnstile widget when the form is visible
  useEffect(() => {
    if (!isOpen || submitted) return;
    let cancelled = false;
    let raf = 0;

    const tryRender = () => {
      if (cancelled) return;
      const ts = window.turnstile;
      const mount = turnstileMountRef.current;
      if (!ts || !mount) {
        raf = window.setTimeout(tryRender, 150);
        return;
      }
      if (turnstileWidgetIdRef.current) return;
      try {
        const id = ts.render(mount, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => setTurnstileToken(token),
          'error-callback': () => setTurnstileToken(null),
          'expired-callback': () => setTurnstileToken(null),
          theme: 'light',
          size: 'flexible',
        });
        turnstileWidgetIdRef.current = id;
      } catch (err) {
        console.warn('⚠️ Turnstile render failed:', err);
      }
    };

    tryRender();

    return () => {
      cancelled = true;
      if (raf) window.clearTimeout(raf);
      const id = turnstileWidgetIdRef.current;
      if (id && window.turnstile) {
        try {
          window.turnstile.remove(id);
        } catch {}
      }
      turnstileWidgetIdRef.current = null;
    };
  }, [isOpen, submitted]);

  function resetTurnstile() {
    setTurnstileToken(null);
    const id = turnstileWidgetIdRef.current;
    if (id && window.turnstile) {
      try {
        window.turnstile.reset(id);
      } catch {}
    }
  }

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Close modal on escape key and prevent body scroll
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    if (isOpen) {
      const scrollY = window.scrollY;

      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      return () => {
        document.removeEventListener('keydown', handleEscape);

        const stickyTop = document.body.style.top;
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';

        const scrollYValue = parseInt(stickyTop || '0', 10);
        const scrollPosition = isNaN(scrollYValue) ? 0 : Math.abs(scrollYValue);
        window.scrollTo(0, scrollPosition);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const display = consultant || fallbackConsultant;
  const displayName = display?.name || 'A nossa equipa';
  const displayPhoto = display?.photoUrl || FALLBACK_PHOTO;
  const displayRole = consultant ? 'Consultor responsável' : 'Gestora de Leads';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName) {
      setError('Por favor indique o seu nome.');
      return;
    }
    if (!trimmedPhone && !trimmedEmail) {
      setError('Indique pelo menos um contacto (telefone ou email).');
      return;
    }
    if (!turnstileToken) {
      setError('Por favor complete a verificação de segurança.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      turnstileToken,
      name: trimmedName,
      phone: trimmedPhone || null,
      email: trimmedEmail || null,
      message: trimmedMessage || null,
      consent,
      propertyId: propertyId || null,
      propertySlug: propertySlug || null,
      propertyTitle: propertyTitle || null,
      propertyExternalRef: propertyExternalRef || null,
      consultantId: consultant?.id || null,
      formUrl: typeof window !== 'undefined' ? window.location.href : null,
    };

    try {
      const resp = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        let serverError: any = null;
        try {
          serverError = await resp.json();
        } catch {}
        console.error('❌ /api/lead failed:', resp.status, serverError);
        if (serverError?.error === 'turnstile_failed') {
          setError('A verificação de segurança falhou. Por favor tente novamente.');
        } else {
          setError('Ocorreu um erro ao enviar o seu pedido. Por favor tente novamente.');
        }
        resetTurnstile();
        return;
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error('❌ Error creating lead:', err);
      setError('Ocorreu um erro ao enviar o seu pedido. Por favor tente novamente.');
      resetTurnstile();
    } finally {
      setSubmitting(false);
    }
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="lead-name" className="block text-xs font-medium text-gray-700 mb-1">Nome *</label>
        <input
          id="lead-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
          className="w-full px-4 py-3 bg-gray-100 border border-transparent rounded-xl text-sm focus:outline-none focus:bg-white focus:border-black transition"
          placeholder="O seu nome"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label htmlFor="lead-phone" className="block text-xs font-medium text-gray-700 mb-1">Telefone</label>
          <input
            id="lead-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            className="w-full px-4 py-3 bg-gray-100 border border-transparent rounded-xl text-sm focus:outline-none focus:bg-white focus:border-black transition"
            placeholder="+351 ..."
          />
        </div>
        <div>
          <label htmlFor="lead-email" className="block text-xs font-medium text-gray-700 mb-1">Email</label>
          <input
            id="lead-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full px-4 py-3 bg-gray-100 border border-transparent rounded-xl text-sm focus:outline-none focus:bg-white focus:border-black transition"
            placeholder="email@exemplo.com"
          />
        </div>
      </div>
      <div>
        <label htmlFor="lead-message" className="block text-xs font-medium text-gray-700 mb-1">Mensagem</label>
        <textarea
          id="lead-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="w-full px-4 py-3 bg-gray-100 border border-transparent rounded-xl text-sm leading-relaxed focus:outline-none focus:bg-white focus:border-black transition resize-y min-h-[120px]"
          placeholder="Diga-nos como o podemos ajudar..."
        />
      </div>
      {/* Optional marketing consent — NOT required to send the request */}
      <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-black"
        />
        <span>
          Aceito receber comunicações sobre outros imóveis e serviços da Infinity Group <span className="text-gray-500">(opcional)</span>.
        </span>
      </label>

      <p className="text-[11px] text-gray-500 leading-relaxed">
        Ao enviar este pedido, os seus dados serão tratados para lhe responder, de acordo com a{' '}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="underline hover:text-gray-600 transition-colors"
        >
          Política de Privacidade
        </a>
        .
      </p>

      <div ref={turnstileMountRef} className="min-h-[65px]" />

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !turnstileToken}
        className="w-full bg-black text-white py-3.5 rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-base font-medium disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>A enviar...</span>
          </>
        ) : (
          <span>Enviar pedido</span>
        )}
      </button>
    </form>
  );

  const successContent = (
    <div className="flex flex-col items-center text-center py-6">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
        <Check size={32} className="text-green-600" />
      </div>
      <h3 className="text-xl font-medium mb-2">Pedido enviado!</h3>
      <p className="text-gray-600 text-sm leading-relaxed">
        Obrigado pelo seu interesse. {displayName.split(' ')[0]} irá entrar em contacto consigo o mais brevemente possível.
      </p>
      <button
        onClick={onClose}
        className="mt-6 w-full bg-black text-white py-3 rounded-xl hover:bg-gray-800 transition-colors font-medium text-sm"
      >
        Fechar
      </button>
    </div>
  );

  const headerCopy = consultant
    ? `Preencha o formulário e ${displayName.split(' ')[0]}, consultor(a) responsável por este imóvel, irá contactá-lo.`
    : `Preencha o formulário e a nossa equipa irá contactá-lo o mais brevemente possível.`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Contactar ${displayName}`}
      className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-hidden"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Mobile: Bottom Sheet */}
      <div className="md:hidden relative bg-white rounded-t-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-x-hidden">
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors shadow-lg"
        >
          <X size={20} className="text-gray-600" />
        </button>

        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </div>

        <div className="px-6 pb-6">
          <div className="flex flex-col items-center text-center mb-5 pt-2">
            <div className="relative mb-3">
              <img
                src={displayPhoto}
                alt={displayName}
                className="w-24 h-24 rounded-full object-cover bg-gray-100 ring-4 ring-white shadow-lg"
              />
              <span className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-green-500 rounded-full ring-2 ring-white" />
            </div>
            <div className="text-xl font-medium leading-tight">{displayName}</div>
            <div className="text-xs uppercase tracking-wider text-gray-500 mt-1">{displayRole}</div>
          </div>

          {!submitted && (
            <p className="text-gray-600 text-sm leading-relaxed mb-5 text-center">{headerCopy}</p>
          )}

          {submitted ? successContent : formContent}
        </div>
      </div>

      {/* Desktop: Split View */}
      <div className="hidden md:flex relative bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-6 right-6 z-10 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-lg"
        >
          <X size={24} className="text-gray-600" />
        </button>

        {/* Left Side - Form */}
        <div className="w-1/2 flex flex-col overflow-y-auto">
          <div className="px-10 pt-12 pb-6">
            <h2 className="text-3xl font-light mb-1">{displayName}</h2>
            <p className="text-gray-500 text-sm mb-5">{displayRole}</p>
            {!submitted && (
              <p className="text-gray-600 text-base leading-relaxed">{headerCopy}</p>
            )}
          </div>

          <div className="flex-1 px-10 pb-10">
            {submitted ? successContent : formContent}
          </div>
        </div>

        {/* Right Side - Photo */}
        <div className="w-1/2 relative overflow-hidden bg-gray-100">
          <img
            src={displayPhoto}
            alt={displayName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
        </div>
      </div>
    </div>
  );
}
