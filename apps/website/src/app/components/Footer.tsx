"use client";

import { Facebook, Instagram, Home, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export function Footer() {
  const [showAMIModal, setShowAMIModal] = useState(false);

  return (
    <>
      <footer className="bg-[rgb(9,9,9)] text-white py-6 md:py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Content - Social Icons + Logo Row */}
          <div className="flex flex-col items-center justify-center gap-6 mb-6 pb-6 border-b border-white/10">
            <div className="flex gap-3">
              <a
                href="https://remax.pt/en/agente/filipe-pereira/121491860"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="RE/MAX Profile"
              >
                <Home size={16} />
              </a>
              <a
                href="https://www.instagram.com/o.infinitygroup?igsh=MWc5eTJ4cnc1Y2w3aw=="
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="Instagram"
              >
                <Instagram size={16} />
              </a>
              <a
                href="https://www.facebook.com/infinitygroupbyfilipepereira/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="Facebook"
              >
                <Facebook size={16} />
              </a>
            </div>
            <div className="flex items-center justify-center gap-6 md:gap-10">
              <img
                src="https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/marketing-recursos/decd91a9-3fbd-4c04-b33b-1a75257f6ea0-logo-balao-remax.png"
                alt="RE/MAX"
                className="h-10 w-auto object-contain"
              />
              <Link href="/" className="flex items-center gap-2">
                <img
                  src="https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/landing-page/848532cc-bf9e-4add-bf26-85b95062c2fd.png"
                  alt="Infinity Group"
                  className="h-10 w-auto object-contain"
                />
              </Link>
              <img
                src="https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/marketing-recursos/5dc7a699-9555-441b-a0b2-c2628cdb7dfd-grupo-convictus-marcas-2021_prancheta-1-c-pia-7.png"
                alt="Grupo Convictus"
                className="h-10 w-auto object-contain"
              />
            </div>
          </div>

          {/* Bottom Section - Legal Links + Copyright */}
          <div className="flex flex-col items-center gap-4">
            {/* Legal Links */}
            <div className="flex flex-wrap gap-4 md:gap-6 justify-center text-sm">
              <Link href="/privacy" className="text-white/70 hover:text-white transition-colors">
                Política de Privacidade
              </Link>
              <Link href="/cookies" className="text-white/70 hover:text-white transition-colors">
                Política de Cookies
              </Link>
              <Link href="/terms" className="text-white/70 hover:text-white transition-colors">
                Termos e Condições
              </Link>
              <Link href="/legal" className="text-white/70 hover:text-white transition-colors">
                Aviso Legal
              </Link>
              <a 
                href="https://www.livroreclamacoes.pt/Inicio/" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/70 hover:text-white transition-colors"
              >
                Livro de Reclamações
              </a>
            </div>

            {/* Copyright */}
            <div className="text-center">
              <p className="text-white/60 text-xs">
                Infinity Group · infinitygroup.pt
              </p>
              <p className="text-white/60 text-xs mt-1">
                Cada agência é de propriedade e gestão independente ·{' '}
                <button
                  onClick={() => setShowAMIModal(true)}
                  className="text-xs underline hover:text-white transition-colors cursor-pointer"
                >
                  AMI 4719
                </button>
                {' '}· Convictus Mediação Imobiliária, Lda
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* AMI License Modal */}
      {showAMIModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowAMIModal(false)}
        >
          <div 
            className="relative w-full max-w-5xl h-[90vh] bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/20 bg-black/20">
              <h3 className="text-lg font-semibold text-white">Licença AMI 4719 - Convictus Mediação Imobiliária</h3>
              <button
                onClick={() => setShowAMIModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            {/* PDF Viewer */}
            <div className="w-full h-[calc(100%-4rem)]">
              <iframe
                src="https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/landing-page/Convictus_AMI.pdf"
                className="w-full h-full"
                title="Licença AMI 4719"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}