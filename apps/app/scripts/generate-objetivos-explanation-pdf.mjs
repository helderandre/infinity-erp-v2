import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = path.resolve(__dirname, '..', 'objetivos-calculos-explicacao.pdf')

const html = `<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<title>Objectivos — Parâmetros e Cálculos</title>
<style>
  @page { margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  html, body { padding: 0; margin: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 10.5pt;
    color: #0f172a;
    line-height: 1.55;
  }
  h1 { font-size: 20pt; margin: 0 0 6pt; color: #0f172a; letter-spacing: -0.01em; }
  .subtitle { color: #64748b; font-size: 10pt; margin-bottom: 18pt; }
  h2 { font-size: 14pt; margin: 22pt 0 8pt; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4pt; }
  h3 { font-size: 11.5pt; margin: 14pt 0 6pt; color: #0f172a; }
  p { margin: 0 0 8pt; }
  ul, ol { margin: 0 0 10pt 18pt; padding: 0; }
  li { margin-bottom: 4pt; }
  code {
    font-family: "SF Mono", Menlo, Consolas, monospace;
    background: #f1f5f9;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 9.5pt;
    color: #0f172a;
  }
  pre {
    background: #0f172a;
    color: #e2e8f0;
    padding: 10pt 12pt;
    border-radius: 6pt;
    font-family: "SF Mono", Menlo, Consolas, monospace;
    font-size: 9pt;
    line-height: 1.5;
    overflow-x: auto;
    margin: 8pt 0 12pt;
    white-space: pre-wrap;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 6pt 0 12pt;
    font-size: 9.5pt;
  }
  th, td {
    border: 1px solid #e2e8f0;
    padding: 6pt 8pt;
    text-align: left;
    vertical-align: top;
  }
  th { background: #f8fafc; font-weight: 600; color: #334155; }
  tr:nth-child(even) td { background: #fafbfc; }
  .callout {
    border-left: 3px solid #f59e0b;
    background: #fffbeb;
    padding: 10pt 12pt;
    border-radius: 4pt;
    margin: 10pt 0;
  }
  .callout.danger { border-left-color: #ef4444; background: #fef2f2; }
  .callout.info { border-left-color: #3b82f6; background: #eff6ff; }
  .callout strong { color: #92400e; }
  .callout.danger strong { color: #991b1b; }
  .callout.info strong { color: #1e40af; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 16pt 0; }
  .muted { color: #64748b; }
  .tag {
    display: inline-block;
    background: #f1f5f9;
    color: #475569;
    font-size: 8.5pt;
    padding: 1px 7px;
    border-radius: 3px;
    margin-right: 4px;
  }
  .footer-note { margin-top: 22pt; padding-top: 10pt; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 9pt; }
</style>
</head>
<body>

<h1>Objectivos &mdash; Parâmetros e Cálculos</h1>
<p class="subtitle">ERP Infinity Group &middot; Documento explicativo da fórmula de funil de receita</p>

<h2>Parâmetros do objectivo (tabela <code>temp_consultant_goals</code>)</h2>

<h3>1. Configuração base &mdash; sempre obrigatória</h3>
<table>
  <thead>
    <tr><th style="width: 28%">Campo</th><th>Descrição</th><th style="width: 22%">Exemplo</th></tr>
  </thead>
  <tbody>
    <tr><td><code>annual_revenue_target</code></td><td><strong>&euro; líquidos que queres ganhar TU no ano</strong> (não a agência)</td><td>&euro;98.400 (= 8.200 &times; 12)</td></tr>
    <tr><td><code>pct_sellers</code></td><td>% do objectivo que vem de vendedores (angariações tuas)</td><td>50%</td></tr>
    <tr><td><code>pct_buyers</code></td><td>% do objectivo que vem de compradores</td><td>50%</td></tr>
    <tr><td><code>working_weeks_year</code></td><td>Semanas úteis (descontando férias)</td><td>48</td></tr>
    <tr><td><code>working_days_week</code></td><td>Dias úteis por semana</td><td>5</td></tr>
  </tbody>
</table>

<h3>2. Funil COMPRADOR &mdash; opcional</h3>
<table>
  <thead><tr><th style="width: 32%">Campo</th><th>Descrição</th></tr></thead>
  <tbody>
    <tr><td><code>buyers_avg_purchase_value</code></td><td>Preço médio do imóvel comprado (&euro;)</td></tr>
    <tr><td><code>buyers_avg_commission_pct</code></td><td><strong>% de comissão que TU recebes líquida</strong> (ver aviso abaixo)</td></tr>
    <tr><td><code>buyers_close_rate</code></td><td>% de qualificados que chegam a escritura</td></tr>
    <tr><td><code>buyers_pct_lead_to_qualified</code></td><td>% de leads que se qualificam</td></tr>
    <tr><td><code>buyers_avg_calls_per_lead</code></td><td>Chamadas médias por lead</td></tr>
  </tbody>
</table>

<h3>3. Funil VENDEDOR &mdash; opcional</h3>
<table>
  <thead><tr><th style="width: 32%">Campo</th><th>Descrição</th></tr></thead>
  <tbody>
    <tr><td><code>sellers_avg_sale_value</code></td><td>Preço médio do imóvel vendido (&euro;)</td></tr>
    <tr><td><code>sellers_avg_commission_pct</code></td><td><strong>% de comissão que TU recebes líquida</strong></td></tr>
    <tr><td><code>sellers_pct_listings_sold</code></td><td>% das angariações que efectivamente vendem</td></tr>
    <tr><td><code>sellers_pct_visit_to_listing</code></td><td>% das visitas que viram angariação</td></tr>
    <tr><td><code>sellers_pct_lead_to_visit</code></td><td>% dos leads que dão visita</td></tr>
    <tr><td><code>sellers_avg_calls_per_lead</code></td><td>Chamadas médias por lead</td></tr>
  </tbody>
</table>

<h2>A lógica do cálculo CPCV/Escritura &mdash; o teu caso</h2>

<p>A fórmula assume que <strong>1 escritura = 1 deal completo = recebes a comissão toda</strong>. Não distingue dinheiro recebido no CPCV vs na escritura &mdash; trata como um único evento de receita. O cálculo é em <strong>cascade reverso</strong>:</p>

<pre>Objectivo mensal = &euro;8.200
&darr; dividido entre buyer/seller (50/50)
Receita mensal buyer  = &euro;4.100
Receita mensal seller = &euro;4.100

Para o buyer (assumindo &euro;200k preço médio, 5% comissão):
  Comissão por escritura     = 200.000 &times; 5% = &euro;10.000
  Escrituras necessárias/mês = 4.100 / 10.000 = 0,41
  CPCV/mês                   = 0,41 / 0,95 (95% dos CPCV viram escritura) = 0,43</pre>

<div class="callout info">
  <strong>Por isso aparece &laquo;0.3 escrituras&raquo;.</strong> Porque o sistema acha que cada escritura te dá &euro;10.000 líquidos.
</div>

<h2>Onde está a confusão &mdash; e tens razão</h2>

<p>A fórmula em <code>lib/goals/calculations.ts</code> (linhas 60 e 96) é:</p>

<pre>commissionPerSale = avg_sale_value &times; (avg_commission_pct / 100)</pre>

<p>Isto trata <code>avg_commission_pct</code> <strong>como SE FOSSE a tua fatia líquida</strong>. Mas em Portugal a realidade é:</p>

<pre>Imóvel &euro;200.000
&#x2514;&#x2500; Agência cobra 5% = &euro;10.000 (gross)
   &#x2514;&#x2500; Tu recebes 50% de split = &euro;5.000 (net) — ou outro %
      &#x2514;&#x2500; Menos IRS, IVA, despesas... pode chegar a &euro;3.500 líquidos</pre>

<div class="callout danger">
  <strong>Resultado:</strong> Se inseres <code>5%</code> no campo, o sistema acha que recebes &euro;10.000 por deal, mas na realidade ganhas &euro;5.000.
  <br>O sistema diz que precisas de <strong>0.3 escrituras</strong> quando na verdade precisas de <strong>0.6 ou mais</strong>.
</div>

<h3>Como resolver isso HOJE (sem mudar código)</h3>
<p>Insere a tua <strong>comissão líquida real</strong> no campo:</p>
<ul>
  <li>Se a agência cobra 5% e tu fazes 50/50 split &rarr; mete <strong>2,5%</strong> no campo</li>
  <li>Se ainda descontas IRS/IVA &rarr; mete <strong>~1,75%</strong> no campo</li>
  <li>Em alternativa: mantém os 5% mas reduz <code>annual_revenue_target</code> para o valor <em>gross</em> da agência (ex: &euro;196.800 em vez dos &euro;98.400 que queres líquido)</li>
</ul>

<h3>O que falta no modelo (e que te está a confundir)</h3>
<p>O sistema <strong>não</strong> modela:</p>
<ol>
  <li><strong>Split agência/consultor</strong> (campo separado tipo <code>commission_split_pct = 50</code>)</li>
  <li><strong>CPCV vs Escritura como eventos de receita distintos</strong> (em PT, parte da comissão chega no CPCV via sinal e o resto na escritura &mdash; o sistema só conta na escritura)</li>
  <li><strong>Encargos fiscais</strong> (IRS, IVA, retenção)</li>
</ol>

<hr>

<h2>Recomendação &mdash; duas opções</h2>

<h3>Opção A &mdash; Quick-fix (sem migration)</h3>
<p>Clarificar a UI do <code>&lt;GoalConfigForm&gt;</code> para deixar explícito que <code>avg_commission_pct</code> deve ser a <strong>% líquida que recebes</strong> (depois do split), com tooltip e exemplo prático.</p>
<p><span class="tag">Esforço</span> ~30 minutos &nbsp; <span class="tag">Risco</span> Nenhum</p>

<h3>Opção B &mdash; Modelo correcto (com migration)</h3>
<p>Adicionar 2 campos novos &mdash; <code>commission_split_pct</code> (% que fica para o consultor após split com a agência) e <code>effective_commission_pct</code> calculado &mdash; e refazer a fórmula:</p>
<pre>commissionPerSale = avg_value &times; (gross_pct / 100) &times; (split_pct / 100)</pre>
<p>Mais correcto mas implica migration + actualizar form + recalcular dashboards.</p>
<p><span class="tag">Esforço</span> ~2-3 horas &nbsp; <span class="tag">Risco</span> Médio (migration + recalcular dados)</p>

<div class="footer-note">
  Documento gerado a partir da análise das APIs <code>/api/goals/*</code> e do módulo <code>lib/goals/calculations.ts</code> &middot; ERP Infinity Group.
</div>

</body>
</html>`

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

try {
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' },
  })
  console.log('PDF gerado em:', outPath)
} finally {
  await browser.close()
}
