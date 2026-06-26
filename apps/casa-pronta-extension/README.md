> **Nota do monorepo** — Esta extensão passou a viver no monorepo `infinity-apps`,
> em `apps/casa-pronta-extension/`, como workspace npm (`@infinity/casa-pronta-extension`,
> incluído automaticamente pelo glob `apps/*` do `package.json` raiz).
>
> Antes de carregar a extensão sem compactação é preciso instalar dependências e
> compilar:
>
> ```bash
> npm install                  # uma vez, na RAIZ do monorepo (liga workspaces, hoist de deps)
> npm run build:extension      # ou, dentro desta pasta: npm run build (tsc -b && vite build)
> ```
>
> O output da build fica em `dist/` (dentro desta pasta). É essa a pasta a escolher
> em `chrome://extensions` → "Carregar sem compactação".
>
> Para dev local é preciso criar `.env.local` (a partir de `.env.example`) e definir
> `VITE_SUPABASE_ANON_KEY`.

# MUBE — Casa Pronta Autofill

Extensão de browser (Manifest V3) que preenche automaticamente o formulário
de submissão de anúncios de Direito Legal de Preferência no portal Casa Pronta
a partir de dados do Infinity ERP.

## Desenvolvimento

```bash
npm install
npm run dev
```

Depois, em `chrome://extensions`:
1. Activar "Modo de programador"
2. "Carregar sem compactação" → escolher a pasta `dist/`

## Build

```bash
npm run build
```

## Estado

- [x] Passo 1 — Init repo (Vite + crxjs + React + TS + Tailwind)
- [ ] Passo 2 — Popup com login Supabase (mock de negócios)
- [ ] Passo 3 — Content script: deteção + botão flutuante
- [ ] Passo 4 — formFiller (campos simples)
- [ ] Passo 5 — cascadingSelects (Distrito→Concelho→Freguesia)
- [ ] Passo 6 — Integração popup ↔ content (chrome.runtime)
- [ ] Passo 7 — API real do Infinity ERP
