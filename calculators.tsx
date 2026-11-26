'use client';

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Plus, Trash2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

const GRADE_POINTS = [
  { l: 'O', p: 10, band: '90 - 100' },
  { l: 'A+', p: 9, band: '80 - 89' },
  { l: 'A', p: 8, band: '70 - 79' },
  { l: 'B+', p: 7, band: '60 - 69' },
  { l: 'B', p: 6, band: '50 - 59' },
  { l: 'C', p: 5, band: '40 - 49' },
];

export function CalculatorsButton({ variant = 'default' }: { variant?: 'default' | 'ghost' }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm" className="gap-2">
          <Calculator className="h-4 w-4" aria-hidden="true" />
          Calculators
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-emerald-700" aria-hidden="true" />
            Percentage &amp; CGPA Calculators
          </DialogTitle>
          <DialogDescription>
            Based on PMIST R-2024 regulations — 75% attendance rule (R7.3 / R7.4 / R7.6) and the
            10-point grading system.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="attendance">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="attendance">Attendance %</TabsTrigger>
            <TabsTrigger value="marks">Marks %</TabsTrigger>
            <TabsTrigger value="cgpa">CGPA</TabsTrigger>
          </TabsList>
          <TabsContent value="attendance" className="pt-4">
            <AttendanceCalc />
          </TabsContent>
          <TabsContent value="marks" className="pt-4">
            <MarksCalc />
          </TabsContent>
          <TabsContent value="cgpa" className="pt-4">
            <CgpaCalc />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function num(s: string): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : NaN;
}

// ---------------- Attendance ----------------

