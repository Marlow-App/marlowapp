import { Layout } from "@/components/Layout";
import { getScoreBgColor, getScoreTextColor } from "@/lib/scoreColor";
import { useRecordings } from "@/hooks/use-recordings";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Mic2, Mic, MessageCircle, Clock, ChevronRight, ChevronLeft,
  Calendar, Trash2, RotateCcw, TrendingUp, TrendingDown, Minus,
  Award, Activity, Target, Star, Pencil, ArrowUpDown, SortAsc, SortDesc,
} from "lucide-react";
import {
  format, formatDistanceToNow, startOfMonth, endOfMonth, eachDayOfInterval,
  subMonths, addMonths, isToday, isBefore, startOfDay, isThisWeek,
  isThisMonth, differenceInMonths, isSameDay, parseISO, startOfWeek,
} from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMutation } from "@tanstack/react-query";
import { getPhraseEnglish } from "@/data/phrases";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

type ChartRange = "1m" | "3m" | "6m" | "1y";

function buildChartData(scoredRecs: any[], range: ChartRange) {
  const now = new Date();
  let start: Date;
  let bucketFn: (d: Date) => string;
  let labelFn: (key: string) => string;
  let allKeys: string[];

  if (range === "1m") {
    start = subMonths(now, 1);
    bucketFn = (d) => format(d, "yyyy-MM-dd");
    labelFn = (key) => format(parseISO(key), "MMM d");
    allKeys = eachDayOfInterval({ start, end: now }).map(d => format(d, "yyyy-MM-dd"));
  } else if (range === "3m") {
    start = subMonths(now, 3);
    bucketFn = (d) => format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
    labelFn = (key) => format(parseISO(key), "MMM d");
    allKeys = [];
    let cur = startOfWeek(start, { weekStartsOn: 1 });
    while (cur <= now) {
      allKeys.push(format(cur, "yyyy-MM-dd"));
      cur = new Date(cur.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  } else if (range === "6m") {
    start = subMonths(now, 6);
    bucketFn = (d) => format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
    labelFn = (key) => format(parseISO(key), "MMM d");
    allKeys = [];
    let cur = startOfWeek(start, { weekStartsOn: 1 });
    while (cur <= now) {
      allKeys.push(format(cur, "yyyy-MM-dd"));
      cur = new Date(cur.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  } else {
    start = subMonths(now, 12);
    bucketFn = (d) => format(d, "yyyy-MM");
    labelFn = (key) => format(parseISO(key + "-01"), "MMM yy");
    allKeys = [];
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= now) {
      allKeys.push(format(cur, "yyyy-MM"));
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }

  const buckets = new Map<string, number[]>();
  for (const key of allKeys) buckets.set(key, []);
  for (const r of scoredRecs) {
    const d = new Date(r.createdAt);
    if (d >= start && d <= now) {
      const key = bucketFn(d);
      const arr = buckets.get(key) || [];
      arr.push(r.feedback[0].overallScore);
      buckets.set(key, arr);
    }
  }

  return allKeys.map(key => {
    const scores = buckets.get(key) || [];
    return {
      label: labelFn(key),
      score: scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0,
      count: scores.length,
    };
  });
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function RatingBadge({ rating, overallScore }: { rating?: number | null; overallScore?: number | null }) {
  if (overallScore !== null && overallScore !== undefined) {
    return (
      <div className="flex items-center gap-1" data-testid={`score-badge-${overallScore}`}>
        <span className={`text-xs font-bold ${getScoreTextColor(overallScore)}`}>{overallScore}%</span>
      </div>
    );
  }
  if (!rating) return null;
  const config: Record<number, { label: string; textColor: string }> = {
    1: { label: "Needs Improvement", textColor: "text-gray-500" },
    2: { label: "Good", textColor: "text-amber-600" },
    3: { label: "Excellent", textColor: "text-emerald-600" },
  };
  const c = config[rating];
  if (!c) return null;
  return (
    <div className="flex items-center gap-1" data-testid={`rating-badge-${rating}`}>
      <span className={`text-[10px] font-semibold ${c.textColor}`}>{c.label}</span>
    </div>
  );
}

function CategoryBar({ label, value }: { label: string; value: number }) {
  const barColor =
    value >= 75 ? "bg-emerald-500 dark:bg-emerald-400"
    : value >= 50 ? "bg-amber-500 dark:bg-amber-400"
    : "bg-primary";
  const textColor =
    value >= 75 ? "text-emerald-600 dark:text-emerald-400"
    : value >= 50 ? "text-amber-600 dark:text-amber-400"
    : "text-primary";
  return (
    <div className="space-y-1.5" data-testid={`category-bar-${label.toLowerCase()}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${textColor}`}>{value}%</span>
      </div>
      <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${value}%` }}
          data-testid={`category-bar-fill-${label.toLowerCase()}`}
        />
      </div>
    </div>
  );
}

const CATEGORY_TIPS = {
  tone: {
    strong: "Your tone accuracy is solid. Keep listening to natives to internalize the shapes.",
    weak: "Focus on the pitch shape of each tone. T1 is flat-high, T2 rises, T3 dips (or half-dips), T4 falls sharply.",
  },
  initial: {
    strong: "Your initial consonants are accurate — nice work!",
    weak: "Work on aspirated vs unaspirated pairs (b/p, d/t, g/k) and tricky sounds like zh, ch, sh, and x.",
  },
  final: {
    strong: "Your final vowels and endings sound natural.",
    weak: "Pay attention to endings: -in vs -ing, -an vs -ang, and the ü vowel. Exaggerate them until they stick.",
  },
};

function FocusCard({ catLabel, value, isStrength, practiceErrors }: {
  catLabel: "tone" | "initial" | "final";
  value: number;
  isStrength: boolean;
  practiceErrors?: string[];
}) {
  const tips = CATEGORY_TIPS[catLabel];
  const label = catLabel === "tone" ? "Tone" : catLabel === "initial" ? "Initial consonant" : "Final vowel";
  if (isStrength) {
    return (
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40" data-testid={`strength-card-${catLabel}`}>
        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0">
          <Star className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold">{label}</p>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{value}%</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{tips.strong}</p>
        </div>
      </div>
    );
  }
  const showPracticeErrors = practiceErrors && practiceErrors.length > 0;
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-800/40" data-testid={`needs-work-card-${catLabel}`}>
      <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center shrink-0">
        <Target className="w-4 h-4 text-orange-600 dark:text-orange-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold">{label}</p>
          <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{value}%</span>
        </div>
        {showPracticeErrors ? (
          <ul className="space-y-1 mt-1">
            {practiceErrors!.slice(0, 2).map((err, i) => (
              <li key={i} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
                <span className="text-orange-400 mt-0.5 shrink-0">·</span>
                <span>{err}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed">{tips.weak}</p>
        )}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const { score, count } = payload[0]?.payload ?? {};
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="text-muted-foreground mb-0.5">{label}</p>
      <p className="font-bold text-foreground text-sm">{score}% avg</p>
      {count > 1 && <p className="text-muted-foreground">{count} recordings</p>}
    </div>
  );
};

const RANGE_OPTIONS: { label: string; value: ChartRange }[] = [
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
];

function ProgressInsights({ recordings, bestRecordingId }: { recordings: any[]; bestRecordingId: number | null }) {
  const [chartRange, setChartRange] = useState<ChartRange>("3m");
  const { data: practiceList = [] } = useQuery<any[]>({ queryKey: ["/api/practice-list"] });

  const scoredRecs = useMemo(() =>
    recordings.filter(r => r.feedback?.[0]?.overallScore != null),
    [recordings]
  );

  const sortedByDate = useMemo(() =>
    [...scoredRecs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [scoredRecs]
  );

  const stats = useMemo(() => {
    if (scoredRecs.length === 0) return null;
    const avgScore = Math.round(
      scoredRecs.reduce((s, r) => s + r.feedback[0].overallScore, 0) / scoredRecs.length
    );
    const bestScore = Math.max(...scoredRecs.map(r => r.feedback[0].overallScore));
    const thisMonthCount = scoredRecs.filter(r => isThisMonth(new Date(r.createdAt))).length;
    const recent5 = sortedByDate.slice(-5);
    const prev5 = sortedByDate.slice(-10, -5);
    const recent5Avg = recent5.length > 0
      ? recent5.reduce((s, r) => s + r.feedback[0].overallScore, 0) / recent5.length : null;
    const prev5Avg = prev5.length > 0
      ? prev5.reduce((s, r) => s + r.feedback[0].overallScore, 0) / prev5.length : null;
    const trend = (recent5Avg !== null && prev5Avg !== null) ? recent5Avg - prev5Avg : null;
    return { avgScore, bestScore, thisMonthCount, trend };
  }, [scoredRecs, sortedByDate]);

  const catAvgs = useMemo(() => {
    const allCR = scoredRecs.flatMap(r =>
      (r.feedback[0].characterRatings || []).filter((cr: any) => typeof cr.tone === "number")
    );
    if (allCR.length === 0) return null;
    return {
      tone: Math.round(allCR.reduce((s: number, cr: any) => s + cr.tone, 0) / allCR.length),
      initial: Math.round(allCR.reduce((s: number, cr: any) => s + cr.initial, 0) / allCR.length),
      final: Math.round(allCR.reduce((s: number, cr: any) => s + cr.final, 0) / allCR.length),
      count: allCR.length,
    };
  }, [scoredRecs]);

  const chartData = useMemo(() => buildChartData(scoredRecs, chartRange), [scoredRecs, chartRange]);

  const focusAreas = useMemo(() => {
    if (!catAvgs) return null;
    const cats = [
      { key: "tone" as const, value: catAvgs.tone },
      { key: "initial" as const, value: catAvgs.initial },
      { key: "final" as const, value: catAvgs.final },
    ].sort((a, b) => b.value - a.value);
    return { strength: cats[0], needsWork: cats[cats.length - 1], showDiff: cats[0].value !== cats[cats.length - 1].value };
  }, [catAvgs]);

  const practiceErrorsByCategory = useMemo(() => {
    const byCategory: Record<string, string[]> = { tone: [], initial: [], final: [] };
    const seen = new Set<string>();
    for (const item of practiceList) {
      const err = item.error;
      if (!err) continue;
      const key = `${err.category}:${err.commonError}`;
      if (!seen.has(key)) {
        seen.add(key);
        if (byCategory[err.category]) byCategory[err.category].push(err.commonError);
      }
    }
    return byCategory;
  }, [practiceList]);

  if (scoredRecs.length === 0) return null;

  const { avgScore, bestScore, thisMonthCount, trend } = stats!;

  return (
    <div className="space-y-4" data-testid="progress-insights">

      {/* ── Stat cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">

        {/* Avg score → scroll to chart */}
        <Card
          className="border-border/60 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200"
          onClick={() => scrollTo("score-trend")}
          data-testid="stat-avg-score"
        >
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Avg Score</span>
              <Activity className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className={`text-3xl font-bold font-display tabular-nums ${getScoreTextColor(avgScore)}`}>{avgScore}%</p>
            {trend !== null && (
              <div className={`flex items-center gap-0.5 mt-1 text-[11px] font-medium ${
                trend > 2 ? "text-emerald-600" : trend < -2 ? "text-primary" : "text-muted-foreground"
              }`}>
                {trend > 2 ? <TrendingUp className="w-3 h-3" /> : trend < -2 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                {trend > 2 ? `+${Math.round(trend)}% recent` : trend < -2 ? `${Math.round(trend)}% recent` : "Steady"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Best → go to that recording */}
        {bestRecordingId ? (
          <Link href={`/recordings/${bestRecordingId}`}>
            <Card className="border-border/60 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200 h-full" data-testid="stat-best-score">
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Best</span>
                  <Award className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <p className={`text-3xl font-bold font-display tabular-nums ${getScoreTextColor(bestScore)}`}>{bestScore}%</p>
                <p className="text-[11px] text-primary mt-1 flex items-center gap-0.5">View recording <ChevronRight className="w-3 h-3" /></p>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card className="border-border/60" data-testid="stat-best-score">
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Best</span>
                <Award className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <p className={`text-3xl font-bold font-display tabular-nums ${getScoreTextColor(bestScore)}`}>{bestScore}%</p>
            </CardContent>
          </Card>
        )}

        {/* This Month → scroll to calendar */}
        <Card
          className="border-border/60 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200"
          onClick={() => scrollTo("practice-journal")}
          data-testid="stat-this-month"
        >
          <CardContent className="pt-4 pb-4 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">This Month</span>
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold font-display tabular-nums text-foreground">{thisMonthCount}</p>
            <p className="text-[11px] text-primary mt-1 flex items-center gap-0.5">View journal <ChevronRight className="w-3 h-3" /></p>
          </CardContent>
        </Card>
      </div>

      {/* ── Score trend chart ──────────────────────────────────── */}
      {scoredRecs.length >= 2 && (
        <Card className="border-border/60" id="score-trend" data-testid="score-trend-chart">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <CardTitle className="text-base font-display">Score Over Time</CardTitle>
              </div>
              <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-0.5">
                {RANGE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setChartRange(opt.value)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                      chartRange === opt.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`chart-range-${opt.value}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {chartData.length >= 2 ? (
              <>
                <ResponsiveContainer width="100%" height={190}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                    <defs>
                      <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      interval={chartRange === "1m" ? 6 : chartRange === "3m" ? 2 : chartRange === "6m" ? 5 : 1}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      ticks={[0, 25, 50, 75, 100]}
                    />
                    <ReferenceLine y={75} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#scoreGrad)"
                      dot={{ r: 3.5, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-muted-foreground text-right pr-3 mt-0.5">
                  Dashed = 75% target · Each point = avg of that period
                </p>
              </>
            ) : (
              <div className="h-[190px] flex items-center justify-center text-sm text-muted-foreground">
                No recordings in this time range
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Pronunciation breakdown + focus areas ────────────── */}
      {catAvgs && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border/60" data-testid="pronunciation-breakdown">
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-base font-display">Pronunciation Breakdown</CardTitle>
              <CardDescription>Averaged across {catAvgs.count} characters</CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-5">
              <CategoryBar label="Tone" value={catAvgs.tone} />
              <CategoryBar label="Initial consonant" value={catAvgs.initial} />
              <CategoryBar label="Final vowel" value={catAvgs.final} />
              <div className="flex items-center gap-4 pt-1 border-t border-border/40">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-muted-foreground">≥75% Strong</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-[10px] text-muted-foreground">50–74% Developing</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span className="text-[10px] text-muted-foreground">&lt;50% Needs work</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {focusAreas && focusAreas.showDiff && (
            <Card className="border-border/60" data-testid="focus-areas">
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="text-base font-display">What to Focus On</CardTitle>
                <CardDescription>Based on your pronunciation history</CardDescription>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-3">
                <FocusCard catLabel={focusAreas.strength.key} value={focusAreas.strength.value} isStrength={true} practiceErrors={practiceErrorsByCategory[focusAreas.strength.key]} />
                <FocusCard catLabel={focusAreas.needsWork.key} value={focusAreas.needsWork.value} isStrength={false} practiceErrors={practiceErrorsByCategory[focusAreas.needsWork.key]} />
                {scoredRecs.length >= 3 && (
                  <div className="pt-2 border-t border-border/40">
                    <Link href="/practice-list">
                      <Button variant="outline" size="sm" className="w-full rounded-full text-xs" data-testid="go-to-practice-list">
                        <Target className="w-3.5 h-3.5 mr-1.5" />
                        View saved error list
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Journal Calendar (journal aesthetic) ─────────────────────────────────────

interface RecordingEntry {
  id: number;
  sentenceText: string;
  score: number | null;
}

const JOURNAL_COLORS = [
  { bg: "bg-primary/15 dark:bg-primary/25", ring: "ring-primary/60", text: "text-primary dark:text-primary/80", whiteRing: false },
  { bg: "bg-primary/30 dark:bg-primary/40", ring: "ring-primary/80", text: "text-primary", whiteRing: false },
  { bg: "bg-primary/55 dark:bg-primary/60", ring: "ring-primary", text: "text-primary-foreground", whiteRing: true },
  { bg: "bg-primary/80 dark:bg-primary/85", ring: "ring-primary", text: "text-primary-foreground", whiteRing: true },
  { bg: "bg-primary dark:bg-primary", ring: "ring-primary", text: "text-primary-foreground", whiteRing: true },
];

function JournalCalendar({ recordings, initialDate }: { recordings: any[]; initialDate?: Date }) {
  const [currentMonth, setCurrentMonth] = useState(initialDate ? startOfMonth(initialDate) : new Date());
  const [, navigate] = useLocation();

  const firstRecordingDate = useMemo(() => {
    if (!recordings || recordings.length === 0) return new Date();
    const dates = recordings.map((r: any) => new Date(r.createdAt));
    return dates.reduce((earliest, d) => (d < earliest ? d : earliest), dates[0]);
  }, [recordings]);

  const canGoBack = isBefore(startOfMonth(firstRecordingDate), startOfMonth(currentMonth));
  const canGoForward = isBefore(startOfMonth(currentMonth), startOfMonth(new Date()));

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startDayOfWeek = startOfMonth(currentMonth).getDay();

  const countsByDay = useMemo(() => {
    const map = new Map<string, number>();
    recordings?.forEach((r: any) => {
      const key = format(new Date(r.createdAt), "yyyy-MM-dd");
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [recordings]);

  const recordingsByDay = useMemo(() => {
    const map = new Map<string, RecordingEntry[]>();
    recordings?.forEach((r: any) => {
      const key = format(new Date(r.createdAt), "yyyy-MM-dd");
      const arr = map.get(key) || [];
      arr.push({ id: r.id, sentenceText: r.sentenceText, score: r.feedback?.[0]?.overallScore ?? null });
      map.set(key, arr);
    });
    return map;
  }, [recordings]);

  const maxCount = useMemo(() => {
    let max = 0;
    countsByDay.forEach((v) => { if (v > max) max = v; });
    return Math.max(max, 1);
  }, [countsByDay]);

  const getDayStyle = (count: number) => {
    if (count === 0) return null;
    const idx = Math.min(Math.ceil((count / maxCount) * JOURNAL_COLORS.length) - 1, JOURNAL_COLORS.length - 1);
    return JOURNAL_COLORS[idx];
  };

  const totalThisMonth = useMemo(() => {
    return recordings?.filter((r: any) => isThisMonth(new Date(r.createdAt))).length || 0;
  }, [recordings]);

  return (
    <Card
      id="practice-journal"
      className="border-amber-200/70 dark:border-amber-800/40 overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #fdf8f0 0%, #fdf4e8 100%)",
      }}
      data-testid="journal-calendar"
    >
      {/* Journal header */}
      <div className="relative px-5 pt-4 pb-3 border-b border-amber-200/60 dark:border-amber-800/30"
        style={{ background: "linear-gradient(180deg, #fdf6e8 0%, #faecd6 100%)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/60 border border-amber-200 dark:border-amber-700 flex items-center justify-center">
              <Pencil className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200 font-display leading-none">Practice Journal</h3>
              {totalThisMonth > 0 && (
                <p className="text-[10px] text-amber-700/70 dark:text-amber-400/70 mt-0.5">
                  {totalThisMonth} entr{totalThisMonth === 1 ? "y" : "ies"} this month
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              className={`w-6 h-6 rounded flex items-center justify-center text-amber-700/60 dark:text-amber-400/60 hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 transition-colors ${!canGoBack ? "opacity-30 cursor-not-allowed" : ""}`}
              disabled={!canGoBack}
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              data-testid="calendar-prev-month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm font-semibold text-amber-900 dark:text-amber-200 min-w-[100px] text-center" data-testid="calendar-month-label">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <button
              className={`w-6 h-6 rounded flex items-center justify-center text-amber-700/60 dark:text-amber-400/60 hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 transition-colors ${!canGoForward ? "opacity-30 cursor-not-allowed" : ""}`}
              disabled={!canGoForward}
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              data-testid="calendar-next-month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Journal body with lined-paper effect */}
      <div
        className="px-5 pb-4 pt-3"
        style={{
          backgroundImage: "repeating-linear-gradient(transparent, transparent 50px, #e8d9bc55 50px, #e8d9bc55 52px)",
          backgroundPosition: "0 32px",
        }}
      >
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1.5">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-[10px] text-center font-semibold text-amber-700/50 dark:text-amber-400/50 py-0.5 tracking-wide uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="h-12" />
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const count = countsByDay.get(key) || 0;
            const today = isToday(day);
            const entries = recordingsByDay.get(key) || [];
            const style = getDayStyle(count);

            const ringCls = style
              ? style.whiteRing
                ? "ring-2 ring-white/80 shadow-sm"
                : `ring-2 ${style.ring} shadow-sm`
              : today
                ? "ring-2 ring-amber-400 dark:ring-amber-500"
                : "";

            const textCls = style
              ? style.text
              : today
                ? "text-amber-800 dark:text-amber-300 font-bold"
                : "text-amber-800/80 dark:text-amber-200/70";

            const popoverEntries = (
              <PopoverContent className="w-64 p-3" side="top" align="center">
                <p className="text-xs font-semibold mb-1">{format(day, "MMMM d, yyyy")}</p>
                {count > 1 && <p className="text-[11px] text-muted-foreground mb-2">{count} recordings</p>}
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {entries.map((entry) => (
                    <Link key={entry.id} href={`/recordings/${entry.id}`}>
                      <div
                        className="text-xs bg-muted/50 hover:bg-primary/10 hover:text-primary rounded px-2 py-1.5 cursor-pointer transition-colors flex items-center gap-1.5"
                        data-testid={`popover-recording-${entry.id}`}
                      >
                        <Mic2 className="w-3 h-3 shrink-0 opacity-50" />
                        <span className="truncate flex-1">{entry.sentenceText}</span>
                        {entry.score !== null && (
                          <span className={`text-[10px] font-bold shrink-0 ${getScoreTextColor(entry.score)}`}>{entry.score}%</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </PopoverContent>
            );

            return (
              <div key={key} className="flex items-center justify-center h-12">
                {/* Wrapper keeps badge positioned relative to the circle */}
                <div className="relative">
                  {/* Circle — clicking navigates to that day */}
                  <button
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200
                      ${style ? `${style.bg} ${ringCls} cursor-pointer hover:scale-110` : `${ringCls} ${count === 0 && !today ? "cursor-default" : "cursor-pointer hover:scale-110"}`}
                    `}
                    onClick={() => navigate(`/learner-portal?date=${key}`)}
                    data-testid={`calendar-day-${key}`}
                  >
                    <span className={`text-sm leading-none font-semibold ${textCls}`}>
                      {format(day, "d")}
                    </span>
                  </button>

                  {/* Badge — sits on top-right of the circle, opens popover */}
                  {count >= 1 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className="absolute -top-1.5 -right-1.5 bg-amber-700 dark:bg-amber-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none hover:bg-amber-800 dark:hover:bg-amber-400 transition-colors z-10"
                          data-testid={`calendar-badge-${key}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {count}
                        </button>
                      </PopoverTrigger>
                      {popoverEntries}
                    </Popover>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-amber-200/50 dark:border-amber-800/30">
          <span className="text-[10px] text-amber-700/50 dark:text-amber-400/50 italic">Click a circled date to see recordings</span>
          <div className="flex items-center gap-1.5">
            {JOURNAL_COLORS.slice(0, 4).map((c, i) => (
              <div key={i} className={`w-3 h-3 rounded-full ${c.bg} ring-1 ${c.ring}`} />
            ))}
            <span className="text-[10px] text-amber-700/50 dark:text-amber-400/50 ml-0.5">more active →</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Compact recordings list ───────────────────────────────────────────────────

type SortMode = "newest" | "oldest" | "highest" | "lowest";

function getTimeGroup(date: Date): string {
  const now = new Date();
  if (isThisWeek(date, { weekStartsOn: 0 })) return "This Week";
  if (isThisMonth(date)) return "Earlier This Month";
  const months = differenceInMonths(now, date);
  if (months <= 1) return "Last Month";
  if (months < 6) return format(date, "MMMM");
  return format(date, "MMMM yyyy");
}

function RecordingRow({ recording }: { recording: any }) {
  const score = recording.feedback?.[0]?.overallScore ?? null;
  const isPending = recording.feedback?.length === 0;
  const isRefunded = recording.creditsRefunded && recording.creditCost > 0;

  return (
    <Link href={`/recordings/${recording.id}`}>
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer group border border-transparent hover:border-border/40"
        data-testid={`recording-row-${recording.id}`}
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          score !== null ? getScoreBgColor(score) : "bg-muted"
        } transition-all`}>
          <Mic className="w-3.5 h-3.5 text-white opacity-80" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{recording.sentenceText}</p>
          <p className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(recording.createdAt), { addSuffix: true })}
            {getPhraseEnglish(recording.sentenceText) && (
              <span className="ml-1.5 text-muted-foreground/60">· {getPhraseEnglish(recording.sentenceText)}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRefunded && (
            <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] px-1.5 py-0" data-testid={`refunded-badge-${recording.id}`}>
              <RotateCcw className="w-2.5 h-2.5 mr-0.5" />Refunded
            </Badge>
          )}
          {score !== null ? (
            <span className={`text-sm font-bold tabular-nums ${getScoreTextColor(score)}`} data-testid={`row-score-${recording.id}`}>{score}%</span>
          ) : isPending ? (
            <span className="text-[11px] text-muted-foreground/60 italic">Pending</span>
          ) : null}
          {recording.feedback?.[0]?.textFeedback && (
            <MessageCircle className="w-3.5 h-3.5 text-muted-foreground/40" />
          )}
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
        </div>
      </div>
    </Link>
  );
}

const PAGE_SIZE = 10;

function RecordingsList({ recordings }: { recordings: any[] }) {
  const [sort, setSort] = useState<SortMode>("newest");
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    return [...recordings].sort((a, b) => {
      if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      const sa = a.feedback?.[0]?.overallScore ?? -1;
      const sb = b.feedback?.[0]?.overallScore ?? -1;
      if (sort === "highest") return sb - sa;
      return sa - sb;
    });
  }, [recordings, sort]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (s: SortMode) => { setSort(s); setPage(1); };

  if (recordings.length === 0) return null;

  return (
    <div>
      {/* Sort controls */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <span className="text-xs text-muted-foreground">
          {recordings.length} recording{recordings.length !== 1 ? "s" : ""}
          {totalPages > 1 && ` · page ${page} of ${totalPages}`}
        </span>
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-0.5">
          {(["newest", "oldest", "highest", "lowest"] as SortMode[]).map(s => (
            <button
              key={s}
              onClick={() => handleSort(s)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                sort === s
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`sort-${s}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Row list */}
      <div className="rounded-xl border border-border/50 overflow-hidden divide-y divide-border/30 bg-card">
        {paginated.map(r => <RecordingRow key={r.id} recording={r} />)}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-xs h-8"
            data-testid="recordings-prev-page"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded text-xs font-medium transition-all ${
                  p === page
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                data-testid={`recordings-page-${p}`}
              >
                {p}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-xs h-8"
            data-testid="recordings-next-page"
          >
            Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function LearnerPortal() {
  const { data: recordings, isLoading } = useRecordings() as { data: any[]; isLoading: boolean };
  const { toast } = useToast();
  const searchString = useSearch();
  const [, navigate] = useLocation();

  const params = useMemo(() => new URLSearchParams(searchString), [searchString]);

  const dateFilter = useMemo(() => {
    const d = params.get("date");
    if (!d) return null;
    try { return parseISO(d); } catch { return null; }
  }, [params]);

  useEffect(() => {
    if (params.get("checkout") === "success") {
      toast({ title: "Credits added!", description: "Your purchase was successful." });
    } else if (params.get("checkout") === "cancel") {
      toast({ title: "Checkout cancelled", description: "No charges were made.", variant: "destructive" });
    }
  }, [searchString]);

  const allRecordingsList = recordings || [];

  const bestRecordingId = useMemo(() => {
    const scored = allRecordingsList.filter((r: any) => r.feedback?.[0]?.overallScore != null);
    if (scored.length === 0) return null;
    return scored.reduce((best: any, r: any) =>
      r.feedback[0].overallScore > best.feedback[0].overallScore ? r : best
    ).id;
  }, [allRecordingsList]);

  const filteredList = useMemo(() => {
    if (!dateFilter) return allRecordingsList;
    return allRecordingsList.filter((r: any) => isSameDay(new Date(r.createdAt), dateFilter));
  }, [allRecordingsList, dateFilter]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5 animate-in">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display">My Progress</h1>
            <p className="text-muted-foreground mt-1">Track your recordings and feedback</p>
          </div>
          <Link href="/record">
            <Button className="rounded-full shadow-lg shadow-primary/20" data-testid="new-recording-btn">
              <Mic2 className="w-4 h-4 mr-2" />
              New Recording
            </Button>
          </Link>
        </div>

        {/* Stats + charts */}
        <ProgressInsights recordings={allRecordingsList} bestRecordingId={bestRecordingId} />

        {/* Practice Journal */}
        <JournalCalendar recordings={recordings || []} initialDate={dateFilter ?? undefined} />

        {/* Date filter banner */}
        {dateFilter && (
          <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3" data-testid="date-filter-banner">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="font-medium">Recordings from {format(dateFilter, "MMMM d, yyyy")}</span>
              <span className="text-muted-foreground">· {filteredList.length} result{filteredList.length !== 1 ? "s" : ""}</span>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => navigate("/learner-portal")} data-testid="clear-date-filter">
              Clear filter
            </Button>
          </div>
        )}

        {/* All Recordings */}
        <div id="all-recordings">
          <h2 className="text-lg font-bold font-display mb-3">All Recordings</h2>
          {filteredList.length > 0 ? (
            <RecordingsList recordings={filteredList} />
          ) : (
            <div className="text-center py-14 bg-muted/10 rounded-2xl border border-dashed border-border">
              <Mic2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-lg font-medium">{dateFilter ? "No recordings on this day" : "No recordings yet"}</h3>
              <p className="text-muted-foreground mt-2 mb-5 text-sm">
                {dateFilter ? "Try a different date or clear the filter." : "Start your journey by recording your first sentence!"}
              </p>
              {dateFilter ? (
                <Button variant="outline" onClick={() => navigate("/learner-portal")} data-testid="clear-date-filter-empty">Show all recordings</Button>
              ) : (
                <Link href="/record">
                  <Button data-testid="first-recording-btn">Record Now</Button>
                </Link>
              )}
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
