"use client";

import { AlertCircle } from 'lucide-react';

export function SupabaseConfigWarning() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-2xl mx-auto">
      <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-6 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertCircle className="text-red-600 dark:text-red-400" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-red-900 dark:text-red-200 text-lg mb-2">
              ⚠️ Supabase Não Configurado
            </h3>
            <p className="text-red-800 dark:text-red-300 text-sm mb-3">
              Para usar dados reais, configure suas credenciais do Supabase no arquivo <code className="bg-red-100 dark:bg-red-900/40 px-2 py-1 rounded">.env</code>
            </p>
            <div className="bg-red-100 dark:bg-red-900/40 rounded-lg p-4 font-mono text-xs text-red-900 dark:text-red-200">
              <div className="mb-1"># .env</div>
              <div>VITE_SUPABASE_URL=https://seu-projeto.supabase.co</div>
              <div>VITE_SUPABASE_ANON_KEY=sua-chave-aqui</div>
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 mt-3">
              📍 Obtenha suas credenciais em: <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline hover:text-red-700 dark:hover:text-red-300">supabase.com/dashboard</a> → Settings → API
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
