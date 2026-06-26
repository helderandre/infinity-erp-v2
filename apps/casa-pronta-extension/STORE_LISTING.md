# Chrome Web Store — Textos de Submissão

Copia estes campos directamente para o formulário de submissão em
https://chrome.google.com/webstore/devconsole

---

## Nome da extensão
(máximo 45 caracteres — o nosso tem 34)

```
MUBE — Casa Pronta Autofill
```

---

## Resumo / Short description
(máximo 132 caracteres — o nosso tem 108)

```
Preenche o formulário de Direito de Preferência do Casa Pronta a partir dos negócios do Infinity ERP.
```

---

## Descrição detalhada

```
A MUBE Casa Pronta Autofill poupa horas de trabalho manual aos consultores
imobiliários que submetem anúncios de Direito Legal de Preferência no portal
Casa Pronta (https://www.casapronta.pt).

🎯 COMO FUNCIONA

1. Faz login com as tuas credenciais do Infinity ERP (o CRM interno da MUBE /
   RE/MAX Convictus).
2. Escolhe o negócio que queres submeter.
3. Navega para o formulário "Novo Anúncio" do Casa Pronta e faz login com a tua
   Chave Móvel Digital ou credenciais institucionais.
4. Clica no botão "⚡ Preencher com MUBE" que aparece no canto superior direito.
5. Revê os dados no painel de preview e confirma.
6. Todos os campos do formulário são preenchidos automaticamente — requerente,
   vendedores, comprador, identificação do imóvel, localização (incluindo
   distrito, concelho e freguesia), e dados da transmissão.
7. Revês uma última vez e submetes manualmente.

✨ O QUE É PREENCHIDO AUTOMATICAMENTE

• Dados do Requerente (nome, NIF, email, telefone, endereço do consultor)
• Vendedores (até 11 proprietários, vindos do Infinity ERP)
• Comprador
• Identificação do imóvel (descrição em ficha, artigo matricial, fracção, quota)
• Áreas (bruta privativa, total)
• Localização completa (distrito → concelho → freguesia, com cascading selects)
• Dados da Transmissão (tipo, preço, data previsível, observações)

🔒 PRIVACIDADE & SEGURANÇA

• Uso exclusivamente interno para a equipa MUBE / Infinity Group
• Nenhum dado é enviado para a MUBE — toda a comunicação é directa entre o teu
  browser, o Supabase do Infinity ERP e o portal Casa Pronta
• A extensão nunca submete o formulário por ti — tu revês e submetes sempre
• Política de privacidade completa disponível no link abaixo

📋 REQUISITOS

• Ter conta activa no Infinity ERP da MUBE
• Ter credenciais de acesso ao portal Casa Pronta (Chave Móvel Digital ou conta
  institucional)

⚠️ EXTENSÃO PRIVADA

Esta extensão é distribuída de forma privada (Unlisted) e destina-se exclusivamente
a consultores da MUBE / Infinity Group / RE/MAX Convictus. Não é um produto
comercial geral.

— MUBE, Abril 2026
```

---

## Categoria
```
Productivity
```

## Idioma principal
```
Portuguese (Portugal) — pt_PT
```

## Visibilidade
```
Unlisted
```

## URL da Privacy Policy
```
[a preencher — ex: https://mube.pt/privacidade-casa-pronta]
```

## Justificação de permissões (caso seja pedido)

**Para `storage`:**
```
Usamos chrome.storage.local para persistir a sessão autenticada do Supabase
(tokens JWT) e o ID do negócio activo que o utilizador seleccionou no popup, para
que a extensão funcione entre aberturas do popup sem ter de fazer login repetidamente.
```

**Para acesso a `https://www.casapronta.pt/CasaPronta/*`:**
```
A extensão injecta um content script no formulário de Direito Legal de Preferência
do Casa Pronta (https://www.casapronta.pt/CasaPronta/preferencias/PrePasso1.jsp)
para adicionar um botão "Preencher com MUBE" e, quando o utilizador o clica,
preenche automaticamente os campos do formulário com dados vindos do Infinity ERP.
A extensão nunca submete o formulário — a submissão é sempre manual pelo utilizador.
```

**Para acesso a `https://umlndumjfamfsswwjgoo.supabase.co/*`:**
```
Este é o URL do Supabase do Infinity ERP (o CRM interno da MUBE). A extensão
autentica o utilizador contra este Supabase e lê a informação do negócio
seleccionado para preencher o formulário do Casa Pronta.
```

**"Single purpose" da extensão:**
```
Preencher automaticamente o formulário de Direito Legal de Preferência do portal
público Casa Pronta, a partir de dados de um CRM privado (Infinity ERP), para
consultores imobiliários.
```

**"Remote code"?**
```
No. Não executamos código remoto. Todo o código JavaScript está empacotado no
zip submetido.
```
