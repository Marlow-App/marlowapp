import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { RotateCcw, ExternalLink, Loader2, Bot, RefreshCw, Mic, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { getScoreTextColor } from "@/lib/scoreColor";
import { api, buildUrl } from "@shared/routes";
import { AICharacterRatingDisplay } from "@/components/AIFeedbackDisplay";
import { useAllErrors } from "@/hooks/use-errors";
import { getCharPinyin, type PinyinChar } from "@/lib/pinyin-utils";
import { SandhiPhraseDisplay } from "@/components/SandhiPhraseDisplay";
import type { CharacterRating, SpeechSuperScores } from "@shared/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AiFeedbackItem {
  id: number;
  isAiFeedback: boolean;
  overallScore: number | null;
  fluencyScore: number | null;
  characterRatings: CharacterRating[] | null;
  speechSuperScores?: SpeechSuperScores | null;
}

interface RecordingResponse {
  id: number;
  status: "pending" | "reviewed";
  sentenceText: string;
  audioUrl: string | null;
  feedback: AiFeedbackItem[];
}

// ─── TTS audio fetcher ────────────────────────────────────────────────────────

function useTtsAudio(sentenceText: string, enabled: boolean) {
  const mutation = useMutation<{ audioUrl: string }, Error, void>({
    mutationFn: async () => {
      const res = await fetch("/api/phrase-audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: sentenceText }),
      });
      if (!res.ok) throw new Error("TTS failed");
      return res.json();
    },
  });

  useEffect(() => {
    if (enabled && !mutation.data && !mutation.isPending && !mutation.isError) {
      mutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return mutation;
}

// ─── Audio comparison block ───────────────────────────────────────────────────

export function AudioComparison({
  learnerAudioUrl,
  sentenceText,
}: {
  learnerAudioUrl: string | null;
  sentenceText: string;
}) {
  const tts = useTtsAudio(sentenceText, true);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="audio-comparison">
      <div className="bg-muted/30 rounded-xl border border-border/50 p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Mic className="w-3.5 h-3.5" />
          Your recording
        </div>
        {learnerAudioUrl ? (
          <audio
            src={learnerAudioUrl}
            controls
            className="w-full h-9"
            preload="auto"
            playsInline
            data-testid="learner-audio-player"
          />
        ) : (
          <p className="text-xs text-muted-foreground">Audio unavailable</p>
        )}
      </div>

      <div className="bg-muted/30 rounded-xl border border-border/50 p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Volume2 className="w-3.5 h-3.5" />
          Reference (AI)
        </div>
        {tts.isPending ? (
          <div className="flex items-center gap-2 h-9 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Generating…
          </div>
        ) : tts.data?.audioUrl ? (
          <audio
            src={tts.data.audioUrl}
            controls
            className="w-full h-9"
            preload="auto"
            playsInline
            data-testid="reference-audio-player"
          />
        ) : (
          <p className="text-xs text-muted-foreground">Unavailable</p>
        )}
      </div>
    </div>
  );
}

// ─── Shared display component ────────────────────────────────────────────────

export function AIFeedbackRatings({
  feedback,
  sentenceText,
  recordingId,
  showHeader = false,
}: {
  feedback: AiFeedbackItem;
  sentenceText: string;
  recordingId: number;
  showHeader?: boolean;
}) {
  const { data: errors = [] } = useAllErrors();
  const pinyinData = useMemo(
    (): PinyinChar[] => getCharPinyin(sentenceText).filter(p => p.py !== ""),
    [sentenceText],
  );
  const ratings = feedback.characterRatings ?? [];
  const overallScore = feedback.overallScore ?? null;

  return (
    <div className="space-y-3" data-testid="ai-feedback-ratings">
      {showHeader && (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">AI Review</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium">Auto</Badge>
            </div>
            {overallScore !== null && (
              <span
                className={`text-2xl font-bold ${getScoreTextColor(overallScore)}`}
                data-testid="inline-overall-score"
              >
                {overallScore}%
              </span>
            )}
          </div>
        </div>
      )}
      {ratings.length > 0 && (
        <AICharacterRatingDisplay
          ratings={ratings}
          pinyinData={pinyinData}
          fluencyScore={feedback.fluencyScore}
          speechSuperScores={feedback.speechSuperScores ?? undefined}
          errors={errors}
          recordingId={recordingId}
        />
      )}
    </div>
  );
}

// ─── Polling wrapper (Record page) ───────────────────────────────────────────

export function RecordingFeedback({
  recordingId,
  sentenceText,
  onPracticeAgain,
}: {
  recordingId: number;
  sentenceText: string;
  onPracticeAgain: () => void;
}) {
  const [timedOut, setTimedOut] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [pollEnabled, setPollEnabled] = useState(true);

  // Restart 10 s timeout each time the user retries (retryCount changes)
  useEffect(() => {
    setTimedOut(false);
    const timer = setTimeout(() => setTimedOut(true), 10_000);
    return () => clearTimeout(timer);
  }, [retryCount]);

  const { data: recording, isLoading, refetch, isFetching } = useQuery<RecordingResponse>({
    queryKey: [api.recordings.get.path, recordingId],
    queryFn: async () => {
      const url = buildUrl(api.recordings.get.path, { id: recordingId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch recording");
      return res.json() as Promise<RecordingResponse>;
    },
    refetchInterval: pollEnabled && !timedOut ? 2000 : false,
    staleTime: 0,
  });

  const aiFeedback = recording?.feedback?.find(f => f.isAiFeedback);

  useEffect(() => {
    if (aiFeedback) setPollEnabled(false);
  }, [aiFeedback]);

  const isPending = !aiFeedback && recording?.status !== "reviewed";

  const pinyinData = useMemo(
    (): PinyinChar[] => getCharPinyin(sentenceText).filter(p => p.py !== ""),
    [sentenceText],
  );

  // ── Loading / pending state ─────────────────────────────────────────────

  if (isLoading || (isPending && !timedOut)) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="feedback-loading">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-base font-medium">Analysing your pronunciation...</p>
        </div>
        <p className="text-sm text-muted-foreground">This usually takes a few seconds</p>
      </div>
    );
  }

  // ── Timeout / no feedback state ─────────────────────────────────────────

  if (timedOut && !aiFeedback) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center" data-testid="feedback-timeout">
        <p className="text-base font-medium">Feedback is still processing</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          It's taking longer than expected. You can retry or check your recordings later.
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          <Button
            variant="outline"
            onClick={() => {
              setPollEnabled(true);
              setRetryCount(c => c + 1);
              refetch();
            }}
            disabled={isFetching}
            className="gap-2"
            data-testid="retry-feedback-btn"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Checking…" : "Retry"}
          </Button>
          <Button variant="outline" onClick={onPracticeAgain} className="gap-2" data-testid="practice-again-timeout-btn">
            <RotateCcw className="w-4 h-4" />
            Practice again
          </Button>
          <Link href={`/recordings/${recordingId}`}>
            <Button variant="ghost" className="gap-2 text-muted-foreground" data-testid="view-details-timeout-btn">
              View details
              <ExternalLink className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Feedback ready state ────────────────────────────────────────────────

  if (!aiFeedback) return null;

  return (
    <div className="space-y-5" data-testid="recording-feedback-panel">
      {/* Sentence header */}
      <div data-testid="feedback-sentence-header">
        {pinyinData.length > 0 ? (
          <SandhiPhraseDisplay pinyinChars={pinyinData} charSize="text-2xl" pinyinSize="text-sm" />
        ) : (
          <p className="text-2xl font-display font-bold text-foreground">{sentenceText}</p>
        )}
      </div>

      {/* Audio comparison */}
      <AudioComparison
        learnerAudioUrl={recording?.audioUrl ?? null}
        sentenceText={sentenceText}
      />

      {/* AI score + character breakdown */}
      <AIFeedbackRatings
        feedback={aiFeedback}
        sentenceText={sentenceText}
        recordingId={recordingId}
        showHeader
      />

      <div className="flex gap-3 pt-2 flex-wrap">
        <Button
          onClick={onPracticeAgain}
          variant="outline"
          className="gap-2 flex-1 sm:flex-none"
          data-testid="practice-again-btn"
        >
          <RotateCcw className="w-4 h-4" />
          Practice again
        </Button>
        <Link href={`/recordings/${recordingId}`}>
          <Button
            variant="ghost"
            className="gap-2 text-muted-foreground hover:text-foreground"
            data-testid="view-full-details-btn"
          >
            View full details
            <ExternalLink className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
