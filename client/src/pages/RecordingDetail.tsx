import { useParams, Link, useLocation } from "wouter";
import { getScoreBgColor, getScoreTextColor } from "@/lib/scoreColor";
import { Layout } from "@/components/Layout";
import { useRecording, useChildRecordings } from "@/hooks/use-recordings";
import { useCreateFeedback } from "@/hooks/use-feedback";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";
import { AudioRecorder } from "@/components/AudioRecorder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronDown, ChevronUp, MessageSquare, Mic, GraduationCap, MapPin, Trash2, Pencil, Info, Star, RotateCcw, Plus, X, Bot } from "lucide-react";
import { getPhraseEnglish } from "@/data/phrases";
import { countChineseChars } from "@shared/credits";
import {
  FluencyDisplay, ScoreBar,
  ErrorDetailDialog, AIErrorRow,
} from "@/components/AIFeedbackDisplay";
import { useAllErrors } from "@/hooks/use-errors";
import { TONE_COLORS, type PinyinChar, getCharPinyin, type PracticeListItem } from "@/lib/pinyin-utils";
import { AIFeedbackRatings, AudioComparison } from "@/components/RecordingFeedback";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useState, useMemo, useRef, useLayoutEffect } from "react";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type User as SharedUser, type CharacterRating, type PronunciationError } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { api } from "@shared/routes";
import { SandhiPhraseDisplay } from "@/components/SandhiPhraseDisplay";
import { useDisplayPrefs } from "@/hooks/use-display-prefs";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function extractChineseChars(text: string): string[] {
  const matches = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
  return matches || [];
}


const RATING_OPTIONS = [
  { value: 0, label: "Poor", shortLabel: "差", color: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800", activeColor: "bg-red-500 text-white border-red-500" },
  { value: 50, label: "OK", shortLabel: "可", color: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800", activeColor: "bg-amber-500 text-white border-amber-500" },
  { value: 100, label: "Great", shortLabel: "优", color: "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800", activeColor: "bg-emerald-500 text-white border-emerald-500" },
];

const DIMENSIONS = [
  { key: "initial" as const, chinese: "声母", english: "Initial" },
  { key: "final" as const, chinese: "韵母", english: "Final" },
  { key: "tone" as const, chinese: "声调", english: "Tone" },
];

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return null;
  return (
    <span className={`text-lg font-bold ${getScoreTextColor(score)}`} data-testid={`score-badge-${score}`}>
      {score}%
    </span>
  );
}

function OldRatingDisplay({ rating }: { rating: number | null | undefined }) {
  if (!rating) return null;
  const labels: Record<number, string> = { 1: "Needs Improvement", 2: "Good", 3: "Excellent" };
  const colors: Record<number, string> = { 1: "text-gray-600", 2: "text-amber-600", 3: "text-emerald-600" };
  return <span className={`text-sm font-semibold ${colors[rating] || ""}`}>{labels[rating] || ""}</span>;
}

// ─── Error Components ──────────────────────────────────────────────────────


function RatingErrorButton({ val, opt, error, character, dimKey, idx }: {
  val: number;
  opt: typeof RATING_OPTIONS[number] | undefined;
  error: PronunciationError;
  character?: string;
  dimKey: string;
  idx: number;
}) {
  const [open, setOpen] = useState(false);
  const categoryColor =
    error.category === "tone"
      ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-900"
      : error.category === "initial"
      ? "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-700 hover:bg-violet-200 dark:hover:bg-violet-900"
      : "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700 hover:bg-orange-200 dark:hover:bg-orange-900";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={error.commonError}
        className={`text-sm font-semibold px-2 py-0.5 rounded transition-colors cursor-pointer ${categoryColor}`}
        data-testid={`char-rating-${idx}-${dimKey}`}
      >
        {opt?.label || val}
      </button>
      <ErrorDetailDialog error={error} open={open} onClose={() => setOpen(false)} character={character} />
    </>
  );
}

