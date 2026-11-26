// Server-side retrieval over the PMIST regulation chunks (BM25-style scoring).
// Imported ONLY from API routes — never from client components.

import { REG_CHUNKS, type RegChunk, type RegDocId } from '@/data/regulations';

interface IndexedChunk {
  c: RegChunk;
  tf: Map<string, number>; // term -> weighted frequency
  len: number;
}

let INDEX: IndexedChunk[] | null = null;
let AVG_LEN = 1;
let DF: Map<string, number> = new Map();
let N = 0;

const STOP = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'of', 'to', 'in', 'and', 'or', 'for',
  'on', 'by', 'with', 'as', 'at', 'be', 'it', 'this', 'that', 'what', 'how',
  'i', 'my', 'me', 'you', 'your', 'do', 'does', 'can', 'will', 'shall', 'nu',
  'na', 'ena', 'enn', 'intha', 'andha', 'la', 'laa', 'ah', 'uh', 'um', 'bro',
  'pa', 'da', 'de', 'please', 'tell', 'about',
]);

function tokenize(s: string): string[] {
  const raw = s.toLowerCase().match(/[a-z]+|\d+(?:\.\d+)*/g) ?? [];
  return raw.filter((t) => t.length > 1 && !STOP.has(t));
}

function buildIndex(): void {
  const idx: IndexedChunk[] = [];
  const df = new Map<string, number>();
  let totalLen = 0;

  for (const c of REG_CHUNKS) {
    const tf = new Map<string, number>();
    const bump = (tokens: string[], weight: number) => {
      for (const t of tokens) {
        tf.set(t, (tf.get(t) ?? 0) + weight);
      }
    };
    bump(tokenize(`${c.heading} ${c.section} ${c.clause}`), 3);
    bump(tokenize(c.text), 1);

    const len = [...tf.values()].reduce((a, b) => a + b, 0) || 1;
    totalLen += len;
    for (const t of tf.keys()) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
    idx.push({ c, tf, len });
  }

  N = idx.length;
  AVG_LEN = Math.max(1, totalLen / Math.max(1, N));
  DF = df;
  INDEX = idx;
}

function idf(term: string): number {
  const df = DF.get(term) ?? 0;
  return Math.log(1 + (N - df + 0.5) / (df + 0.5));
}

export interface ScoredChunk {
  chunk: RegChunk;
  score: number;
}

/**
 * Retrieve the most relevant regulation chunks for a query.
 * `doc` (the user's regulation set) receives a relevance boost.
 */
export function retrieve(query: string, doc: RegDocId, k = 8): ScoredChunk[] {
  if (!INDEX) buildIndex();

  const tokens = tokenize(query);
  // explicit clause references, e.g. "R7.3" / "r 4.10"
  const clauseRefs = query.toLowerCase().match(/\b(r\s?\d+(?:\.\d+)*)\b/g) ?? [];

  const scored: ScoredChunk[] = [];
  for (const item of INDEX!) {
    let score = 0;
    for (const t of tokens) {
      const tf = item.tf.get(t);
      if (!tf) continue;
      const sat = (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (item.len / AVG_LEN)));
      score += idf(t) * sat;
    }
    // clause-id exact boost (strip dots from both sides for matching)
    for (const ref of clauseRefs) {
      const clean = ref.replace(/\s/g, '').replace(/^r/, '');
      if (item.c.clause.replace(/^R/, '') === clean || item.c.clause.startsWith(`R${clean}`)) {
        score += 50;
      }
    }
    // boost the user's own regulation document
    if (item.c.doc === doc) score *= 1.9;
    if (score > 0) scored.push({ chunk: item.c, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

/** Build the context block for the LLM prompt. */
export function buildContext(chunks: ScoredChunk[]): string {
  return chunks
    .map((s, i) => {
      const c = s.chunk;
      return `[${i + 1}] (${c.doc.toUpperCase()}) ${c.clause} — ${c.heading}\n${c.text}`;
    })
    .join('\n\n');
}