function AttendanceCalc() {
  const [total, setTotal] = useState('');
  const [attended, setAttended] = useState('');

  const res = useMemo(() => {
    const T = num(total);
    const A = num(attended);
    if (!(T > 0) || !(A >= 0) || A > T) return null;
    const pct = (A / T) * 100;
    const need = Math.max(0, Math.ceil(3 * T - 4 * A)); // (A+n)/(T+n) >= 0.75
    const bunk = Math.max(0, Math.floor((4 * A) / 3 - T)); // A/(T+b) >= 0.75
    return { pct, need, bunk };
  }, [total, attended]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="att-total" className="text-sm font-medium">
            Classes conducted
          </label>
          <Input
            id="att-total"
            inputMode="numeric"
            placeholder="e.g. 40"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="att-attended" className="text-sm font-medium">
            Classes attended
          </label>
          <Input
            id="att-attended"
            inputMode="numeric"
            placeholder="e.g. 28"
            value={attended}
            onChange={(e) => setAttended(e.target.value)}
          />
        </div>
      </div>

      {res && (
        <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current attendance</span>
            <span className="text-2xl font-bold tabular-nums">{res.pct.toFixed(1)}%</span>
          </div>
          <Progress value={Math.min(100, res.pct)} className="h-2" />
          <div className="flex flex-wrap items-center gap-2">
            {res.pct >= 75 ? (
              <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Safe — exam eligible
              </Badge>
            ) : res.pct >= 65 ? (
              <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Caution zone (R7.4)
              </Badge>
            ) : (
              <Badge className="gap-1 bg-red-100 text-red-800 hover:bg-red-100">
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> SA grade risk — redo (R7.7)
              </Badge>
            )}
          </div>
          <ul className="space-y-1.5 text-sm">
            {res.need > 0 ? (
              <li className="flex gap-2">
                <span className="text-muted-foreground">To reach 75%:</span>
                <span className="font-semibold">attend next {res.need} classes</span>
              </li>
            ) : (
              <li className="flex gap-2">
                <span className="text-muted-foreground">Already above 75%.</span>
                <span className="font-semibold">you can bunk up to {res.bunk} classes</span>
              </li>
            )}
          </ul>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Basis: minimum <strong>75% per course</strong> (R7.3). 65–75% allowed only with
            medical / sports condonation (R7.4). Below 75% without condonation ={' '}
            <strong>SA grade</strong>, exam entry cancelled (R7.6); below 65% = redo the course
            (R7.7).
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------- Marks % ----------------

function MarksCalc() {
  const [obtained, setObtained] = useState('');
  const [full, setFull] = useState('');

  const res = useMemo(() => {
    const o = num(obtained);
    const f = num(full);
    if (!(f > 0) || !(o >= 0) || o > f) return null;
    const pct = (o / f) * 100;
    const g = [...GRADE_POINTS].reverse().find((x) => pct >= parseInt(x.band.split(' ')[0], 10));
    return { pct, grade: g };
  }, [obtained, full]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="marks-obt" className="text-sm font-medium">
            Marks obtained
          </label>
          <Input
            id="marks-obt"
            inputMode="decimal"
            placeholder="e.g. 67"
            value={obtained}
            onChange={(e) => setObtained(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="marks-full" className="text-sm font-medium">
            Total marks
          </label>
          <Input
            id="marks-full"
            inputMode="decimal"
            placeholder="e.g. 100"
            value={full}
            onChange={(e) => setFull(e.target.value)}
          />
        </div>
      </div>

      {res && (
        <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Percentage</span>
            <span className="text-2xl font-bold tabular-nums">{res.pct.toFixed(2)}%</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Expected letter grade:</span>
            {res.grade ? (
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                {res.grade.l} ({res.grade.band}) — {res.grade.p} points
              </Badge>
            ) : (
              <Badge className="gap-1 bg-red-100 text-red-800 hover:bg-red-100">
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Below 40 — fail band, reappear
              </Badge>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Letter grades per regulation table: O 90-100, A+ 80-89, A 70-79, B+ 60-69, B 50-59, C
            40-49. Overall pass needs the prescribed minimum in end-semester + continuous
            assessment as per your regulation clauses.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------- CGPA ----------------

interface Row {
  id: number;
  credits: string;
  grade: string;
}

function CgpaCalc() {
  const [rows, setRows] = useState<Row[]>([
    { id: 1, credits: '3', grade: 'A+' },
    { id: 2, credits: '4', grade: 'A' },
    { id: 3, credits: '3', grade: 'B+' },
  ]);

  const res = useMemo(() => {
    let cs = 0;
    let ps = 0;
    for (const r of rows) {
      const c = num(r.credits);
      const g = GRADE_POINTS.find((x) => x.l === r.grade);
      if (c > 0 && g) {
        cs += c;
        ps += c * g.p;
      }
    }
    return cs > 0 ? ps / cs : null;
  }, [rows]);

  const descriptor = (v: number) => {
    const r = Math.round(v);
    const map: Record<number, string> = {
      10: 'Outstanding',
      9: 'Excellent',
      8: 'Very Good',
      7: 'Good',
      6: 'Average',
      5: 'Satisfactory',
    };
    return map[r] ?? 'Below pass';
  };

  return (
    <div className="space-y-4">
      <div className="max-h-64 space-y-2 overflow-y-auto pr-1 regbot-scroll">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <Input
              inputMode="numeric"
              className="w-20"
              aria-label={`Course ${r.id} credits`}
              value={r.credits}
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((x) => (x.id === r.id ? { ...x, credits: e.target.value } : x)),
                )
              }
            />
            <span className="text-xs text-muted-foreground">credits</span>
            <Select
              value={r.grade}
              onValueChange={(v) =>
                setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, grade: v } : x)))
              }
            >
              <SelectTrigger className="w-24" aria-label={`Course ${r.id} grade`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRADE_POINTS.map((g) => (
                  <SelectItem key={g.l} value={g.l}>
                    {g.l} ({g.p})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-8 w-8 text-muted-foreground"
              aria-label="Remove course"
              disabled={rows.length <= 1}
              onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={rows.length >= 12}
        onClick={() =>
          setRows((prev) => [...prev, { id: Date.now(), credits: '3', grade: 'B' }])
        }
      >
        <Plus className="h-4 w-4" aria-hidden="true" /> Add course
      </Button>

      {res !== null && (
        <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">CGPA</span>
            <span className="text-2xl font-bold tabular-nums">{res.toFixed(2)}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Overall performance: </span>
            <span className="font-semibold">{descriptor(res)}</span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            CGPA = sum(credits x grade points) / sum(credits). Grade points: O=10, A+=9, A=8,
            B+=7, B=6, C=5 (R-2024 grading scheme).
          </p>
        </div>
      )}
    </div>
  );
}
