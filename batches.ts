// Batch configuration for PMIST CSE Department — Regulation Assistant.
//
// NOTE: These are the batches on campus for the current academic year.
// When the user sends the official batch photo, update ONLY this file.

export type RegDocId = 'ug' | 'pg' | 'phd';
export type RoleId = 'ug' | 'pg' | 'staff';

export interface BatchDef {
  /** Display label, e.g. "2024-2028" */
  batch: string;
  /** Admission year */
  startYear: number;
  /** Programme duration in years */
  duration: number;
  /** Regulation label that applies to this batch */
  regulation: string;
  /** Which regulation document is loaded for RAG */
  doc: RegDocId | null;
  /** Shown when the exact regulation PDF is not loaded yet */
  note?: string;
}

// ---------------- Batch lists (CSE Dept) ----------------

export const UG_BATCHES: BatchDef[] = [
  {
    batch: '2023-2027',
    startYear: 2023,
    duration: 4,
    regulation: 'R-2021 (not uploaded)',
    doc: null,
    note: 'Your batch falls under R-2021, which is not uploaded yet. Answers below use R-2024 as reference — a few rules may differ for your batch.',
  },
  {
    batch: '2024-2028',
    startYear: 2024,
    duration: 4,
    regulation: 'R-2024',
    doc: 'ug',
  },
  {
    batch: '2025-2029',
    startYear: 2025,
    duration: 4,
    regulation: 'R-2024',
    doc: 'ug',
  },
  {
    batch: '2026-2030',
    startYear: 2026,
    duration: 4,
    regulation: 'R-2024',
    doc: 'ug',
  },
];

export const PG_BATCHES: BatchDef[] = [
  {
    batch: '2025-2027',
    startYear: 2025,
    duration: 2,
    regulation: 'R-2024',
    doc: 'pg',
  },
  {
    batch: '2026-2028',
    startYear: 2026,
    duration: 2,
    regulation: 'R-2024',
    doc: 'pg',
  },
];

// ---------------- Regulation sets (for Staff) ----------------

export const REG_SETS: { doc: RegDocId; label: string; desc: string }[] = [
  { doc: 'ug', label: 'B.Tech R-2024 (UG)', desc: '8-semester B.Tech. CBCS regulations' },
  { doc: 'pg', label: 'PG R-2024 (M.Tech etc.)', desc: 'M.A. / MBA / MCA / M.Sc. / MSW / M.Com. / M.Tech.' },
  { doc: 'phd', label: 'Ph.D. 2024', desc: 'Ph.D. ordinances and regulations' },
];

// ---------------- Year helpers ----------------

export const YEARS_UG = [1, 2, 3, 4];
export const YEARS_PG = [1, 2];

/** Academic year that is currently running (June onwards = new AY). */
export function currentAcademicYear(now: Date = new Date()): number {
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  return month >= 6 ? year : year - 1;
}

/** Academic-year display label, e.g. 2026 -> "2026-27". */
export function ayLabel(ay: number): string {
  return `${ay}-${String(ay + 1).slice(-2)}`;
}

/** Year of study for a batch right now, clamped to [1, duration]. */
export function yearFromBatch(b: BatchDef, now: Date = new Date()): number {
  const ay = currentAcademicYear(now);
  const y = ay - b.startYear + 1;
  return Math.min(Math.max(y, 1), b.duration);
}

export function yearLabel(y: number): string {
  return y === 1 ? '1st' : y === 2 ? '2nd' : y === 3 ? '3rd' : `${y}th`;
}

export function batchesForRole(role: RoleId): BatchDef[] {
  return role === 'ug' ? UG_BATCHES : PG_BATCHES;
}

export function regLabelForDoc(doc: RegDocId): string {
  switch (doc) {
    case 'ug':
      return 'B.Tech R-2024';
    case 'pg':
      return 'PG R-2024';
    case 'phd':
      return 'Ph.D. 2024';
  }
}

// ---------------- User profile (shared client/server) ----------------

export interface UserProfile {
  role: RoleId;
  /** 1-4 for UG, 1-2 for PG, undefined for staff */
  year?: number;
  batch?: string;
  doc: RegDocId;
  regulation: string;
  /** true when the exact regulation PDF for the batch is not loaded */
  referenceOnly?: boolean;
  note?: string;
}

export function profileSummary(p: UserProfile): string {
  if (p.role === 'staff') {
    return `Staff / Scholar — ${regLabelForDoc(p.doc)}`;
  }
  const y = p.year ? `${yearLabel(p.year)} year` : '';
  return `${p.role === 'ug' ? 'B.Tech (UG)' : 'PG (M.Tech)'} ${y}${p.batch ? `, batch ${p.batch}` : ''}`;
}
