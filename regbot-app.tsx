'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GraduationCap, RotateCcw, Send, Menu, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import {
  REG_SETS,
  YEARS_PG,
  YEARS_UG,
  ayLabel,
  batchesForRole,
  currentAcademicYear,
  regLabelForDoc,
  yearFromBatch,
  yearLabel,
  type RegDocId,
  type RoleId,
  type UserProfile,
} from '@/data/batches';
import { MessageBubble, type ChatMessage, type Citation } from './message-bubble';
import { CalculatorsButton } from './calculators';

type Phase = 'boot' | 'role' | 'year' | 'batch' | 'staffdoc' | 'ready';

interface Chip {
  label: string;
  value: string;
}

const STORE_KEY = 'regbot-profile-v1';

const QUICK_TOPICS: Record<RegDocId, string[]> = {
  ug: [
    '75% attendance rule enna?',
    'SA grade enna?',
    'Arrear attempts limit enna?',
    'Max credits per semester enna?',
    'Project Phase 1 / 2 rules sollu',
    'Industrial training credits enna?',
    'Honours degree eligibility',
  ],
  pg: [
    'Attendance rules sollu',
    'Project work rules enna?',
    'Elective drop / add rules',
    'Max credits per semester enna?',
    'Internship credits enna?',
    'Arrear attempt rules',
  ],
  phd: [
    'Coursework credits enna?',
    'Comprehensive exam rules',
    'Supervisor change rules',
    'Thesis submission timeline',
    'Progress report rules',
  ],
};

let seq = 0;
const nextId = () => `m${++seq}`;

