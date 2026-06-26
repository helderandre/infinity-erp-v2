# Política de Privacidade — MUBE Casa Pronta Autofill

**Última actualização:** 9 de Abril de 2026

## 1. Quem somos

Esta extensão de browser ("MUBE Casa Pronta Autofill", doravante "a Extensão") é
desenvolvida pela **MUBE** ("nós") para uso interno dos consultores imobiliários do
grupo Infinity / RE/MAX Convictus ("o utilizador" ou "tu").

**Contacto:** [a preencher — ex: privacidade@mube.pt]

## 2. O que faz a Extensão

A Extensão automatiza o preenchimento do formulário público de Direito Legal de
Preferência no portal Casa Pronta (https://www.casapronta.pt), a partir de dados já
existentes no Infinity ERP (o CRM interno da MUBE). O objectivo é poupar tempo e
reduzir erros de transcrição manual.

## 3. Que dados a Extensão recolhe

A Extensão **não recolhe nem envia** qualquer dado para servidores da MUBE. Os dados
circulam apenas entre:

1. O browser do utilizador
2. O Supabase do Infinity ERP (o backend do CRM da MUBE)
3. O portal Casa Pronta (onde os dados são preenchidos no formulário, mas **nunca submetidos** pela Extensão)

Concretamente, a Extensão lida com:

- **Credenciais de autenticação do Infinity ERP**
  - Email e palavra-passe introduzidos no ecrã de login do popup
  - Tokens de sessão (access token + refresh token) devolvidos pelo Supabase
  - **Estes dados são guardados localmente** em `chrome.storage.local` (storage privado
    da extensão, isolado de outras extensões e websites)
  - **Nunca são transmitidos para a MUBE.** São transmitidos apenas para o Supabase do
    Infinity ERP durante o login e a renovação de sessão.

- **Dados de negócios imobiliários**
  - Ao listar negócios no popup e ao preencher o formulário, a Extensão lê do
    Supabase do Infinity ERP: informação do negócio (referência, valor, data),
    do imóvel (endereço, áreas), dos intervenientes (vendedores, comprador) e do
    consultor autenticado (nome, NIF, email, telefone, morada — usados como
    requerente no formulário do Casa Pronta).
  - Estes dados permanecem em memória do browser durante a sessão. O único dado
    persistido é o **ID do negócio activo** (um identificador UUID), guardado em
    `chrome.storage.local`.

- **Dados de preenchimento do Casa Pronta**
  - Ao clicares em "Preencher campos", os dados acima são escritos directamente nos
    campos do formulário do Casa Pronta na tua tab do browser.
  - A Extensão **nunca submete** o formulário. A submissão é sempre feita manualmente
    por ti, depois de reveres os dados.

## 4. O que a Extensão NÃO faz

- ❌ Não regista o teu histórico de navegação
- ❌ Não acede a outras tabs ou a outros websites além do Casa Pronta e do Supabase
  do Infinity ERP
- ❌ Não usa cookies de terceiros nem analytics
- ❌ Não partilha dados com terceiros
- ❌ Não envia telemetria para a MUBE
- ❌ Não lê documentos nem ficheiros do teu computador
- ❌ Não submete formulários em teu nome

## 5. Permissões solicitadas e porquê

A Extensão usa as seguintes permissões do Chrome / Edge / Brave:

- **`storage`** — para persistir a tua sessão Supabase e o ID do negócio activo
  entre aberturas do popup, para que não tenhas de fazer login repetidamente.
- **Acesso a `https://www.casapronta.pt/CasaPronta/*`** — para injectar o botão
  flutuante e ler/escrever os campos do formulário de Direito de Preferência.
- **Acesso a `https://umlndumjfamfsswwjgoo.supabase.co/*`** — para falar com o backend
  do Infinity ERP (autenticação e leitura de negócios).

A Extensão **não pede** permissões como `tabs`, `activeTab`, `cookies`, `history`,
`bookmarks`, `webRequest`, `downloads`, nem acesso a ficheiros locais.

## 6. Retenção de dados

- Os tokens de autenticação são mantidos enquanto a sessão do Supabase for válida.
- O ID do negócio activo é mantido até fazeres "Mudar de negócio" ou "Sair".
- Ao clicares em "Sair", todos os dados locais da extensão são apagados.
- Ao desinstalares a extensão, todos os dados locais são apagados automaticamente
  pelo browser.

## 7. Segurança

- Toda a comunicação com o Supabase é feita sobre HTTPS com TLS.
- Toda a comunicação com o Casa Pronta é feita sobre HTTPS com TLS.
- A extensão usa a chave publicável do Supabase (anon key), que é desenhada para ser
  incluída em código cliente. O controlo de acesso efectivo é feito pelo servidor
  Supabase com base no teu login.

## 8. Direitos do utilizador

Ao abrigo do RGPD, tens direito a:
- Aceder aos dados que temos sobre ti no Infinity ERP
- Rectificar dados incorrectos
- Pedir a eliminação dos teus dados
- Pedir a portabilidade dos teus dados
- Opor-te ao tratamento dos teus dados

Para exercer estes direitos, contacta a MUBE em **[email a preencher]**.

## 9. Alterações a esta política

Podemos actualizar esta política ocasionalmente. Alterações significativas serão
comunicadas via actualização da extensão e atualização da data no topo deste documento.

## 10. Contacto

Para qualquer questão sobre esta política ou sobre o tratamento dos teus dados,
contacta-nos em: **[email a preencher]**
