# AGENTS.md — RegBot

Guidance for any AI coding agent (Antigravity, Cursor, Claude Code, etc.) working on this repo.

## What this is
RegBot — a Next.js 16 chatbot for PMIST CSE Department regulations (B.Tech R-2024, M.Tech PG R-2024, Ph.D. 2024). RAG over the official regulation documents; answers must cite clause numbers. No database; the user profile is browser localStorage only.

## How to run
```bash
npm install                # or bun install
cp .env.example .env.local # then set LLM_API_KEY (free Groq key: console.groq.com/keys)
npm run dev                # http://localhost:3000
```
Requires Node.js 20+ (or Bun 1.3+). The LLM key is REQUIRED outside the z.ai sandbox — the chat API returns a clear error without it. Onboarding, calculators and regulation data work with no key.

## Key files
- `src/app/api/chat/route.ts` — chat endpoint: BM25 retrieval (`src/lib/rag.ts`) + OpenAI-compatible LLM call. Provider auto-detects from the key prefix (`gsk_` → Groq, `sk-` → OpenAI); override via `LLM_BASE_URL` / `LLM_MODEL`.
- `src/components/regbot/regbot-app.tsx` — the whole UI (onboarding flow, chat, sidebar). Client component; hydration-safe via a mounted gate (do not remove it).
- `src/data/regulations.ts` — RAG chunks. GENERATED FILE: edit `scripts/build_regulations.py` or the PDFs in `upload/`, never hand-edit.
- `src/data/batches.ts` — batch → year → regulation mapping for onboarding.

## Rules
- Answers must come only from the retrieved context (see the system prompt in the chat route). Never wire the LLM to answer regulations from its own knowledge.
- Keep the UI language support: Tanglish in → Tanglish out, English in → English out (part of the system prompt).
- No new heavy dependencies; the LLM call is plain `fetch` on purpose.

## Verify changes
```bash
npm run lint && npm run build
# then run dev and ask: "75% attendance rule enna?" — expect an answer citing (R7.x) clauses.
```
