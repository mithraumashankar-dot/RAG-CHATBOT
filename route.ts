import { NextResponse } from 'next/server';
import { retrieve, buildContext } from '@/lib/rag';
import { DOC_META, type RegDocId } from '@/data/regulations';
import type { UserProfile } from '@/data/batches';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface InMsg {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatBody {
  messages?: InMsg[];
  profile?: UserProfile;
}

// ---------------------------------------------------------------------------
// LLM provider — any OpenAI-compatible API (Groq / OpenAI / Gemini / custom).
//
// Configure in .env.local (see .env.example):
//   LLM_API_KEY    required — a Groq key (gsk_...), OpenAI key (sk-...), etc.
//   LLM_BASE_URL   optional — auto-detected from the key prefix if not set
//   LLM_MODEL      optional — sensible default per provider if not set
//
// If no key is configured, falls back to the z.ai sandbox SDK so the app
// keeps working inside the z.ai web-dev sandbox with zero configuration.
// ---------------------------------------------------------------------------

interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function resolveLlm(): LlmConfig | null {
  const apiKey = (
    process.env.LLM_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ''
  ).trim();
  if (!apiKey) return null;

  if (apiKey.startsWith('gsk_')) {
    // Groq (recommended, free tier) — https://console.groq.com/keys
    return {
      apiKey,
      baseUrl: process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1',
      model: process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
    };
  }

  // OpenAI key or any other OpenAI-compatible endpoint
  return {
    apiKey,
    baseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
  };
}

async function callOpenAiCompatible(
  cfg: LlmConfig,
  systemPrompt: string,
  history: InMsg[],
): Promise<string> {
  const res = await fetch(`${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.3,
      max_tokens: 800,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `LLM API error ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ` (${res.statusText})`}`,
    );
  }

  const completion = await res.json();
  return completion.choices?.[0]?.message?.content?.trim() ?? '';
}

async function callSandboxSdk(systemPrompt: string, history: InMsg[]): Promise<string> {
  const { default: ZAI } = await import('z-ai-web-dev-sdk');
  const zai = await ZAI.create();
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ],
    thinking: { type: 'disabled' },
  });
  return completion.choices[0]?.message?.content?.trim() ?? '';
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatBody;
    const history = (body.messages ?? [])
      .filter((m) => m && typeof m.content === 'string' && m.content.trim().length > 0)
      .slice(-12);

    const lastUser = [...history].reverse().find((m) => m.role === 'user');
    if (!lastUser) {
      return NextResponse.json({ error: 'No user message provided' }, { status: 400 });
    }

    const profile = body.profile;
    const doc: RegDocId = profile?.doc ?? 'ug';
    const docTitle = DOC_META[doc].title;

    // --- Retrieval ---
    const hits = retrieve(lastUser.content, doc, 8);
    const context = buildContext(hits);

    // --- Profile line ---
    const profileLine = profile
      ? profile.role === 'staff'
        ? `Staff / research-scholar user viewing the ${docTitle}.`
        : `${profile.role === 'ug' ? 'UG (B.Tech CSE)' : 'PG (M.Tech CSE)'} student, ${
            profile.year ? `${profile.year === 1 ? '1st' : profile.year === 2 ? '2nd' : profile.year === 3 ? '3rd' : '4th'} year, ` : ''
          }batch ${profile.batch ?? 'unknown'}, regulation ${profile.regulation}.`
      : 'Unknown profile.';

    const refWarning = profile?.referenceOnly
      ? `\nIMPORTANT: The user's own regulation (${profile.regulation}) is NOT loaded. The context below is from ${docTitle}, used only as REFERENCE — clearly warn that exact rules for the older batch may differ and they should confirm with the HoD / Dean (Academic Courses).`
      : '';

    const systemPrompt = [
      `You are "RegBot", the friendly regulation chatbot of the COMPUTER SCIENCE AND ENGINEERING (CSE) Department at Periyar Maniammai Institute of Science & Technology (PMIST), Vallam, Thanjavur.`,
      `User profile: ${profileLine}`,
      `The user's loaded regulation document is: ${docTitle}.${refWarning}`,
      ``,
      `RULES:`,
      `1. Answer ONLY from the CONTEXT clauses given below. When you use a rule, cite its clause number inline, like (R7.3) or (R4.10.1). Tables in the context can be summarised as short markdown tables.`,
      `2. Never invent rules, marks, dates or numbers. If the context does not contain the answer, say plainly that you could not find it in the loaded regulation and suggest confirming with the Class Advisor / Mentor / HoD / Dean (Academic Courses) / Controller of Examinations, as appropriate.`,
      `3. Match the user's language: if they type in Tanglish (Tamil + English mix), reply in the same friendly Tanglish; if they type plain English, reply in clear simple English.`,
      `4. Be concise — 3-8 short lines or a small bullet list. Put the KEY NUMBER in bold, e.g. **75% attendance**.`,
      `5. Greetings / small talk: reply warmly in ONE line without citations.`,
      ``,
      `CONTEXT (retrieved from ${docTitle}):`,
      context || '(no matching clauses found)',
    ].join('\n');

    // --- LLM call ---
    const llm = resolveLlm();
    let answer: string;
    if (llm) {
      answer = await callOpenAiCompatible(llm, systemPrompt, history);
    } else {
      try {
        answer = await callSandboxSdk(systemPrompt, history);
      } catch {
        return NextResponse.json(
          {
            error:
              'LLM is not configured. Create a .env.local file with LLM_API_KEY (any OpenAI-compatible key — free Groq key recommended, see .env.example).',
          },
          { status: 500 },
        );
      }
    }

    if (!answer) {
      return NextResponse.json({ error: 'Empty response from model' }, { status: 502 });
    }

    // --- Sources (dedup by clause) ---
    const seen = new Set<string>();
    const sources: { doc: string; clause: string; heading: string }[] = [];
    for (const h of hits) {
      const key = `${h.chunk.doc}-${h.chunk.clause}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sources.push({
        doc: DOC_META[h.chunk.doc].short,
        clause: h.chunk.clause,
        heading: h.chunk.heading.slice(0, 70),
      });
      if (sources.length >= 5) break;
    }

    return NextResponse.json({ answer, sources });
  } catch (err) {
    console.error('[api/chat] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Chat failed' },
      { status: 500 },
    );
  }
}
