"use client";

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="bg-[rgb(9,9,9)] text-white py-16 md:py-24 -mt-[calc(4rem+0.5rem)] md:-mt-[calc(5rem+0.5rem)] pt-[calc(4rem+0.5rem+4rem)] md:pt-[calc(5rem+0.5rem+6rem)]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors mb-6 group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span>Voltar à Página Inicial</span>
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Política de Cookies</h1>
          <p className="text-white/70 text-lg">www.infinitygroup.pt</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 max-w-4xl">
        <div className="prose prose-lg max-w-none">
          {/* Section 1 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">1. Introdução</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              A <strong>Lecoqimmo - Mediação Imobiliária, Unipessoal Lda</strong> (doravante designada por "Lecoqimmo"), com NIPC 514828528 e sede em Avenida da Liberdade, Nº 129 B, 1250-140 Lisboa, é a entidade responsável pelo website www.infinitygroup.pt.
            </p>
            <p className="text-gray-700 leading-relaxed">
              A presente Política de Cookies explica que tecnologias de armazenamento são utilizadas neste Website, com que finalidade, e como o utilizador pode geri-las. Esta Política deve ser lida em conjunto com a nossa{' '}
              <Link href="/privacy" className="text-[rgb(9,9,9)] hover:underline font-semibold">Política de Privacidade</Link>.
            </p>
          </section>

          {/* Section 2 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">2. O que são Cookies e Tecnologias Semelhantes</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              Os <strong>cookies</strong> são pequenos ficheiros de texto que um website coloca no dispositivo do utilizador (computador, tablet ou telemóvel) durante a navegação. Existem ainda outras tecnologias com função semelhante, como o <strong>armazenamento local do navegador (localStorage)</strong>, que permite guardar informação no próprio dispositivo sem a enviar para o servidor.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Estas tecnologias podem ser <strong>estritamente necessárias/funcionais</strong> (essenciais para o funcionamento do site ou para guardar preferências do utilizador) ou destinar-se a <strong>análise estatística e publicidade</strong> (rastreamento do comportamento de navegação).
            </p>
          </section>

          {/* Section 3 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">3. Tecnologias Utilizadas neste Website</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              Este Website utiliza <strong>apenas tecnologias estritamente necessárias e funcionais</strong>, que não recolhem dados para fins de rastreamento, perfilagem ou publicidade. Concretamente:
            </p>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="py-3 pr-4 text-[rgb(9,9,9)] font-bold">Tecnologia</th>
                    <th className="py-3 pr-4 text-[rgb(9,9,9)] font-bold">Tipo</th>
                    <th className="py-3 pr-4 text-[rgb(9,9,9)] font-bold">Finalidade</th>
                    <th className="py-3 text-[rgb(9,9,9)] font-bold">Duração</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  <tr className="border-b border-gray-100">
                    <td className="py-3 pr-4 align-top"><code>darkMode</code> (localStorage)</td>
                    <td className="py-3 pr-4 align-top">Funcional</td>
                    <td className="py-3 pr-4 align-top">Memorizar a preferência do utilizador entre o modo claro e o modo escuro.</td>
                    <td className="py-3 align-top">Persistente (até ser apagado pelo utilizador)</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 pr-4 align-top"><code>cookieConsent</code> (localStorage)</td>
                    <td className="py-3 pr-4 align-top">Necessário</td>
                    <td className="py-3 pr-4 align-top">Registar que o utilizador tomou conhecimento desta Política de Cookies, para não voltar a apresentar o aviso.</td>
                    <td className="py-3 align-top">Persistente (até ser apagado pelo utilizador)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-gray-700 leading-relaxed">
              Estas tecnologias funcionam exclusivamente no dispositivo do utilizador e não transmitem informação pessoal para a Lecoqimmo nem para terceiros.
            </p>
          </section>

          {/* Section 4 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">4. O que NÃO Utilizamos</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              A Lecoqimmo <strong>não utiliza</strong> neste Website:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Cookies ou ferramentas de análise estatística (por exemplo, Google Analytics);</li>
              <li>Cookies de publicidade, remarketing ou perfilagem;</li>
              <li>Cookies de redes sociais para rastreamento de navegação;</li>
              <li>Quaisquer tecnologias que monitorizem o comportamento do utilizador entre diferentes websites.</li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              Por este motivo, a navegação no Website não exige a aceitação de cookies não essenciais. O aviso de cookies apresentado destina-se apenas a informar o utilizador sobre as tecnologias funcionais acima descritas.
            </p>
          </section>

          {/* Section 5 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">5. Conteúdos e Ligações de Terceiros</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              O Website pode conter ligações para plataformas externas (por exemplo, Instagram, Facebook, RE/MAX ou o Livro de Reclamações Eletrónico). Ao seguir essas ligações, o utilizador passa a estar sujeito às políticas de cookies e de privacidade dessas entidades, sobre as quais a Lecoqimmo não tem qualquer controlo.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Recomenda-se a consulta das políticas de cookies dos respetivos websites de terceiros.
            </p>
          </section>

          {/* Section 6 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">6. Como Gerir e Eliminar Cookies</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              O utilizador pode, a qualquer momento, eliminar ou bloquear cookies e o armazenamento local através das definições do seu navegador. A maioria dos navegadores permite:
            </p>
            <ul className="list-disc pl-6 mb-4 text-gray-700 space-y-2">
              <li>Consultar os cookies e dados de sites armazenados;</li>
              <li>Apagar a totalidade ou parte desses dados;</li>
              <li>Bloquear o armazenamento de novos cookies.</li>
            </ul>
            <p className="text-gray-700 leading-relaxed">
              Pode encontrar instruções específicas nas páginas de ajuda dos navegadores mais utilizados:{' '}
              <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-[rgb(9,9,9)] hover:underline">Google Chrome</a>,{' '}
              <a href="https://support.mozilla.org/pt-PT/kb/cookies-informacao-que-os-websites-guardam-no-seu-computador" target="_blank" rel="noopener noreferrer" className="text-[rgb(9,9,9)] hover:underline">Mozilla Firefox</a>,{' '}
              <a href="https://support.apple.com/pt-pt/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-[rgb(9,9,9)] hover:underline">Safari</a> e{' '}
              <a href="https://support.microsoft.com/pt-pt/microsoft-edge" target="_blank" rel="noopener noreferrer" className="text-[rgb(9,9,9)] hover:underline">Microsoft Edge</a>.
            </p>
            <p className="text-gray-700 leading-relaxed mt-4">
              Uma vez que apenas são utilizadas tecnologias funcionais, a sua eliminação não compromete o acesso aos conteúdos do Website, podendo apenas repor preferências (como o modo de visualização) para os valores predefinidos.
            </p>
          </section>

          {/* Section 7 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">7. Alterações à Política de Cookies</h2>
            <p className="text-gray-700 leading-relaxed">
              A Lecoqimmo reserva-se o direito de atualizar ou modificar a presente Política de Cookies a qualquer momento, nomeadamente caso venham a ser introduzidas novas tecnologias no Website. Quaisquer alterações serão publicadas nesta página, com indicação da data da última atualização.
            </p>
          </section>

          {/* Section 8 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4 text-[rgb(9,9,9)]">8. Contacto</h2>
            <p className="mb-4 text-gray-700 leading-relaxed">
              Para quaisquer questões relacionadas com esta Política de Cookies ou com a proteção de dados pessoais, os utilizadores podem contactar a Lecoqimmo através de:
            </p>
            <ul className="list-none pl-0 mb-4 text-gray-700 space-y-2">
              <li><strong>Email:</strong> assistente.filipe.pereira@remax.pt</li>
              <li><strong>Telefone:</strong> +351 910 523 200</li>
              <li><strong>Morada:</strong> Avenida da Liberdade, Nº 129 B, 1250-140 Lisboa</li>
            </ul>
          </section>

          {/* Last Update */}
          <div className="mt-16 pt-8 border-t border-gray-200">
            <p className="text-gray-500 text-sm">
              Última atualização: Junho de 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
