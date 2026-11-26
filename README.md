# RegBot — PMIST CSE Department Regulation Assistant

A chatbot + percentage toolkit for the **Computer Science & Engineering Department, Periyar Maniammai Institute of Science & Technology (PMIST), Vallam, Thanjavur**. It answers questions about the **B.Tech R-2024**, **M.Tech (PG R-2024)** and **Ph.D. 2024** regulations, with clause-number citations like (R7.3).

- **Onboarding flow:** UG / PG / Staff → year → batch → regulation auto-load (wrong-batch fallback included)
- **RAG chatbot:** answers come only from the official regulation documents — no invented rules
- **Calculators:** 75% attendance (bunk) calculator, marks % ↔ grade, CGPA ↔ percentage
- **No login, no database, no user data stored** — the profile lives in the browser's localStorage

## Quick start (Tanglish)

1. Free API key eduthu kudinga: **https://console.groq.com/keys** (`gsk_...` varaium)
2. `.env.example` ah `.env.local` ah copy panni, antha key ah `LLM_API_KEY=` pinnadi paste pannunga
3. Terminal la: `npm install` → `npm run dev` → browser la **http://localhost:3000** open pannunga. Finished!

## Quick start (any editor — Antigravity / VS Code / terminal)

```bash
npm install                # or: bun install / pnpm install
cp .env.example .env.local # Windows: copy .env.example .env.local
#   → open .env.local and set LLM_API_KEY=gsk_your_groq_key
npm run dev                # → http://localhost:3000
```

Any OpenAI-compatible key works — **Groq (free, recommended)**, OpenAI, Gemini (OpenAI-compat endpoint), OpenRouter, local Ollama. The provider is auto-detected from the key prefix; override with `LLM_BASE_URL` / `LLM_MODEL` (see `.env.example`).

> No key set? Inside the z.ai web-dev sandbox the app still runs (SDK fallback). Everywhere else the chat needs a key — the rest of the app (onboarding, calculators, regulation data) is fully local.

## Tech stack

| Layer | Tools |
| --- | --- |
| Language | TypeScript (app), Python (one-time PDF → data script) |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui (Radix), lucide-react, react-markdown |
| Backend | Next.js API route `/api/chat`, custom BM25 RAG engine (`src/lib/rag.ts`), OpenAI-compatible LLM API via plain `fetch` |
| Data | `src/data/regulations.ts` (generated), localStorage profile — **no database** |

## Project structure

```
src/
  app/                     Next.js app router (page, layout, /api/chat)
  components/regbot/       RegBot UI (chat, onboarding, calculators, sidebar)
  data/                    regulations.ts (RAG chunks) + batches.ts (batch → regulation)
  lib/rag.ts               BM25 retrieval + context builder
scripts/
  build_regulations.py     PDFs in upload/ → src/data/regulations.ts (python3, pypdf)
upload/                    The 3 official regulation PDFs (source documents)
```

## Common commands

```bash
npm run dev      # dev server on port 3000
npm run build    # production build (output: standalone)
npm run lint     # eslint
python scripts/build_regulations.py   # regenerate regulations data after PDF updates
```

## Updating regulations next year

1. Replace / add the PDFs in `upload/`
2. `python scripts/build_regulations.py`
3. Commit the regenerated `src/data/regulations.ts` and redeploy

## Deploying

See **DEPLOY.md** — three options: Vercel (free, recommended), your own server (PM2 + Caddy), or the z.ai preview link.
