"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';

const CONSENT_KEY = 'cookieConsent';

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show the banner only if the user hasn't acknowledged it yet.
    try {
      if (!localStorage.getItem(CONSENT_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable (e.g. private mode); show the banner anyway.
      setVisible(true);
    }
  }, []);

  const decide = (choice: 'accepted' | 'rejected') => {
    try {
      localStorage.setItem(CONSENT_KEY, choice);
    } catch {
      // Ignore write failures; simply hide for this session.
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed bottom-0 left-0 right-0 z-50 p-3 sm:p-4 md:p-6 pointer-events-none"
    >
      <div className="container mx-auto max-w-4xl pointer-events-auto">
        <div className="relative bg-[rgb(9,9,9)] text-white rounded-2xl shadow-2xl border border-white/10 p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="shrink-0 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <Cookie size={20} />
            </div>
            <div className="text-sm text-white/80 leading-relaxed">
              Este Website utiliza apenas cookies e tecnologias estritamente necessárias ao seu
              funcionamento e para guardar as suas preferências. Não são utilizados cookies de
              rastreamento, análise ou publicidade. Saiba mais na nossa{' '}
              <Link href="/cookies" className="text-white font-semibold underline hover:text-white/90">
                Política de Cookies
              </Link>
              .
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
            <button
              onClick={() => decide('rejected')}
              className="px-5 py-2.5 rounded-full bg-white/10 border border-white/20 text-white text-sm font-semibold hover:bg-white/20 transition-colors"
            >
              Recusar
            </button>
            <button
              onClick={() => decide('accepted')}
              className="px-5 py-2.5 rounded-full bg-white text-[rgb(9,9,9)] text-sm font-semibold hover:bg-white/90 transition-colors"
            >
              Aceitar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
