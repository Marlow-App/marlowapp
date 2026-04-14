import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { BookOpen, Trash2, Volume2, ChevronDown, ChevronUp, ExternalLink, Mic2, Loader2 } from "lucide-react";
import { pinyin } from "pinyin-pro";
import { useState } from "react";
import { getPracticeWordTranslation } from "@/lib/practiceWordTranslations";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { type PronunciationError, type PracticeListItem } from "@shared/schema";
import { AudioRecorder } from "@/components/AudioRecorder";
import { useUpload } from "@/hooks/use-upload";
import { useCreateRecording } from "@/hooks/use-recordings";
import { usePhraseAudio } from "@/hooks/use-phrase-audio";

type PracticeItem = PracticeListItem & { error: PronunciationError; sentenceText?: string };

const CATEGORY_COLORS: Record<string, string> = {
  tone: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
  initial: "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300",
  final: "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300",
};

const CATEGORY_LABELS: Record<string, string> = {
  tone: "Tone",
  initial: "Initial",
  final: "Final",
};

function getDailyWords(words: string[], count = 3): string[] {
  if (!words || words.length === 0) return [];
  if (words.length <= count) return words;
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const seed = dayOfYear + today.getFullYear() * 366;
  const shuffled = [...words];
  let h = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    h = ((h * 1103515245) + 12345) & 0x7fffffff;
    const j = h % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

function PracticeCard({
  item,
  onRemove,
  onRecordWord,
  playPhrase,
  isPhraseLoading,
  anyLoading,
}: {
  item: PracticeItem;
  onRemove: () => void;
  onRecordWord: (word: string) => void;
  playPhrase: (text: string) => void;
  isPhraseLoading: (text: string) => boolean;
  anyLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { error } = item;
  const categoryColor = CATEGORY_COLORS[error.category] ?? "";
  const categoryLabel = CATEGORY_LABELS[error.category] ?? error.category;

  const displayChar = error.practiceWords?.[0] || null;
  const charPinyin = displayChar ? pinyin(displayChar, { toneType: "symbol", type: "string" }) : null;

  return (
    <Card className="border border-border/60 shadow-sm" data-testid={`practice-card-${item.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Character display */}
          {displayChar && (
            <div className="flex flex-col items-center shrink-0 bg-muted/30 rounded-lg px-3 py-2 min-w-[52px]">
              {charPinyin && (
                <span className="text-xs text-muted-foreground font-medium">{charPinyin}</span>
              )}
              <span className="text-2xl font-bold leading-tight">{displayChar}</span>
              <button
                type="button"
                onClick={() => playPhrase(displayChar)}
                disabled={anyLoading}
                className="mt-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                aria-label={`Pronounce ${displayChar}`}
                data-testid={`speak-char-${item.id}`}
              >
                {isPhraseLoading(displayChar) ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}

          {/* Error info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${categoryColor}`}>{categoryLabel}</span>
              <span className="text-xs font-mono text-muted-foreground">{error.id}</span>
            </div>
            <p className="font-semibold text-[19px] leading-snug">{error.commonError}</p>

            {item.recordingId && item.sentenceText && (
              <Link href={`/recordings/${item.recordingId}`}>
                <p className="text-base font-medium text-primary hover:underline mt-1 flex items-center gap-1" data-testid={`sentence-link-${item.id}`}>
                  {item.sentenceText}
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </p>
              </Link>
            )}

            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs text-muted-foreground">
                Saved {formatDistanceToNow(new Date(item.addedAt), { addSuffix: true })}
              </span>
            </div>

            {error.simpleExplanation && (
              <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                data-testid={`expand-${item.id}`}
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {expanded ? "Less" : "Details"}
              </button>
            )}

            {expanded && (
              <div className="mt-3 space-y-3">
                {error.simpleExplanation && (
                  <div>
                    <p className="text-[12px] font-black uppercase tracking-widest text-primary mb-1">What's happening</p>
                    <p className="text-base text-foreground/80 whitespace-pre-wrap leading-relaxed">{error.simpleExplanation}</p>
                  </div>
                )}
                {error.howToFix && (
                  <div>
                    <p className="text-[12px] font-black uppercase tracking-widest text-primary mb-1">How to fix it</p>
                    <p className="text-base text-foreground/80 whitespace-pre-wrap leading-relaxed">{error.howToFix}</p>
                  </div>
                )}
                {error.practiceWords && error.practiceWords.length > 0 && (
                  <div>
                    <p className="text-[12px] font-black uppercase tracking-widest text-primary mb-2">Practice words</p>
                    <div className="flex flex-wrap gap-2">
                      {getDailyWords(error.practiceWords).map((word, i) => {
                        const py = (error.id === "T005" && word === "东西")
                          ? "dōng xi"
                          : pinyin(word, { toneType: "symbol", type: "string" });
                        return (
                          <div key={i} className="flex flex-col items-center bg-muted/30 rounded-lg px-3 py-2 min-w-[52px] shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-150">
                            <span className="text-sm text-muted-foreground">{py}</span>
                            <span className="text-lg font-bold">{word}</span>
                            {getPracticeWordTranslation(word) && (
                              <span className="text-[11px] text-muted-foreground/70 mt-0.5 text-center leading-tight">{getPracticeWordTranslation(word)}</span>
                            )}
                            <div className="flex items-center gap-1.5 mt-1">
                              <button
                                type="button"
                                onClick={() => playPhrase(word)}
                                disabled={anyLoading}
                                className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                                data-testid={`speak-word-${item.id}-${i}`}
                                aria-label={`Hear ${word}`}
                              >
                                {isPhraseLoading(word) ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Volume2 className="w-3 h-3" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => onRecordWord(word)}
                                className="text-muted-foreground hover:text-primary transition-colors"
                                data-testid={`record-word-${item.id}-${i}`}
                                aria-label={`Record ${word}`}
                              >
                                <Mic2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Remove button */}
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1"
            aria-label="Remove from practice list"
            data-testid={`remove-${item.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PracticeList() {
  const { toast } = useToast();
  const { data: items = [], isLoading } = useQuery<PracticeItem[]>({
    queryKey: ["/api/practice-list"],
  });
  const [activeRecordWord, setActiveRecordWord] = useState<string | null>(null);
  const { uploadFile, isUploading } = useUpload();
  const createRecording = useCreateRecording();
  const { playPhrase, isLoading: isPhraseLoading, anyLoading } = usePhraseAudio();

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/practice-list/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/practice-list"] });
      toast({ title: "Removed", description: "Item removed from your practice list." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove item.", variant: "destructive" });
    },
  });

  const handleRecordingComplete = async (file: File) => {
    if (!activeRecordWord) return;
    try {
      const uploadRes = await uploadFile(file);
      if (!uploadRes) throw new Error("Upload failed");
      await createRecording.mutateAsync({
        audioUrl: uploadRes.objectPath,
        sentenceText: activeRecordWord,
      });
      toast({ title: "Submitted!", description: "Your recording has been submitted for review." });
      setActiveRecordWord(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to submit recording.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const wordPinyin = activeRecordWord
    ? pinyin(activeRecordWord, { toneType: "symbol", type: "string" })
    : "";

  const grouped = {
    tone: items.filter(i => i.error.category === "tone"),
    initial: items.filter(i => i.error.category === "initial"),
    final: items.filter(i => i.error.category === "final"),
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-display font-bold">Practice List</h1>
            <p className="text-sm text-muted-foreground">Errors saved from your feedback for focused study</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground" data-testid="practice-list-empty">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium text-base mb-1">Your practice list is empty</p>
            <p className="text-sm max-w-xs mx-auto">
              When a reviewer links an error to your recording, tap the error badge to view details and save it here.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {(["tone", "initial", "final"] as const).map(cat => {
              const catItems = grouped[cat];
              if (catItems.length === 0) return null;
              return (
                <section key={cat}>
                  <h2 className={`text-xs font-black uppercase tracking-widest mb-3 ${
                    cat === "tone" ? "text-blue-600 dark:text-blue-400" :
                    cat === "initial" ? "text-violet-600 dark:text-violet-400" :
                    "text-orange-600 dark:text-orange-400"
                  }`}>
                    {CATEGORY_LABELS[cat]} errors · {catItems.length}
                  </h2>
                  <div className="space-y-3">
                    {catItems.map(item => (
                      <PracticeCard
                        key={item.id}
                        item={item}
                        onRemove={() => removeMutation.mutate(item.id)}
                        onRecordWord={setActiveRecordWord}
                        playPhrase={playPhrase}
                        isPhraseLoading={isPhraseLoading}
                        anyLoading={anyLoading}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <Drawer open={!!activeRecordWord} onOpenChange={open => { if (!open) setActiveRecordWord(null); }}>
        <DrawerContent className="md:left-1/4 md:right-1/4 md:rounded-[10px]" data-testid="practice-word-recording-drawer">
          <DrawerHeader className="text-center px-8 pt-6">
            <DrawerTitle>Record Practice Word</DrawerTitle>
            {activeRecordWord && (
              <>
                <DrawerDescription>{wordPinyin}</DrawerDescription>
                <p className="text-4xl font-bold mt-2 font-display">{activeRecordWord}</p>
                {getPracticeWordTranslation(activeRecordWord) && (
                  <p className="text-base text-muted-foreground mt-1">{getPracticeWordTranslation(activeRecordWord)}</p>
                )}
              </>
            )}
          </DrawerHeader>
          <div className="px-8 pb-8">
            <AudioRecorder
              onRecordingComplete={handleRecordingComplete}
              isUploading={isUploading || createRecording.isPending}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </Layout>
  );
}