function NewErrorForm({
  category,
  onCreated,
  onCancel,
}: {
  category: "tone" | "initial" | "final";
  onCreated: (error: PronunciationError) => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [simple, setSimple] = useState("");
  const [fix, setFix] = useState("");
  const [words, setWords] = useState("");

  const createError = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/errors", {
        category,
        commonError: name.trim(),
        simpleExplanation: simple.trim() || undefined,
        howToFix: fix.trim() || undefined,
        practiceWords: words.trim() ? words.split(",").map(w => w.trim()).filter(Boolean) : undefined,
      });
      return res.json();
    },
    onSuccess: (data: PronunciationError) => {
      queryClient.invalidateQueries({ queryKey: ["/api/errors"] });
      onCreated(data);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create error. Try again.", variant: "destructive" });
    },
  });

  return (
    <div className="mt-1.5 p-2.5 border border-dashed border-border rounded-lg bg-muted/20 space-y-2" data-testid="new-error-form">
      <p className="text-xs font-semibold text-muted-foreground">New {category} error</p>
      <Input
        placeholder="Error name (required)"
        value={name}
        onChange={e => setName(e.target.value)}
        className="h-8 text-xs"
        data-testid="new-error-name"
      />
      <Textarea
        placeholder="Simple explanation (optional)"
        value={simple}
        onChange={e => setSimple(e.target.value)}
        className="min-h-[56px] text-xs resize-none"
        data-testid="new-error-simple"
      />
      <Textarea
        placeholder="How to fix (optional)"
        value={fix}
        onChange={e => setFix(e.target.value)}
        className="min-h-[56px] text-xs resize-none"
        data-testid="new-error-fix"
      />
      <Input
        placeholder="Practice words (comma-separated, optional)"
        value={words}
        onChange={e => setWords(e.target.value)}
        className="h-8 text-xs"
        data-testid="new-error-words"
      />
      <div className="flex gap-1.5">
        <Button
          size="sm"
          className="h-7 text-xs px-3"
          disabled={!name.trim() || createError.isPending}
          onClick={() => createError.mutate()}
          data-testid="new-error-submit"
        >
          {createError.isPending ? "Adding..." : "Add error"}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={onCancel} data-testid="new-error-cancel">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ErrorSelect({
  category,
  value,
  onChange,
  errors,
}: {
  category: "tone" | "initial" | "final";
  value?: string;
  onChange: (id: string | undefined) => void;
  errors: PronunciationError[];
}) {
  const [showNewForm, setShowNewForm] = useState(false);
  const categoryErrors = errors.filter(e => e.category === category);

  if (showNewForm) {
    return (
      <NewErrorForm
        category={category}
        onCreated={(err) => {
          onChange(err.id);
          setShowNewForm(false);
        }}
        onCancel={() => setShowNewForm(false)}
      />
    );
  }

  return (
    <div className="mt-1" data-testid={`error-select-${category}`}>
      <Select
        value={value ?? "__none__"}
        onValueChange={(v) => {
          if (v === "__add_new__") {
            setShowNewForm(true);
          } else if (v === "__none__") {
            onChange(undefined);
          } else {
            onChange(v);
          }
        }}
      >
        <SelectTrigger className="h-7 text-xs border-border/50 bg-muted/20" data-testid={`error-select-trigger-${category}`}>
          <SelectValue placeholder="Link an error (optional)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">
            <span className="text-muted-foreground">No specific error</span>
          </SelectItem>
          {categoryErrors.map(e => (
            <SelectItem key={e.id} value={e.id} data-testid={`error-option-${e.id}`}>
              <span className="font-mono text-xs mr-1.5 text-muted-foreground">{e.id}</span>
              {e.commonError}
            </SelectItem>
          ))}
          <SelectItem value="__add_new__" className="text-primary font-medium">
            <Plus className="w-3 h-3 inline mr-1" />
            Add new error…
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── End Error Components ──────────────────────────────────────────────────

function CharacterRatingDisplay({ ratings, isReviewer, pinyinData, fluencyScore, errors = [] }: { ratings: CharacterRating[]; isReviewer?: boolean; pinyinData?: PinyinChar[]; fluencyScore?: number | null; errors?: PronunciationError[] }) {
  const chinesePinyinOnly = pinyinData?.filter(p => p.py) || [];

  const dimToErrorKey: Record<string, keyof CharacterRating> = {
    initial: "initialError",
    final: "finalError",
    tone: "toneError",
  };

  return (
    <div className="space-y-2 mt-2" data-testid="character-ratings-display">
      <div className="grid gap-2">
        {ratings.map((cr, idx) => {
          const charPy = !isReviewer && chinesePinyinOnly[idx] ? chinesePinyinOnly[idx] : null;
          return (
            <div key={idx} className="bg-muted/30 rounded-lg px-3 py-2">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center w-10 shrink-0" data-testid={`char-display-${idx}`}>
                  {charPy && (
                    <span className={`text-sm font-medium leading-tight ${TONE_COLORS[charPy.tone]}`}>{charPy.py}</span>
                  )}
                  <span className="text-lg font-bold">{cr.character}</span>
                </div>
                <div className="flex gap-2 flex-1 flex-wrap">
                  {DIMENSIONS.map((dim) => {
                    const val = cr[dim.key];
                    const opt = RATING_OPTIONS.find(o => o.value === val);
                    const errorId = cr[dimToErrorKey[dim.key]] as string | undefined;
                    const linkedError = errorId ? errors.find(e => e.id === errorId) : undefined;
                    return (
                      <div key={dim.key} className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-muted-foreground">{isReviewer ? dim.chinese : dim.english}</span>
                          {linkedError ? (
                            <RatingErrorButton
                              val={val}
                              opt={opt}
                              error={linkedError}
                              character={cr.character}
                              dimKey={dim.key}
                              idx={idx}
                            />
                          ) : (
                            <span className={`text-sm font-semibold px-2 py-0.5 rounded tabular-nums ${
                              val >= 80 ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" :
                              val >= 60 ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300" :
                              "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300"
                            }`} data-testid={`char-rating-${idx}-${dim.key}`}>
                              {val}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {fluencyScore != null && <FluencyDisplay score={fluencyScore} />}
    </div>
  );
}


function FluencyStarPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="border border-border/50 rounded-lg p-3 bg-card" data-testid="fluency-picker">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium">Fluency</span>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="fluency-info-btn">
              <Info className="w-3.5 h-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 text-sm" side="top">
            <p className="font-medium mb-1">Fluency Rating</p>
            <p className="text-muted-foreground">Measures how naturally the sentence flows overall — rhythm, pacing, and connected speech. This accounts for 20% of the total score.</p>
          </PopoverContent>
        </Popover>
        {value !== null && (
          <span className="text-xs text-muted-foreground ml-auto">{value}/5 ({value * 20}%)</span>
        )}
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(s => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(value === s ? null : s)}
            className="p-1 transition-colors hover:opacity-80"
            data-testid={`fluency-star-${s}`}
          >
            <Star className={`w-6 h-6 ${value !== null && s <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

const DIM_ERROR_KEY: Record<"initial" | "final" | "tone", "initialError" | "finalError" | "toneError"> = {
  initial: "initialError",
  final: "finalError",
  tone: "toneError",
};

function CharacterRatingInput({
  characters,
  ratings,
  onChange,
  fluency,
  onFluencyChange,
  errors = [],
}: {
  characters: string[];
  ratings: CharacterRating[];
  onChange: (ratings: CharacterRating[]) => void;
  fluency: number | null;
  onFluencyChange: (v: number | null) => void;
  errors?: PronunciationError[];
}) {
  const handleChange = (charIdx: number, dim: "initial" | "final" | "tone", value: number) => {
    const updated = [...ratings];
    const existing = updated[charIdx] ?? {};
    const patch: Partial<CharacterRating> = { [dim]: value };
    // Clear linked error when rating improves to Great
    if (value === 100) {
      patch[DIM_ERROR_KEY[dim]] = undefined;
    }
    updated[charIdx] = { ...existing, ...patch } as CharacterRating;
    onChange(updated);
  };

  const handleErrorChange = (charIdx: number, dim: "initial" | "final" | "tone", errorId: string | undefined) => {
    const updated = [...ratings];
    updated[charIdx] = { ...updated[charIdx], [DIM_ERROR_KEY[dim]]: errorId };
    onChange(updated);
  };

  const overallScore = useMemo(() => {
    if (ratings.length === 0) return null;
    const allSet = ratings.every(r => r.initial !== -1 && r.final !== -1 && r.tone !== -1);
    if (!allSet) return null;
    const charTotal = ratings.reduce((sum, r) => sum + r.initial + r.final + r.tone, 0);
    const charScore = charTotal / (ratings.length * 3);
    if (fluency !== null) {
      return Math.round(charScore * 0.8 + (fluency * 20) * 0.2);
    }
    return Math.round(charScore);
  }, [ratings, fluency]);

  if (characters.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic p-3 bg-muted/20 rounded-lg">
        No Chinese characters found in the sentence text.
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="character-rating-input">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Character Ratings</label>
        {overallScore !== null && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Overall:</span>
            <span className={`text-sm font-bold ${getScoreTextColor(overallScore)}`} data-testid="overall-score-live">{overallScore}%</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {characters.map((char, charIdx) => (
          <div key={charIdx} className="border border-border/50 rounded-lg p-3 bg-card" data-testid={`char-input-${charIdx}`}>
            <div className="text-2xl font-bold text-center mb-2" data-testid={`char-label-${charIdx}`}>{char}</div>
            <div className="space-y-2">
              {DIMENSIONS.map((dim) => {
                const currentVal = ratings[charIdx]?.[dim.key] ?? -1;
                const showError = currentVal >= 0 && currentVal < 75;
                const linkedError = ratings[charIdx]?.[DIM_ERROR_KEY[dim.key]] as string | undefined;
                return (
                  <div key={dim.key}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium w-10 shrink-0">
                        {dim.chinese}
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        placeholder="—"
                        value={currentVal >= 0 ? currentVal : ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '') { handleChange(charIdx, dim.key, -1); return; }
                          const n = Math.min(100, Math.max(0, Math.round(parseFloat(v))));
                          handleChange(charIdx, dim.key, n);
                        }}
                        className={`w-16 text-center text-sm font-semibold tabular-nums py-1 px-2 rounded border outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                          currentVal < 0 ? "bg-muted border-border text-muted-foreground" :
                          currentVal >= 80 ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700" :
                          currentVal >= 60 ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700" :
                          "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700"
                        }`}
                        data-testid={`rate-${charIdx}-${dim.key}`}
                      />
                      <span className="text-xs text-muted-foreground">/ 100</span>
                    </div>
                    {showError && errors.length > 0 && (
                      <ErrorSelect
                        category={dim.key}
                        value={linkedError}
                        onChange={(id) => handleErrorChange(charIdx, dim.key, id)}
                        errors={errors}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <FluencyStarPicker value={fluency} onChange={onFluencyChange} />
    </div>
  );
}

function EditableFeedbackCard({
  item,
  isOwner,
  isReviewer,
  pinyinData,
  recordingId,
  sentenceText,
  characters,
  rerecordUrl,
  rerecordLabel,
}: {
  item: any;
  isOwner: boolean;
  isReviewer: boolean;
  pinyinData: PinyinChar[];
  recordingId: number;
  sentenceText: string;
  characters: string[];
  rerecordUrl?: string | null;
  rerecordLabel?: string | null;
}) {
  const { toast } = useToast();
  const { data: errors = [] } = useAllErrors();
  const [isEditing, setIsEditing] = useState(false);
  const [editCorrections, setEditCorrections] = useState((item as any).corrections || "");
  const [editTextFeedback, setEditTextFeedback] = useState(item.textFeedback || "");
  const [editCharRatings, setEditCharRatings] = useState<CharacterRating[]>(
    item.characterRatings && Array.isArray(item.characterRatings)
      ? (item.characterRatings as CharacterRating[])
      : characters.map(c => ({ character: c, initial: -1 as any, final: -1 as any, tone: -1 as any }))
  );
  const [editFluency, setEditFluency] = useState<number | null>(item.fluencyScore ?? null);

  const allRated = editCharRatings.length > 0 && editCharRatings.every(r => r.initial !== -1 && r.final !== -1 && r.tone !== -1);

  const updateFeedback = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/feedback/${item.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.recordings.get.path, recordingId] });
      toast({ title: "Feedback updated", description: "Your changes have been saved." });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update feedback.", variant: "destructive" });
    },
  });

  const deleteFeedback = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/feedback/${item.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.recordings.get.path, recordingId] });
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
      toast({ title: "Feedback deleted", description: "Your feedback has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete feedback.", variant: "destructive" });
    },
  });

  const handleSaveEdit = () => {
    if (!editTextFeedback.trim() && !editCorrections.trim()) {
      toast({ title: "Empty Feedback", description: "Please provide corrections or comments.", variant: "destructive" });
      return;
    }
    if (characters.length > 0 && !allRated) {
      toast({ title: "Ratings Incomplete", description: "Please rate all characters.", variant: "destructive" });
      return;
    }
    const validRatings = editCharRatings.filter(r => r.initial !== -1 && r.final !== -1 && r.tone !== -1);
    updateFeedback.mutate({
      textFeedback: editTextFeedback,
      corrections: editCorrections || null,
      characterRatings: validRatings.length > 0 ? validRatings : undefined,
      fluencyScore: editFluency,
    });
  };

  const startEditing = () => {
    setEditCorrections((item as any).corrections || "");
    setEditTextFeedback(item.textFeedback || "");
    setEditCharRatings(
      item.characterRatings && Array.isArray(item.characterRatings)
        ? (item.characterRatings as CharacterRating[])
        : characters.map(c => ({ character: c, initial: -1 as any, final: -1 as any, tone: -1 as any }))
    );
    setEditFluency(item.fluencyScore ?? null);
    setIsEditing(true);
  };

  return (
    <Card className="bg-secondary/5 border-secondary/20">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {item.isAiFeedback ? (
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center" data-testid={`ai-avatar-${item.id}`}>
              <Bot className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold">
              {item.reviewer?.firstName?.[0] || "R"}
            </div>
          )}
          <div className="flex-1">
            <div className="flex justify-between items-start mb-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {item.isAiFeedback ? (
                    <span className="flex items-center gap-1.5 font-bold text-foreground" data-testid={`reviewer-name-${item.id}`}>
                      AI Review
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium" data-testid={`ai-badge-${item.id}`}>
                        Auto
                      </Badge>
                    </span>
                  ) : (
                    <span className="font-bold text-foreground" data-testid={`reviewer-name-${item.id}`}>
                      {item.reviewer ? `${item.reviewer.firstName || ''} ${item.reviewer.lastName || ''}`.trim() || 'Reviewer' : 'Reviewer'}
                    </span>
                  )}
                  {!item.isAiFeedback && item.reviewer?.city && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`reviewer-city-${item.id}`}>
                      <MapPin className="w-3 h-3" />
                      {item.reviewer.city}
                    </span>
                  )}
                </div>
                {!isEditing && (
                  item.overallScore !== null && item.overallScore !== undefined ? (
                    <ScoreBadge score={item.overallScore} />
                  ) : (
                    <OldRatingDisplay rating={item.rating} />
                  )
                )}
              </div>
              <div className="flex items-center gap-2">
                {isOwner && !isEditing && (
                  <>
                    <Button variant="ghost" size="icon" onClick={startEditing} data-testid={`edit-feedback-${item.id}`}>
                      <Pencil className="w-5 h-5" strokeWidth={2.5} />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive" data-testid={`delete-feedback-${item.id}`}>
                          <Trash2 className="w-5 h-5" strokeWidth={2.5} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Feedback</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete your feedback. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteFeedback.mutate()}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            data-testid={`confirm-delete-feedback-${item.id}`}
                          >
                            {deleteFeedback.isPending ? "Deleting..." : "Delete"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
                <span className="text-xs text-muted-foreground">{format(new Date(item.createdAt), 'MMM d, HH:mm')}</span>
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-4 mt-2">
                <CharacterRatingInput
                  characters={characters}
                  ratings={editCharRatings}
                  onChange={setEditCharRatings}
                  fluency={editFluency}
                  onFluencyChange={setEditFluency}
                  errors={errors}
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Corrections</label>
                  <Textarea
                    className="min-h-[80px] resize-none"
                    value={editCorrections}
                    onChange={(e) => setEditCorrections(e.target.value)}
                    data-testid={`edit-corrections-${item.id}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Overall Comments</label>
                  <Textarea
                    className="min-h-[100px] resize-none"
                    value={editTextFeedback}
                    onChange={(e) => setEditTextFeedback(e.target.value)}
                    data-testid={`edit-text-feedback-${item.id}`}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveEdit}
                    disabled={updateFeedback.isPending || (!editTextFeedback.trim() && !editCorrections.trim()) || (characters.length > 0 && !allRated)}
                    data-testid={`save-feedback-${item.id}`}
                  >
                    {updateFeedback.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button variant="ghost" onClick={() => setIsEditing(false)} data-testid={`cancel-edit-${item.id}`}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {item.characterRatings && Array.isArray(item.characterRatings) && item.characterRatings.length > 0 && (
                  item.isAiFeedback ? (
                    <AIFeedbackRatings feedback={item} sentenceText={sentenceText} recordingId={recordingId} />
                  ) : (
                    <CharacterRatingDisplay ratings={item.characterRatings as CharacterRating[]} isReviewer={isReviewer} pinyinData={pinyinData} fluencyScore={item.fluencyScore} errors={errors} />
                  )
                )}
                {!(item.characterRatings && Array.isArray(item.characterRatings) && item.characterRatings.length > 0) && item.fluencyScore != null && (
                  <FluencyDisplay score={item.fluencyScore} />
                )}

                {(item as any).corrections && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2" data-testid="corrections-label">Corrections</p>
                    <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed" data-testid="corrections-text">
                      {(item as any).corrections}
                    </p>
                  </div>
                )}

                {item.textFeedback && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Overall Comments</p>
                    <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {item.textFeedback}
                    </p>
                  </div>
                )}

                {item.audioFeedbackUrl && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Audio Correction</p>
                    <audio
                      controls
                      className="w-full h-10"
                      preload="auto"
                      playsInline
                    >
                      <source src={item.audioFeedbackUrl} />
                    </audio>
                  </div>
                )}

                {rerecordUrl && rerecordLabel && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <Link href={rerecordUrl}>
                      <Button
                        size="lg"
                        variant="outline"
                        className="w-full gap-2 h-12 text-base border-2 border-primary/40 hover:border-primary hover:bg-primary/5 transition-all"
                        data-testid="rerecord-btn"
                      >
                        <RotateCcw className="w-5 h-5" />
                        {rerecordLabel}
                      </Button>
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RecordingDetail() {
  const { id } = useParams<{ id: string }>();
  const recordingId = parseInt(id || "0");
  const { data: recording, isLoading: loadingRecording } = useRecording(recordingId, { pollUntilAiFeedback: true });
  const { data: user, isLoading: loadingUser } = useQuery<SharedUser>({ queryKey: ["/api/auth/user"] });
  const { data: childRecordings } = useChildRecordings(recordingId);
  const { data: parentRecording } = useRecording(recording?.parentRecordingId ?? 0);
  const createFeedback = useCreateFeedback(recordingId);
  const { uploadFile, isUploading } = useUpload();
  const { toast } = useToast();
  const { data: errors = [] } = useAllErrors();
  
  const { showPinyin } = useDisplayPrefs();

  const [feedbackText, setFeedbackText] = useState("");
  const [correctionsText, setCorrectionsText] = useState("");
  const [isRecordingFeedback, setIsRecordingFeedback] = useState(false);
  const [expandedChildren, setExpandedChildren] = useState<Record<number, boolean>>({});

  const [showRerecordFeedback, setShowRerecordFeedback] = useState(true);

  const [, navigate] = useLocation();
  const isLoading = loadingRecording || loadingUser;
  const backUrl = user?.role === 'reviewer' ? "/reviewer-hub" : "/learner-portal";

  const characters = useMemo(() => {
    if (!recording) return [];
    return extractChineseChars(recording.sentenceText);
  }, [recording]);

  const pinyinData = useMemo(() => {
    if (!recording) return [];
    return getCharPinyin(recording.sentenceText);
  }, [recording]);

  const [charRatings, setCharRatings] = useState<CharacterRating[]>([]);
  const [fluency, setFluency] = useState<number | null>(null);

  useMemo(() => {
    if (characters.length > 0 && charRatings.length !== characters.length) {
      setCharRatings(characters.map(c => ({ character: c, initial: -1 as any, final: -1 as any, tone: -1 as any })));
    }
  }, [characters]);

  const latestScore = useMemo(() => {
    if (!recording?.feedback?.length) return null;
    const scores = (recording.feedback as any[]).map((f: any) => f.overallScore).filter((s: any) => s !== null && s !== undefined);
    return scores.length > 0 ? scores[0] : null;
  }, [recording?.feedback]);

  const canDelete = user && recording && (
    recording.userId === user.id || user.role === "reviewer"
  );

  const isOwner = user && recording && recording.userId === user.id && user.role !== "reviewer";
  const reviewerHasFeedback = user?.role === 'reviewer' && recording?.feedback?.some((f: any) => f.reviewerId === user?.id);
  const hasAiFeedback = recording?.feedback?.some((f: any) => f.isAiFeedback) ?? false;

  const aiReviewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/recordings/${recordingId}/ai-review`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recordings", recordingId] });
    },
    onError: (err: any) => {
      toast({ title: "AI review failed", description: err?.message ?? "Please try again.", variant: "destructive" });
    },
  });
  const charCount = recording ? countChineseChars(recording.sentenceText) : 0;
  const alreadyHasRerecording = childRecordings && childRecordings.length > 0;
  const rerecordLabel = isOwner && !alreadyHasRerecording
    ? recording?.status === "pending"
      ? "Free redo"
      : `Re-record (30% off, ${Math.ceil(charCount * 0.7)} credit${Math.ceil(charCount * 0.7) !== 1 ? "s" : ""})`
    : null;
  const rerecordUrl = recording && !alreadyHasRerecording
    ? `/record?rerecordOf=${recordingId}&sentenceText=${encodeURIComponent(recording.sentenceText)}&redo=${recording.status === "pending" ? "free" : "discount"}`
    : null;

  const mainCardRef = useRef<HTMLDivElement>(null);
  const [showMiniBar, setShowMiniBar] = useState(false);
  const [miniBarReady, setMiniBarReady] = useState(false);

  useLayoutEffect(() => {
    setShowMiniBar(false);
    setMiniBarReady(false);
    const mainEl = document.querySelector('main');
    if (!mainEl) return;
    mainEl.scrollTop = 0;
    const handleScroll = () => {
      if (!mainCardRef.current) return;
      const rect = mainCardRef.current.getBoundingClientRect();
      setShowMiniBar(rect.top < 0);
    };
    mainEl.addEventListener('scroll', handleScroll, { passive: true });
    const rafId = requestAnimationFrame(() => setMiniBarReady(true));
    return () => {
      cancelAnimationFrame(rafId);
      mainEl.removeEventListener('scroll', handleScroll);
    };
  }, [recording]);

  const deleteRecording = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/recordings/${recordingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recordings"] });
      toast({ title: "Recording deleted", description: "The recording has been removed." });
      navigate(backUrl);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete the recording.", variant: "destructive" });
    },
  });

  const allRated = charRatings.length > 0 && charRatings.every(r => r.initial !== -1 && r.final !== -1 && r.tone !== -1);

  const handleFeedbackSubmit = async (audioFile?: File) => {
    if (!feedbackText.trim() && !correctionsText.trim() && !audioFile) {
      toast({
        title: "Empty Feedback",
        description: "Please provide corrections, comments, or audio feedback.",
        variant: "destructive",
      });
      return;
    }

    if (characters.length > 0 && !allRated) {
      toast({
        title: "Ratings Incomplete",
        description: "Please rate all characters before submitting.",
        variant: "destructive",
      });
      return;
    }

    try {
      let audioUrl = undefined;
      
      if (audioFile) {
        const uploadRes = await uploadFile(audioFile);
        if (uploadRes) {
          audioUrl = uploadRes.objectPath;
        }
      }

      const validRatings = charRatings.filter(r => r.initial !== -1 && r.final !== -1 && r.tone !== -1);

      await createFeedback.mutateAsync({
        recordingId,
        textFeedback: feedbackText,
        corrections: correctionsText || undefined,
        audioFeedbackUrl: audioUrl,
        characterRatings: validRatings.length > 0 ? validRatings : undefined,
        fluencyScore: fluency,
      } as any);

      toast({
        title: "Feedback Sent",
        description: "Your feedback has been saved.",
      });
      
      setFeedbackText("");
      setCorrectionsText("");
      setCharRatings(characters.map(c => ({ character: c, initial: -1 as any, final: -1 as any, tone: -1 as any })));
      setFluency(null);
      setIsRecordingFeedback(false);
      
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to submit feedback.",
        variant: "destructive",
      });
    }
  };

  if (isLoading || !recording) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Fixed mini bar — only mounted after first rAF so it can never flash on initial render */}
      {miniBarReady && (
        <div className={`fixed top-16 md:top-0 left-0 md:left-64 right-0 z-30 bg-card/95 backdrop-blur-sm border-b border-border shadow-md transition-all duration-200 ${showMiniBar ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'}`}>
          <div className="h-1.5 bg-primary w-full" />
          <div className="flex items-center gap-4 px-4 md:px-8 py-3">
            <div className="flex flex-wrap items-end gap-x-2 gap-y-1 flex-1 min-w-0 overflow-hidden">
              {pinyinData.map((p, i) => (
                <div key={i} className="flex flex-col items-center shrink-0">
                  <span className={`text-sm font-medium leading-tight ${TONE_COLORS[p.tone]}`}>{p.py}</span>
                  <span className={`text-2xl font-display font-bold leading-tight ${p.py ? TONE_COLORS[p.tone] : 'text-foreground/60'}`}>{p.char}</span>
                </div>
              ))}
            </div>
            <audio src={recording.audioUrl} controls className="shrink-0 w-44 h-8" preload="none" />
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-8 animate-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
             <Link href={backUrl}>
               <Button variant="ghost" size="sm">
                 <ChevronLeft className="w-4 h-4 mr-1" />
                 Back
               </Button>
             </Link>
             <h1 className="text-xl font-medium text-muted-foreground">
               Recording #{id} by {recording.user?.firstName || recording.user?.email || "Unknown User"}
             </h1>
          </div>
          <div className="flex items-center gap-2">
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive" data-testid="delete-recording-btn">
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Recording</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this recording and any associated feedback. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteRecording.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="confirm-delete-btn"
                  >
                    {deleteRecording.isPending ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          </div>
        </div>

        <div className={`grid grid-cols-1 ${user?.role === 'reviewer' && !reviewerHasFeedback ? 'lg:grid-cols-3' : ''} gap-8`}>
          <div className={`${user?.role === 'reviewer' && !reviewerHasFeedback ? 'lg:col-span-2' : ''} space-y-6`}>
            <div ref={mainCardRef}>
            <Card className="border-border shadow-md overflow-hidden bg-card">
              <div className="h-2 w-full bg-muted/40 relative" data-testid="score-progress-bar">
                <div
                  className={`h-full transition-all duration-700 ${latestScore === null ? "bg-primary w-full" : getScoreBgColor(latestScore)}`}
                  style={latestScore !== null ? { width: `${latestScore}%` } : undefined}
                />
              </div>
              <CardContent className="p-8">
                <div className="mb-8">
                  {pinyinData.length > 0 ? (
                    <div className="mb-1 group/pinyin" data-testid="sentence-with-pinyin">
                      {showPinyin && (
                        <div className="mb-1 h-5 opacity-0 group-hover/pinyin:opacity-100 transition-opacity duration-200">
                          <p className="text-xs text-muted-foreground">
                            Pinyin is on —{" "}
                            <Link href="/profile?tab=settings" className="underline hover:text-foreground transition-colors">
                              turn it off in Settings
                            </Link>
                          </p>
                        </div>
                      )}
                      <SandhiPhraseDisplay pinyinChars={pinyinData} charSize="text-3xl" pinyinSize="text-base" />
                    </div>
                  ) : (
                    <h2 className="text-3xl font-display font-bold text-foreground mb-1 leading-tight">
                      {recording.sentenceText}
                    </h2>
                  )}
                  {getPhraseEnglish(recording.sentenceText) && (
                    <p className="text-base text-muted-foreground mb-4">{getPhraseEnglish(recording.sentenceText)}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    {recording.user?.chineseLevel && (
                      <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-md" data-testid="learner-level-badge">
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span className="font-medium text-xs">{recording.user.chineseLevel}</span>
                      </div>
                    )}
                    <span className="text-sm text-muted-foreground">
                      Submitted on {format(new Date(recording.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>

                <AudioComparison
                  learnerAudioUrl={recording.audioUrl}
                  sentenceText={recording.sentenceText}
                />
              </CardContent>
            </Card>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Feedback History
              </h3>
              
              {recording.feedback && recording.feedback.length > 0 ? (
                recording.parentRecordingId && parentRecording?.feedback && parentRecording.feedback.length > 0 ? (
                  // Re-recording with new feedback: show original feedback + collapsible new feedback
                  <>
                    {(parentRecording.feedback as any[]).map((item: any) => (
                      <EditableFeedbackCard
                        key={item.id}
                        item={item}
                        isOwner={item.reviewerId === user?.id}
                        isReviewer={user?.role === 'reviewer'}
                        pinyinData={pinyinData}
                        recordingId={parentRecording.id}
                        sentenceText={parentRecording.sentenceText}
                        characters={characters}
                      />
                    ))}
                    <div className="border border-orange-300 dark:border-orange-800 rounded-xl overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors text-left"
                        onClick={() => setShowRerecordFeedback(v => !v)}
                        data-testid="toggle-rerecord-feedback"
                      >
                        <span className="text-sm font-semibold flex items-center gap-2 text-orange-700 dark:text-orange-400">
                          <RotateCcw className="w-4 h-4" />
                          Feedback on Re-recording
                        </span>
                        {showRerecordFeedback ? <ChevronUp className="w-4 h-4 text-orange-500" /> : <ChevronDown className="w-4 h-4 text-orange-500" />}
                      </button>
                      {showRerecordFeedback && (
                        <div className="p-3 space-y-3 border-t border-orange-200 dark:border-orange-800/60 bg-orange-50/50 dark:bg-orange-950/20">
                          {recording.feedback.map((item: any, idx: number) => (
                            <EditableFeedbackCard
                              key={item.id}
                              item={item}
                              isOwner={item.reviewerId === user?.id}
                              isReviewer={user?.role === 'reviewer'}
                              pinyinData={pinyinData}
                              recordingId={recordingId}
                              sentenceText={recording.sentenceText}
                              characters={characters}
                              rerecordUrl={isOwner && idx === 0 ? rerecordUrl : null}
                              rerecordLabel={isOwner && idx === 0 ? rerecordLabel : null}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  // Regular recording: show feedback cards as before
                  recording.feedback.map((item: any, idx: number) => (
                    <EditableFeedbackCard
                      key={item.id}
                      item={item}
                      isOwner={item.reviewerId === user?.id}
                      isReviewer={user?.role === 'reviewer'}
                      pinyinData={pinyinData}
                      recordingId={recordingId}
                      sentenceText={recording.sentenceText}
                      characters={characters}
                      rerecordUrl={isOwner && idx === 0 ? rerecordUrl : null}
                      rerecordLabel={isOwner && idx === 0 ? rerecordLabel : null}
                    />
                  ))
                )
              ) : recording.parentRecordingId ? (
                user?.role === 'reviewer' && !reviewerHasFeedback ? (
                  // Reviewer view of a re-recording: comparison context + embedded form
                  <div className="bg-muted/10 border border-border/50 rounded-xl p-4 space-y-4">
                    <p className="text-sm font-medium text-foreground">
                      The learner submitted a re-recording. Compare with the original and give updated feedback.
                    </p>

                    <div className="grid gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Re-recording</p>
                        {recording.audioUrl && (
                          <audio controls className="w-full h-10" preload="auto" playsInline>
                            <source src={recording.audioUrl} />
                          </audio>
                        )}
                      </div>
                      {parentRecording?.audioUrl && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Original recording</p>
                          <audio controls className="w-full h-10" preload="auto" playsInline>
                            <source src={parentRecording.audioUrl} />
                          </audio>
                        </div>
                      )}
                    </div>

                    {parentRecording?.feedback && parentRecording.feedback.length > 0 && (
                      <div className="space-y-3 pt-2 border-t border-border/40">
                        <p className="text-xs text-muted-foreground font-medium">Previous feedback for reference:</p>
                        {(parentRecording.feedback as any[]).map((item: any) => (
                          <EditableFeedbackCard
                            key={item.id}
                            item={item}
                            isOwner={item.reviewerId === user?.id}
                            isReviewer={true}
                            pinyinData={pinyinData}
                            recordingId={parentRecording.id}
                            sentenceText={parentRecording.sentenceText}
                            characters={characters}
                          />
                        ))}
                      </div>
                    )}

                    {/* Embedded Add Feedback form */}
                    <div className="pt-2 border-t border-border/40 space-y-4">
                      <p className="text-sm font-semibold">Your feedback on the re-recording</p>
                      <CharacterRatingInput
                        characters={characters}
                        ratings={charRatings}
                        onChange={setCharRatings}
                        fluency={fluency}
                        onFluencyChange={setFluency}
                        errors={errors}
                      />
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Corrections</label>
                        <Textarea
                          placeholder="Write corrections for specific characters or phrases..."
                          className="min-h-[80px] resize-none"
                          value={correctionsText}
                          onChange={(e) => setCorrectionsText(e.target.value)}
                          data-testid="corrections-text-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Overall Comments</label>
                        <Textarea
                          placeholder="Provide overall feedback on tones and pronunciation..."
                          className="min-h-[120px] resize-none"
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          data-testid="feedback-text-input"
                        />
                      </div>
                      <Separator />
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Audio Correction (Optional)</label>
                        {isRecordingFeedback ? (
                          <AudioRecorder
                            onRecordingComplete={handleFeedbackSubmit}
                            isUploading={isUploading || createFeedback.isPending}
                          />
                        ) : (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => setIsRecordingFeedback(true)}
                            data-testid="record-audio-btn"
                          >
                            <Mic className="w-4 h-4 mr-2" />
                            Record Audio Response
                          </Button>
                        )}
                      </div>
                      {!isRecordingFeedback && (
                        <Button
                          className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                          onClick={() => handleFeedbackSubmit()}
                          disabled={createFeedback.isPending || (!feedbackText.trim() && !correctionsText.trim()) || (characters.length > 0 && !allRated)}
                          data-testid="submit-feedback-btn"
                        >
                          {createFeedback.isPending ? "Submitting..." : "Submit Text Feedback"}
                        </Button>
                      )}
                      {isRecordingFeedback && (
                        <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setIsRecordingFeedback(false)} data-testid="cancel-recording-btn">
                          Cancel Recording
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  // Learner view of a re-recording: awaiting message + parent context
                  <>
                    <div className="bg-muted/20 rounded-xl px-4 py-3 space-y-3">
                      <p className="text-xs text-muted-foreground italic">
                        Awaiting reviewer feedback on this re-recording. Listen back while you wait:
                      </p>
                      {recording.audioUrl && (
                        <audio controls className="w-full h-10" preload="auto" playsInline>
                          <source src={recording.audioUrl} />
                        </audio>
                      )}
                      {parentRecording?.feedback && parentRecording.feedback.length > 0 && (
                        <p className="text-xs text-muted-foreground font-medium pt-1 border-t border-border/40">
                          Original feedback that prompted this re-recording:
                        </p>
                      )}
                    </div>
                    {parentRecording?.feedback && (parentRecording.feedback as any[]).map((item: any) => (
                      <EditableFeedbackCard
                        key={item.id}
                        item={item}
                        isOwner={false}
                        isReviewer={false}
                        pinyinData={pinyinData}
                        recordingId={parentRecording.id}
                        sentenceText={parentRecording.sentenceText}
                        characters={characters}
                      />
                    ))}
                  </>
                )
              ) : (
                <div className="text-center py-8 space-y-4 bg-muted/20 rounded-xl">
                  {isOwner && !hasAiFeedback ? (
                    <>
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Bot className="w-4 h-4 animate-pulse" />
                        <p className="italic text-sm">AI is scoring your recording…</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => aiReviewMutation.mutate()}
                        disabled={aiReviewMutation.isPending}
                        className="text-xs text-muted-foreground"
                        data-testid="get-ai-review-btn"
                      >
                        {aiReviewMutation.isPending ? "Scoring…" : "Not loading? Tap to retry"}
                      </Button>
                    </>
                  ) : (
                    <p className="text-muted-foreground italic">No feedback provided yet.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Nested re-recordings */}
          {isOwner && childRecordings && childRecordings.length > 0 && (
            <div className="col-span-full space-y-3">
              <h3 className="text-lg font-bold flex items-center gap-2 text-muted-foreground">
                <RotateCcw className="w-4 h-4" />
                Re-recordings
              </h3>
              {childRecordings.map((child) => {
                const isExpanded = expandedChildren[child.id] ?? true;
                const latestFeedback = child.feedback?.[0];
                const childChars = extractChineseChars(child.sentenceText);
                const childPinyin = getCharPinyin(child.sentenceText);
                return (
                  <Card key={child.id} className="border-2 border-primary/20 bg-primary/3">
                    <CardContent className="p-5">
                      <button
                        className="w-full flex items-center justify-between gap-3 text-left"
                        onClick={() => setExpandedChildren(prev => ({ ...prev, [child.id]: !isExpanded }))}
                        data-testid={`toggle-child-${child.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {latestFeedback?.overallScore != null && (
                            <ScoreBadge score={latestFeedback.overallScore} />
                          )}
                          <span className="text-sm text-muted-foreground">{format(new Date(child.createdAt), 'MMM d, HH:mm')}</span>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                      </button>

                      {isExpanded && (
                        <div className="mt-4 space-y-4">
                          {child.audioUrl && (
                            <audio controls className="w-full h-10" preload="auto" playsInline>
                              <source src={child.audioUrl} />
                            </audio>
                          )}
                          {child.feedback && child.feedback.length > 0 ? (
                            child.feedback.map((item: any) => (
                              <EditableFeedbackCard
                                key={item.id}
                                item={item}
                                isOwner={false}
                                isReviewer={false}
                                pinyinData={childPinyin}
                                recordingId={child.id}
                                sentenceText={child.sentenceText}
                                characters={childChars}
                              />
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground italic text-center py-4">No feedback yet on this re-recording.</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {user?.role === 'reviewer' && !reviewerHasFeedback && !recording.parentRecordingId && (
            <div className="space-y-6">
              <Card className="shadow-lg border-t-4 border-t-secondary sticky top-8">
                <CardHeader>
                  <CardTitle>Add Feedback</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CharacterRatingInput
                    characters={characters}
                    ratings={charRatings}
                    onChange={setCharRatings}
                    fluency={fluency}
                    onFluencyChange={setFluency}
                    errors={errors}
                  />

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Corrections</label>
                    <Textarea 
                      placeholder="Write corrections for specific characters or phrases..."
                      className="min-h-[100px] resize-none"
                      value={correctionsText}
                      onChange={(e) => setCorrectionsText(e.target.value)}
                      data-testid="corrections-text-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Overall Comments</label>
                    <Textarea 
                      placeholder="Provide overall feedback on tones and pronunciation..."
                      className="min-h-[150px] resize-none"
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      data-testid="feedback-text-input"
                    />
                  </div>

                  <Separator />
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Audio Correction (Optional)</label>
                    {isRecordingFeedback ? (
                       <AudioRecorder 
                         onRecordingComplete={handleFeedbackSubmit}
                         isUploading={isUploading || createFeedback.isPending}
                       />
                    ) : (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => setIsRecordingFeedback(true)}
                        data-testid="record-audio-btn"
                      >
                        <Mic className="w-4 h-4 mr-2" />
                        Record Audio Response
                      </Button>
                    )}
                  </div>

                  {!isRecordingFeedback && (
                    <Button 
                      className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                      onClick={() => handleFeedbackSubmit()}
                      disabled={createFeedback.isPending || (!feedbackText.trim() && !correctionsText.trim()) || (characters.length > 0 && !allRated)}
                      data-testid="submit-feedback-btn"
                    >
                      {createFeedback.isPending ? "Submitting..." : "Submit Text Feedback"}
                    </Button>
                  )}
                  
                  {isRecordingFeedback && (
                     <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setIsRecordingFeedback(false)} data-testid="cancel-recording-btn">
                       Cancel Recording
                     </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
