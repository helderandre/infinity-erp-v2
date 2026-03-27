import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const CONTRACT_HTML = `
<h2 style="text-align: center; font-size: 14pt; margin-bottom: 2em; font-weight: bold;">CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h2>

<p><strong>Entre</strong></p>

<p><strong>LECOQUIMMO – MEDIAÇÃO IMOBILIÁRIA, UNIPESSOAL, LDA</strong>, NIPC 514828528, com o capital social de 5.000,00 e sede na Av. da Liberdade, n.º 129-B, 1250-140 Lisboa, neste ato representada pelo seu gerente Carlos Filipe Pinto de Oliveira Pereira, doravante designada por <strong>Primeiro Contraente ou LECOQIMMO</strong></p>

<p><strong>E</strong></p>

<p><strong>{{nome_completo}}</strong>, residente na {{morada_completa}}, portador do {{tipo_documento}} n.º {{cc_numero}}, válido até {{cc_validade}}, contribuinte n.º {{nif}}, doravante designado por <strong>Segundo Contraente ou Angariador Imobiliário</strong>.</p>

<p><strong>Considerando que:</strong></p>

<ol type="A" style="margin-left: 1.5em;">
  <li>O Primeiro Contraente é uma sociedade comercial que se dedica, entre outras, às atividades de mediação, angariação e avaliação imobiliária, administração de imóveis por conta de outrem e administração de condomínios;</li>
  <li>O Primeiro Contraente desenvolve o negócio de mediação imobiliária através da marca REMAX, legitimada por contrato celebrado com a sociedade <strong>A Convictus – Mediação imobiliária, Lda, NIPC 505239485, Licença AMI 4719 e sede na Av. das Forças Armadas, 22-C, Lisboa</strong>;</li>
  <li>O Primeiro Contraente pretende contratar os serviços do Angariador Imobiliário e este aceita, a fim de colaborar no desenvolvimento do negócio de mediação imobiliária e serviços conexos;</li>
</ol>

<p>É livremente e de boa-fé celebrado, o presente <strong>Contrato de Prestação de Serviços</strong>, que se rege pelas cláusulas seguintes:</p>

<h3 style="text-align: center; font-size: 12pt; margin-top: 1.5em;">Cláusula Primeira</h3>
<p style="text-align: center; font-size: 12pt;"><strong>(Autonomia e Responsabilidades Fiscais e Parafiscais do Angariador Imobiliário)</strong></p>

<ol>
  <li>O Angariador Imobiliário deverá prestar os seus serviços de acordo com as necessidades reais inerentes à sua atividade de mediação imobiliária, de forma autónoma e independente, não sujeita à autoridade ou direção do Primeiro Contraente.</li>
  <li>A Primeiro Contraente e o Angariador Imobiliário acordam que, pelo facto de serem entidades juridicamente autónomas e não existir qualquer relação de trabalho, antes existe e apenas, a prestação de serviços, o Angariador Imobiliário é o único e exclusivo responsável pelos pagamentos e contribuições relativas a impostos, segurança social, acidentes de trabalho ou outras importâncias devidas e inerentes à sua atividade profissional liberal (ou empresário em nome individual).</li>
</ol>

<h3 style="text-align: center; font-size: 12pt; margin-top: 1.5em;">Cláusula Segunda</h3>
<p style="text-align: center; font-size: 12pt;"><strong>(Obrigações da Lecoqimmo)</strong></p>

<p>Durante a vigência do presente contrato a Lecoqimmo deverá permitir que o Angariador Imobiliário utilize o seu escritório, bem como os seus materiais, equipamentos de comunicação e outros que sejam necessários ao desenvolvimento do negócio em objeto.</p>

<h3 style="text-align: center; font-size: 12pt; margin-top: 1.5em;">Cláusula Terceira</h3>
<p style="text-align: center; font-size: 12pt;"><strong>(Obrigações do Angariador Imobiliário)</strong></p>

<ol>
  <li>O Angariador Imobiliário atuará por conta e no interesse do Primeiro Contraente, na angariação e execução de contratos de mediação imobiliária, bem como na prestação de serviços conexos, devendo sempre identificar-se perante terceiros, como estando ao seu serviço e com todos os requisitos legais previstos na Lei 15/2013, de 8 de fevereiro.</li>
  <li>O Angariador Imobiliário está obrigado ao cumprimento do Código de Ética do mediador imobiliário e, enquanto vigorar o presente contrato deverá ter uma conduta de alto nível ético-profissional, competência, simpatia e qualidade dos serviços que presta a clientes e a público em geral.</li>
  <li>O Angariador Imobiliário deverá frequentar e participar, por sua conta, em ações de formação requeridas e/ou organizadas pela RE/MAX Portugal e pela RE/MAX Convictus.</li>
  <li>O Angariador Imobiliário deverá partilhar as angariações de imóveis com outros Angariadores associados do Primeiro Contraente, bem como cooperar com outros profissionais aceites e/ou indicados pela Lecoqimmo. O prazo máximo para avisar o Primeiro Contraente, sobre novos imóveis angariados pelo Angariador Imobiliário, por conta desta é de 24 horas.</li>
  <li>O Angariador Imobiliário tem, como sua opção e responsabilidade, a expensas suas, possuir carta de condução, dispor de veículo motorizado e assumir os respetivos encargos e obrigações, nomeadamente seguros necessários para a circulação do referido veículo.</li>
  <li>O Angariador Imobiliário obriga-se a utilizar exclusivamente a conta de correio eletrónico fornecida pela RE/MAX Portugal nas comunicações eletrónicas que tenha de efetuar no âmbito da atividade a que respeita o presente contrato.</li>
  <li>O Angariador Imobiliário deverá permitir ao Primeiro Contraente o acesso e inspeção dos seus livros, registos, procedimentos e serviços, contabilidade, sistema informático e demais registos eletrónicos.</li>
  <li>O Angariador Imobiliário autoriza que o Primeiro Contraente preste toda a informação, quer profissional, quer pessoal à RE/MAX Portugal e à RE/MAX Convictus e também que estas tenham acesso aos documentos e equipamentos suprareferidos.</li>
  <li>O Primeiro Contraente não será responsável por quaisquer despesas e/ou dívidas contraídas pelo Angariador Imobiliário.</li>
  <li>O Angariador não tem legitimidade para representar ou prometer qualquer benefício em nome e por conta da Primeiro Contraente, salvo se esta prévia e expressamente assim o autorizar.</li>
  <li>O Angariador Imobiliário deverá indemnizar a Primeiro Contraente por e contra quaisquer danos, prejuízos, custas (incluindo honorários e custas judiciais) que o mesmo possa causar no exercício do negócio.</li>
  <li>O Angariador Imobiliário deverá colaborar com a Primeiro Contraente para reparar danos ou serem ressarcidos de prejuízos, custas (incluindo honorários e custas judiciais) que esta possa sofrer no exercício do seu negócio.</li>
  <li>Durante a vigência do presente contrato, o Angariador Imobiliário não poderá prestar serviços cujo objeto seja o estabelecido no presente contrato para outra entidade que não seja o Primeiro Contraente.</li>
  <li>O Angariador Imobiliário, terá de deixar de representar a Lecoqimmo, a RE/MAX Convictus e a RE/MAX Portugal, se algum dos seus ascendentes, descendentes, familiares em 1.º grau, cônjuge ou unido de facto, exercerem diretamente ou detiverem participação social em sociedade, que também exerça a atividade de mediação imobiliária.</li>
</ol>

<h3 style="text-align: center; font-size: 12pt; margin-top: 1.5em;">Cláusula Quarta</h3>
<p style="text-align: center; font-size: 12pt;"><strong>(Remuneração do Angariador Imobiliário)</strong></p>

<ol>
  <li>O Primeiro Contraente deverá retribuir o Angariador Imobiliário nos termos do Anexo I ao presente contrato, que dele faz parte integrante, após efetivo recebimento das quantias devidas pelos clientes.</li>
  <li>O Angariador Imobiliário compromete-se a desenvolver todos os esforços para cobrar os honorários devidos pelos clientes e/ou interessados, à Primeiro Contraente.</li>
  <li>Sem prejuízo do estabelecido no número 1, o Angariador Imobiliário reconhece que todas as receitas obtidas e geradas através da marca RE/MAX pertencem ao Primeiro Contraente, assumindo assim a obrigação de lhe entregar todas as receitas obtidas através do uso daquela marca e da atividade desenvolvida no, ou a partir, do estabelecimento da Primeiro Contraente.</li>
</ol>

<h3 style="text-align: center; font-size: 12pt; margin-top: 1.5em;">Cláusula Quinta</h3>
<p style="text-align: center; font-size: 12pt;"><strong>(Utilização da Marca)</strong></p>

<p>A Lecoqimmo autoriza o Angariador Imobiliário a utilizar cartões, envelopes e demais materiais utilizados no estabelecimento de mediação imobiliária de todas as marcas aí usadas, desde que:</p>
<ol type="a" style="margin-left: 1.5em;">
  <li>Observe as regras de utilização propostas pela Primeiro Contraente,</li>
  <li>Respeite e aplique as regras de qualidade propostas pela Lecoqimmo,</li>
  <li>Continue associado nos termos do presente contrato, devendo por isso cessar o uso das marcas quando se ocorrer o termo do presente contrato.</li>
</ol>

<h3 style="text-align: center; font-size: 12pt; margin-top: 1.5em;">Cláusula Sexta</h3>
<p style="text-align: center; font-size: 12pt;"><strong>(Sigilo, Confidencialidade e Devolução de Documentação)</strong></p>

<ol>
  <li>O Angariador Imobiliário encontra-se obrigado a guardar sigilo e confidencialidade de quaisquer informações ou documentos obtidos no âmbito da sua atividade, nomeadamente no que respeita aos dados pessoais, ficando assim obrigado a não copiar, utilizar, divulgar, transmitir ou conservar, seja de que forma for, para lá das necessidades da sua atividade, quaisquer documentos ou informação da Primeiro Contraente e/ou dos Clientes desta.</li>
  <li>Após o termo do presente contrato, o Angariador Imobiliário deverá devolver toda a documentação e informação que, direta ou indiretamente, tenha recebido no desenvolvimento do negócio, mantendo o dever de sigilo e confidencialidade previsto no número anterior.</li>
</ol>

<h3 style="text-align: center; font-size: 12pt; margin-top: 1.5em;">Cláusula Sétima</h3>
<p style="text-align: center; font-size: 12pt;"><strong>(Multas/Ilícitos)</strong></p>

<p>O Angariador Imobiliário será único responsável pelo pagamento de qualquer multa à RE/MAX Portugal e/ou à RE/MAX Convictus, que advenha de qualquer ato ilícito por si praticado.</p>

<h3 style="text-align: center; font-size: 12pt; margin-top: 1.5em;">Cláusula Oitava</h3>
<p style="text-align: center; font-size: 12pt;"><strong>(Tratamento de Dados Pessoais)</strong></p>

<p>Os dados pessoais do Angariador Imobiliário são recolhidos de forma lícita, leal e transparente, considerando que o seu tratamento é necessário e indispensável à relação entre as partes. Deste modo o Angariador Imobiliário reconhece e aceita que, sem o acesso aos dados pessoais recolhidos, a celebração do presente contrato de prestação de serviços não é possível.</p>

<h3 style="text-align: center; font-size: 12pt; margin-top: 1.5em;">Cláusula Nona</h3>
<p style="text-align: center; font-size: 12pt;"><strong>(Cláusula Penal)</strong></p>

<p>Terminado o presente contrato, o Angariador Imobiliário obriga-se a entregar de imediato à Primeiro Contraente todos os materiais e equipamentos que tiver em seu poder, abstendo-se do seu uso seja a que título for, sob pena de incorrer na obrigação de pagamento àquela da quantia de &euro; 10.000,00 (dez mil euros), a título de cláusula penal.</p>

<h3 style="text-align: center; font-size: 12pt; margin-top: 1.5em;">Cláusula Décima</h3>
<p style="text-align: center; font-size: 12pt;"><strong>(Termo do Contrato)</strong></p>

<ol>
  <li>O presente contrato deixará de produzir efeitos, quando se verifique a intenção de o terminar, qualquer uma das partes.</li>
  <li>Quer a Primeiro Contraente, quer o Angariador Imobiliário poderão terminar o presente contrato, bastando para tanto notificar a outra parte, por escrito, e com a antecedência mínima de 15 (quinze) dias relativamente à verificação do termo do contrato.</li>
  <li>Em caso de incumprimento do presente contrato, por qualquer uma das contraentes, poderá a outra fazer cessar a sua vigência, com efeitos imediatos, mediante notificação escrita.</li>
</ol>

<h3 style="text-align: center; font-size: 12pt; margin-top: 1.5em;">Cláusula Décima-Primeiro</h3>
<p style="text-align: center; font-size: 12pt;"><strong>(Foro)</strong></p>

<p>Fica, desde já, expressamente convencionado que o foro competente para dirimir qualquer litígio emergente do presente contrato será o Lisboa, com exclusão de qualquer outro.</p>

<p>O Angariador Imobiliário teve oportunidade de rever este contrato e compreende os termos, condições e obrigações dele decorrentes.</p>

<p style="margin-top: 2em;">Lisboa, em {{data_contrato}}.</p>

<p style="margin-top: 2em;">A Primeira Outorgante<br>LECOQUIMMO – Mediação Imobiliária, Unipessoal, Lda.</p>
<p style="margin-top: 1em;">____________________________________<br>Carlos Filipe Pinto de Oliveira Pereira</p>

<p style="margin-top: 2em;">O Segundo Outorgante</p>
<p style="margin-top: 1em;">____________________________________<br>{{nome_completo}}</p>

<hr data-page-break="true">

<h2 style="text-align: center; font-size: 14pt; margin-top: 0;">ANEXO I</h2>

<p>Considerando que ambas as partes celebraram um Contrato de Prestação de Serviços em {{data_contrato}}, acordam em proceder ao presente Anexo I, que passa a fazer parte integrante do referido contrato, nos termos e condições seguintes:</p>

<h3 style="text-align: center; font-size: 12pt; margin-top: 1.5em;">Remuneração do Angariador Imobiliário</h3>

<p>1. A Primeira Outorgante, pela prestação de serviços de angariação imobiliária, pagará uma retribuição correspondente a uma comissão de {{comissao_percentagem}}% ({{comissao_extenso}} por cento) das importâncias que a mediadora receba nas operações imobiliárias que se concretizem e que digam respeito a imóveis ou compradores angariados pelo Angariador Imobiliário.</p>

<p>2. No caso das leads terem proveniência dos portais imobiliários (RE/MAX, Imovirtual, Idealista, entre outros), o Angariador Imobiliário recebe a retribuição na totalidade.</p>

<p>3. No caso das leads terem proveniência de campanhas segmentadas e pagas, disponibilizadas ou geridas pela Primeira Outorgante, será descontado do valor de reporting 25%, do valor restante será remunerada a comissão de {{comissao_percentagem}}% ({{comissao_extenso}} por cento).</p>

<p>4. No caso das leads serem provenientes de contactos pessoais de outros angariadores imobiliários, deverá o negócio ser realizado em partilha.</p>

<p>5. O Angariador Imobiliário compromete-se a tomar todas as diligências necessárias à boa cobrança das remunerações devidas pelos clientes da Primeira Outorgante.</p>

<p style="margin-top: 2em;">Lisboa, {{data_contrato}}</p>

<p style="margin-top: 2em;">A Primeira Outorgante<br>LECOQUIMMO – Mediação Imobiliária, Unipessoal, Lda.</p>
<p>____________________________________<br>Carlos Filipe Pinto de Oliveira Pereira</p>

<p style="margin-top: 2em;">O Segundo Outorgante</p>
<p>____________________________________<br>{{nome_completo}}</p>
`

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const admin = createAdminClient() as any

    // Check if template already exists
    const { data: existing } = await admin
      .from('recruitment_contract_templates')
      .select('id')
      .ilike('name', '%Contrato Prestação Serviços%')
      .limit(1)

    if (existing && existing.length > 0) {
      // Already exists — don't overwrite user edits
      return NextResponse.json({ id: existing[0].id, action: 'exists' })
    }

    // Create new
    const { data, error } = await admin
      .from('recruitment_contract_templates')
      .insert({
        name: 'Contrato Prestação Serviços - Lecoqimmo',
        description: 'Contrato de prestação de serviços para angariador imobiliário',
        content_html: CONTRACT_HTML.trim(),
        variables: ['nome_completo', 'tipo_documento', 'morada_completa', 'cc_numero', 'cc_validade', 'nif', 'data_contrato', 'comissao_percentagem', 'comissao_extenso'],
        is_active: true,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: data.id, action: 'created' })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro' }, { status: 500 })
  }
}