export function RegBotApp() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>('boot');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chips, setChips] = useState<Chip[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  // Hydration-safe mount gate. See comment before the render below.
  const [mounted, setMounted] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const msgRef = useRef<ChatMessage[]>([]);
  const profileRef = useRef<UserProfile | null>(null);
  msgRef.current = messages;
  profileRef.current = profile;

  // ---------- persistence / boot ----------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as UserProfile;
        if (p && ['ug', 'pg', 'phd'].includes(p.doc) && p.regulation) {
          setProfile(p);
          setPhase('ready');
          setMessages([
            {
              id: nextId(),
              role: 'bot',
              text: `Welcome back! Un profile ready: **${summaryOf(p)}**. Kelai kekkalam — type pannu.`,
            },
          ]);
          return;
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
    startOnboarding();
  }, []);

  const startOnboarding = useCallback(() => {
    setProfile(null);
    setPhase('role');
    setMessages([
      {
        id: nextId(),
        role: 'bot',
        text:
          'Vanakkam! Naan **RegBot** — PMIST **CSE Department** oda regulation assistant. ' +
          'B.Tech, M.Tech and Ph.D regulation rules ellame indha chat la kekkalam. ' +
          'First, un status ah sollu:',
      },
    ]);
    setChips([
      { label: 'UG Student (B.Tech)', value: 'ug' },
      { label: 'PG Student (M.Tech)', value: 'pg' },
      { label: 'Staff / Research Scholar', value: 'staff' },
    ]);
    setInput('');
    setBusy(false);
  }, []);

  const saveProfile = (p: UserProfile | null) => {
    setProfile(p);
    try {
      if (p) localStorage.setItem(STORE_KEY, JSON.stringify(p));
      else localStorage.removeItem(STORE_KEY);
    } catch {
      /* storage full / unavailable */
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // ---------- auto scroll ----------
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, chips, busy]);

  // ---------- helpers ----------
  const botSay = (text: string, nextChips?: Chip[]) => {
    setMessages((prev) => [...prev, { id: nextId(), role: 'bot', text }]);
    if (nextChips !== undefined) setChips(nextChips);
  };

  const userSay = (text: string) => {
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', text }]);
  };

  // ---------- onboarding chip handler ----------
  const handleChip = (chip: Chip) => {
    if (busy) return;
    userSay(chip.label);
    setChips([]);

    if (phase === 'role') {
      const role = chip.value as RoleId;
      if (role === 'staff') {
        setPhase('staffdoc');
        botSay(
          'Staff / Research Scholar — noted! Entha regulation set venum? Select pannu:',
          REG_SETS.map((s) => ({ label: s.label, value: s.doc })),
        );
      } else {
        setPhase('year');
        const years = role === 'ug' ? YEARS_UG : YEARS_PG;
        botSay(
          role === 'ug'
            ? 'Semma! **B.Tech CSE (UG)** student. Enta year la irukka?'
            : '**PG (M.Tech CSE)** student. Enta year la irukka?',
          years.map((y) => ({ label: `${yearLabel(y)} Year`, value: String(y) })),
        );
      }
      savePartial({ role });
      return;
    }

    if (phase === 'year') {
      const year = parseInt(chip.value, 10);
      const role = profileRef.current?.role ?? 'ug';
      setPhase('batch');
      savePartial({ role, year });
      botSay(
        'Super! Last step — **entha batch**? (admission year based, e.g. 2024-2028)',
        batchesForRole(role).map((b) => ({ label: b.batch, value: b.batch })),
      );
      return;
    }

    if (phase === 'batch') {
      const partial = profileRef.current as { role: RoleId; year?: number } | null;
      const role = partial?.role ?? 'ug';
      const chosenYear = partial?.year ?? 1;
      const def = batchesForRole(role).find((b) => b.batch === chip.value);
      if (!def) return;

      const actualYear = yearFromBatch(def);
      const ay = currentAcademicYear();

      if (actualYear !== chosenYear) {
        botSay(
          `Konjam correction — **${def.batch}** batch ippo **${yearLabel(actualYear)} year** la dhaan irukku (AY ${ayLabel(ay)}). ` +
            `Athanaala un year ah **${yearLabel(actualYear)} year** ah set pannitten.`,
        );
      } else {
        botSay(`Perfect — **${def.batch}** batch, **${yearLabel(actualYear)} year**. Record pannitten.`);
      }

      const finalProfile: UserProfile = {
        role,
        year: actualYear,
        batch: def.batch,
        doc: def.doc ?? 'ug',
        regulation: def.doc ? regLabelForDoc(def.doc) : def.regulation,
        referenceOnly: !def.doc,
        note: def.note,
      };
      saveProfile(finalProfile);
      setPhase('ready');

      if (!def.doc) {
        botSay(
          `Note: un batch ku **${def.regulation}** dhaan exact regulation — aana andha PDF innum load aagala. ` +
            'Naan **B.Tech R-2024** ah reference va answer panren; konjam rules differ agalam. ' +
            'Confirm panna HoD / Dean (Academic Courses) kitta kelunga.',
        );
      }
      const loadLabel = finalProfile.referenceOnly
        ? 'B.Tech R-2024 (reference mode)'
        : finalProfile.regulation;
      botSay(
        `**${loadLabel}** regulations loaded. Ippo keekalai — attendance rules, internal marks, arrears, project, CGPA... enna venum nu type pannu.`,
      );
      return;
    }

    if (phase === 'staffdoc') {
      const doc = chip.value as RegDocId;
      const finalProfile: UserProfile = {
        role: 'staff',
        doc,
        regulation: regLabelForDoc(doc),
      };
      saveProfile(finalProfile);
      setPhase('ready');
      botSay(
        `**${regLabelForDoc(doc)}** regulations loaded. Coursework, exams, supervisor rules, viva — keekalai, type pannu.`,
      );
      return;
    }
  };

  // keep partial profile (role / year) during onboarding
  const savePartial = (partial: { role: RoleId; year?: number }) => {
    setProfile((prev) => (prev ? { ...prev, ...partial } : { ...partial, doc: 'ug', regulation: '' }));
  };

  // ---------- chat ----------
  const sendQuestion = async (text: string) => {
    const q = text.trim();
    if (!q || busy || phase !== 'ready' || !profileRef.current) return;

    userSay(q);
    setInput('');
    setBusy(true);

    try {
      const history = [...msgRef.current]
        .filter((m) => !m.pending)
        .map((m) => ({
          role: m.role === 'bot' ? ('assistant' as const) : ('user' as const),
          content: m.text,
        }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...history.slice(-12), { role: 'user', content: q }],
          profile: profileRef.current,
        }),
      });

      const data = (await res.json()) as { answer?: string; sources?: Citation[]; error?: string };
      if (!res.ok || !data.answer) throw new Error(data.error || 'Chat failed');

      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'bot', text: data.answer!, citations: data.sources ?? [] },
      ]);
    } catch (err) {
      console.error('chat error', err);
      toast({
        title: 'Connection problem',
        description: 'Chat backend la onnu technical issue. Thirumba try pannu.',
        variant: 'destructive',
      });
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'bot',
          text: 'Aiyo — server la onnu technical problem vanthuchu. Intha question ah thirumba anuppu (retry pannu).',
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  // ---------- render ----------
  // Hydration-safe mount gate (fixes the console error
  // "A tree hydrated but some attributes ... didn't match").
  // Next.js 16 + React 19.2 changed the `useId` prefix, and Radix
  // Dialog/Sheet triggers get aria-controls from `useId` — the SSR pass and
  // the client hydration can generate different values (known upstream
  // issue: radix-ui/primitives#3700). This app is a pure client-side chatbot
  // (the profile boots from localStorage inside an effect anyway), so we
  // render a static shell on the server AND on the first client render.
  // Identical HTML on both sides => hydration always matches; all Radix
  // components (and render-time `new Date()` calls like currentAcademicYear)
  // mount only after hydration, fully client-side.
  if (!mounted) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-3 bg-stone-50 text-stone-900">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700 text-white">
          <GraduationCap className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-stone-500">Loading RegBot...</p>
      </div>
    );
  }

  const showTyping = busy;
  const ready = phase === 'ready' && profile;

  return (
    <div className="flex h-[100dvh] flex-col bg-stone-50 text-stone-900">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-white px-3 sm:px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-white">
          <GraduationCap className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold leading-tight">RegBot</h1>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">
            PMIST CSE Dept — Regulation Assistant
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Mobile side panel */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-4">
              <SheetTitle className="sr-only">Profile and quick asks</SheetTitle>
              <SidePanel profile={profile} onTopic={(t) => sendQuestion(t)} onRestart={startOnboarding} />
            </SheetContent>
          </Sheet>
          <CalculatorsButton variant="ghost" />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Restart onboarding"
            title="Restart profile setup"
            onClick={startOnboarding}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-r bg-white p-4 lg:block regbot-scroll">
          <SidePanel profile={profile} onTopic={(t) => sendQuestion(t)} onRestart={startOnboarding} />
        </aside>

        {/* Chat column */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            className="regbot-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6"
            aria-live="polite"
          >
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {phase === 'boot' && (
                <div className="py-20 text-center text-sm text-muted-foreground">Loading RegBot...</div>
              )}
              {messages.map((m) => (
                <div key={m.id} className="regbot-msg">
                  <MessageBubble msg={m} />
                </div>
              ))}
              {showTyping && <MessageBubble msg={{ id: 'typing', role: 'bot', text: '', pending: true }} />}
              {chips.length > 0 && phase !== 'ready' && (
                <div className="flex flex-wrap gap-2 pl-10">
                  {chips.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => handleChip(c)}
                      className="min-h-[44px] rounded-full border border-emerald-200 bg-white px-4 text-sm font-medium text-emerald-800 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-[0.98]"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick topics + input */}
          <div className="shrink-0 border-t bg-white/80 backdrop-blur">
            <div className="mx-auto max-w-3xl px-3 py-3 sm:px-6">
              {ready && (
                <div className="regbot-scroll mb-2.5 flex gap-2 overflow-x-auto pb-1">
                  <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Sparkles className="h-3 w-3" aria-hidden="true" /> Quick asks
                  </span>
                  {(QUICK_TOPICS[profile?.doc ?? 'ug'] ?? []).map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={busy}
                      onClick={() => sendQuestion(t)}
                      className="min-h-[36px] shrink-0 rounded-full border bg-stone-50 px-3 text-xs font-medium text-stone-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendQuestion(input);
                }}
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={!ready || busy}
                  placeholder={
                    ready ? 'Regulation question ah type pannu...' : 'Munnadi quick reply ah select pannu...'
                  }
                  aria-label="Type your regulation question"
                  className="h-11 rounded-xl"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-xl bg-emerald-700 hover:bg-emerald-800"
                  disabled={!ready || busy || !input.trim()}
                  aria-label="Send question"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </Button>
              </form>
            </div>
          </div>
        </main>
      </div>

      {/* Footer (sticky) */}
      <footer className="shrink-0 border-t bg-white px-4 py-2.5 text-center text-[11px] leading-snug text-muted-foreground">
        PMIST CSE Department · Sources: B.Tech R-2024, PG R-2024, Ph.D. 2024 regulations (640+ clause
        chunks indexed) · Final authority: Dean (Academic Courses)
      </footer>
    </div>
  );
}

function summaryOf(p: UserProfile): string {
  if (p.role === 'staff') return `Staff / Scholar — ${regLabelForDoc(p.doc)}`;
  return `${p.role === 'ug' ? 'B.Tech (UG)' : 'PG (M.Tech)'} ${p.year ? yearLabel(p.year) + ' year' : ''}${p.batch ? ', batch ' + p.batch : ''} — ${p.regulation}`;
}

// ---------- Sidebar content ----------
function SidePanel({
  profile,
  onTopic,
  onRestart,
}: {
  profile: UserProfile | null;
  onTopic: (t: string) => void;
  onRestart: () => void;
}) {
  const ay = currentAcademicYear();
  return (
    <div className="space-y-4">
      {/* Profile card */}
      <section className="rounded-xl border bg-stone-50 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Un Profile
        </h2>
        {profile ? (
          <div className="mt-3 space-y-2.5">
            <p className="text-sm font-semibold">{summaryOf(profile)}</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.batch && <Badge variant="secondary">Batch {profile.batch}</Badge>}
              {profile.year ? (
                <Badge variant="secondary">{yearLabel(profile.year)} year</Badge>
              ) : null}
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                {profile.regulation}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">Academic year {ayLabel(ay)}</p>
            {profile.referenceOnly && (
              <p className="rounded-md bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-800">
                Reference mode: exact regulation for this batch is not uploaded — answers use R-2024
                as base.
              </p>
            )}
            <button
              type="button"
              onClick={onRestart}
              className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Restart profile setup
            </button>
          </div>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Onboarding mudinja udan un profile indha card la kaattum.
          </p>
        )}
      </section>

      {/* Quick topics */}
      {profile && (
        <section className="rounded-xl border bg-stone-50 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Popular questions
          </h2>
          <ul className="mt-3 space-y-1.5">
            {(QUICK_TOPICS[profile.doc] ?? []).map((t) => (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => onTopic(t)}
                  className="w-full rounded-lg px-2.5 py-2 text-left text-[13px] leading-snug text-stone-700 transition hover:bg-emerald-50 hover:text-emerald-900"
                >
                  {t}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Calculators */}
      <section className="rounded-xl border bg-stone-50 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Percentage tools
        </h2>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Attendance 75% + bunk calculator, marks % to grade, CGPA — regulation numbers base panni
          pannirukku.
        </p>
        <CalculatorsButton />
      </section>

      {/* Sources */}
      <section className="rounded-xl border bg-stone-50 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Data sources
        </h2>
        <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
          <li>B.Tech. Regulations R-2024 (CBCS) — 257 clauses</li>
          <li>PG Regulations R-2024 (M.Tech / M.Sc. / MBA...) — 236 clauses</li>
          <li>Ph.D. Ordinances &amp; Regulations 2024 — 149 clauses</li>
        </ul>
      </section>
    </div>
  );
}

