'use client';

import Markdown from 'react-markdown';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Citation {
  doc: string;
  clause: string;
  heading: string;
}

export interface ChatMessage {
  id: string;
  role: 'bot' | 'user';
  text: string;
  citations?: Citation[];
  /** true while the bot is "typing" (text ignored) */
  pending?: boolean;
}

export function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.pending) {
    return (
      <div className="flex items-start gap-2.5">
        <BotAvatar />
        <div className="rounded-2xl rounded-tl-md bg-muted px-4 py-3.5 shadow-sm">
          <span className="flex items-center gap-1.5" aria-label="RegBot is typing">
            <Dot delay="0ms" />
            <Dot delay="150ms" />
            <Dot delay="300ms" />
          </span>
        </div>
      </div>
    );
  }

  const isBot = msg.role === 'bot';
  return (
    <div className={cn('flex items-start gap-2.5', !isBot && 'flex-row-reverse')}>
      {isBot ? <BotAvatar /> : <UserAvatar />}
      <div className={cn('max-w-[85%] sm:max-w-[75%]', !isBot && 'flex flex-col items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm',
            isBot
              ? 'rounded-tl-md bg-card border'
              : 'rounded-tr-md bg-emerald-800 text-emerald-50',
          )}
        >
          {isBot ? (
            <div className="regbot-md">
              <Markdown>{msg.text}</Markdown>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
          )}
        </div>
        {isBot && msg.citations && msg.citations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {msg.citations.map((c, i) => (
              <span
                key={`${msg.id}-src-${i}`}
                title={`${c.doc} — ${c.heading}`}
                className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                <BookOpen className="h-3 w-3" aria-hidden="true" />
                {c.clause}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="regbot-dot inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground"
      style={{ animationDelay: delay }}
    />
  );
}

function BotAvatar() {
  return (
    <div
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-[10px] font-bold text-white"
    >
      RB
    </div>
  );
}

function UserAvatar() {
  return (
    <div
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-200 text-[10px] font-bold text-stone-600"
    >
      YOU
    </div>
  );
}
