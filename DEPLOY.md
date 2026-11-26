# RegBot — Deploy Guide (PMIST CSE)

Step-by-step guide to take your CSE regulations chatbot + percentage website live.

> Want to run it on your own machine first (Antigravity / VS Code)? See **README.md** in the project root — `npm install`, add `.env.local` with a free Groq key, `npm run dev`.

---

## 1. What the app actually needs (3 things only)

| Need | Details |
|---|---|
| **Server runtime** | Node.js 20+ or Bun — because the chatbot runs on a server route (`/api/chat`) |
| **LLM API access** | The chatbot's "brain" — one API key from any LLM provider |
| **Database?** | **NO.** None. The RAG index is baked into the code (`src/data/regulations.ts`). No login, no user data stored, chat history lives only in the user's browser. |

So this is NOT a heavy app — one codebase, one API key, done.

---

## 2. Option 1 — Z.ai preview link (0 minutes, already live)

The app is already running on the Z.ai preview environment in this chat — that's the link at the top of the chat window.

- Good for: quick testing with classmates / showing your HoD.
- Not good for: permanent college use (sandbox environments can be recycled).

**Action: just share the preview link. Nothing to do.**

---

## 3. Option 2 — Vercel (FREE, permanent, custom domain) — RECOMMENDED for students

Vercel is free for hobby projects, made by the same team as Next.js. Perfect match.

### Step 2.1 — No code change needed (already provider-agnostic)

The chatbot's LLM call works with **OpenAI, Groq, Gemini (OpenAI-compat), or any provider** out of the box — plain `fetch`, no SDK lock-in. The provider is auto-detected from the key prefix (`gsk_…` → Groq, `sk-…` → OpenAI); override via `LLM_BASE_URL` / `LLM_MODEL` env vars if needed. (Inside the z.ai sandbox it falls back to the sandbox SDK automatically.)

### Step 2.2 — Push to GitHub

```bash
git init
git add -A
git commit -m "RegBot: PMIST CSE regulations chatbot"
git remote add origin https://github.com/<your-username>/regbot.git
git push -u origin main
```

(Exclude secrets: `.env*` files are already in `.gitignore` — never commit keys.)

### Step 2.3 — Deploy on Vercel

1. Go to **vercel.com** → Sign up with GitHub (free).
2. **Add New → Project** → Import your `regbot` repo.
3. Vercel auto-detects Next.js — leave build settings as default.
4. **Environment Variables** (Settings → Environment Variables) — add:

| Variable | Required | Example value |
|---|---|---|
| `LLM_API_KEY` | **YES** | your key — Groq `gsk_…` (free tier) or OpenAI `sk-…` |
| `LLM_BASE_URL` | no (auto-detected) | `https://api.groq.com/openai/v1` / `https://api.openai.com/v1` |
| `LLM_MODEL` | no (auto-detected) | Groq: `llama-3.3-70b-versatile` / OpenAI: `gpt-4o-mini` |

Also add `DATABASE_URL=file:./db/custom.db` (harmless template leftover, silences Prisma).

5. Click **Deploy**. 1-2 minutes later you get a live link like `regbot-xxxx.vercel.app`.

### Step 2.4 — Custom domain (optional)

Vercel → Project → Settings → Domains → add e.g. `regbot.yourdomain.com` and follow the DNS instructions. For a college subdomain (`regbot.pmist.ac.in`), you'll need the college IT/admin to add the DNS record — that's a permission thing, not a tech thing.

---

## 4. Option 3 — College server / own VPS (full self-hosting)

If your college gives you a Linux server, or you rent a cheap VPS:

```bash
# 1. Install Bun (one-time)
curl -fsSL https://bun.sh/install | bash

# 2. Get code + install
git clone https://github.com/<you>/regbot.git
cd regbot
bun install

# 3. Build + stage static files
bun run build
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/

# 4. Start on port 3000
bun run start        # runs: node .next/standalone/server.js
```

**Keep it running 24/7** (otherwise it dies when you close the terminal):

```bash
bun add -g pm2          # or: npm i -g pm2
pm2 start .next/standalone/server.js --name regbot
pm2 save
```

**LLM access on your own server** — set the key in the shell / PM2 ecosystem file:

```bash
export LLM_API_KEY=gsk_your_groq_key    # base URL + model auto-detected
```

**Put it on a domain** (VPS): point your domain's DNS A-record to the server IP, then reverse-proxy port 3000 with Caddy (easiest — auto HTTPS):

```
regbot.yourdomain.com {
    reverse_proxy localhost:3000
}
```

---

## 5. Cost summary

| Setup | Cost | Best for |
|---|---|---|
| Z.ai preview | Free | Testing right now |
| Vercel | Free (hobby tier) | **Permanent student project — pick this** |
| Groq LLM key | Free tier | The chatbot brain — start here |
| OpenAI LLM key | Pay-per-use (cheap for text chat) | If you prefer GPT quality |
| VPS | Roughly a few $/month, or free if college gives a server | Full control |

---

## 6. FAQ

**Is student data stored anywhere?**
No. No login, no database, no analytics. Chat history lives only in that browser's memory.

**Can it run fully offline on college LAN?**
The onboarding flow, regulation browsing and percentage calculators are all local code. The chatbot's *answer generation* needs the LLM API (internet). The retrieval (finding the right regulation clause) is fully offline.

**How do I update regulations next year?**
Replace the PDFs in `upload/`, rerun `scripts/build_regulations.py`, commit the regenerated `src/data/regulations.ts`, push — Vercel auto-deploys.

**Vercel free tier limit?**
Hobby tier is generous for a department tool. If you ever outgrow it, the same code runs on Option 3.
