import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { AudioRecorder } from "@/components/AudioRecorder";
import { useUpload } from "@/hooks/use-upload";
import { useCreateRecording } from "@/hooks/use-recordings";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from "wouter";
import { ChevronLeft, Info, X, Loader2, Volume2 } from "lucide-react";
import { RecordingFeedback } from "@/components/RecordingFeedback";
import { getPhrasesForLevel, phraseToText, toToneChars, PHRASE_BANK, type Phrase } from "@/data/phrases";
import { SandhiPhraseDisplay } from "@/components/SandhiPhraseDisplay";
import { useAuth } from "@/hooks/use-auth";
import { countChineseChars, MAX_CHARS } from "@shared/credits";
import { usePhraseAudio } from "@/hooks/use-phrase-audio";
import { UpsellModal } from "@/components/UpsellModal";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

function CompactPhraseChip({ phrase, onSelect, isSelected, onPlay, isLoadingPhrase, anyLoading }: {
  phrase: Phrase;
  onSelect: (phrase: Phrase) => void;
  isSelected: boolean;
  onPlay: (text: string) => void;
  isLoadingPhrase: (text: string) => boolean;
  anyLoading: boolean;
}) {
  const text = phraseToText(phrase);

  const handlePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onPlay(text);
  }, [text, onPlay]);

  return (
    <div
      onClick={() => onSelect(phrase)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(phrase); }}
      className={`shrink-0 text-left px-3 py-2.5 rounded-xl border-2 transition-all duration-200 min-w-[160px] cursor-pointer ${
        isSelected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border/60 bg-card hover:border-primary/40 hover:shadow-sm"
      }`}
      data-testid={`phrase-card-${text.slice(0, 4)}`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex-1 min-w-0">
          <div className="whitespace-nowrap">
            <SandhiPhraseDisplay characters={phrase.characters} charSize="text-lg" pinyinSize="text-sm" />
          </div>
          <p className="text-[15px] text-muted-foreground mt-0.5 whitespace-nowrap overflow-x-auto scrollbar-none">{phrase.english}</p>
        </div>
        <div className="flex flex-col gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handlePlay}
            disabled={anyLoading}
            className="flex items-center justify-center gap-0.5 w-8 h-7 rounded text-[13px] font-bold text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors"
            data-testid="phrase-speak-btn"
          >
            {isLoadingPhrase(text) ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScrollRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin"
      style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}
    >
      {children}
    </div>
  );
}

export default function RecordPage() {
  const [text, setText] = useState("");
  const { uploadFile, isUploading } = useUpload();
  const createRecording = useCreateRecording();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedPhrase, setSelectedPhrase] = useState<Phrase | null>(null);
  const { playPhrase, isLoading: isPhraseLoading, anyLoading } = usePhraseAudio();
  const { user } = useAuth();
  const userLevel = user?.chineseLevel || "Beginner";

  const [rerecordOf, setRerecordOf] = useState<number | null>(null);
  const [feedbackRecordingId, setFeedbackRecordingId] = useState<number | null>(null);
  const [feedbackSentenceText, setFeedbackSentenceText] = useState<string>("");
  const [showUpsell, setShowUpsell] = useState(false);

  const dailyPhrases = getPhrasesForLevel(userLevel, 10);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const phraseParam = params.get("phrase");
    const rerecordOfParam = params.get("rerecordOf");
    const sentenceTextParam = params.get("sentenceText");
    const feedbackIdParam = params.get("feedbackId");

    if (feedbackIdParam && sentenceTextParam) {
      const id = parseInt(feedbackIdParam);
      if (!isNaN(id)) {
        setFeedbackSentenceText(sentenceTextParam);
        setFeedbackRecordingId(id);
        return;
      }
    }

    if (rerecordOfParam && sentenceTextParam) {
      const id = parseInt(rerecordOfParam);
      if (!isNaN(id)) {
        setRerecordOf(id);
        setText(sentenceTextParam);
        return;
      }
    }

    if (phraseParam) {
      const matchedPhrase = PHRASE_BANK.find(p => phraseToText(p) === phraseParam);
      if (matchedPhrase) {
        setSelectedPhrase(matchedPhrase);
        setText(phraseParam);
      } else {
        setText(phraseParam);
      }
    }
  }, []);

  const rows = [
    dailyPhrases.slice(0, 4),
    dailyPhrases.slice(4, 7),
    dailyPhrases.slice(7, 10),
  ];

  const handleSelectPhrase = (phrase: Phrase) => {
    const fullText = phraseToText(phrase);
    setText(fullText);
    setSelectedPhrase(phrase);
  };

  const handleClearPhrase = () => {
    setSelectedPhrase(null);
    setText("");
  };

  const activeText = rerecordOf ? text : (selectedPhrase ? phraseToText(selectedPhrase) : text);
  const typedToneChars = useMemo(() => (!selectedPhrase && text.trim()) ? toToneChars(text.trim()) : [], [text, selectedPhrase]);
  const charCost = countChineseChars(activeText);
  const tooLong = charCost > MAX_CHARS;

  const { data: ttsData } = useQuery<{ audioUrl: string }>({
    queryKey: ["/api/phrase-audio/generate", activeText],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/phrase-audio/generate", { text: activeText, gender: "F" });
      return res.json();
    },
    enabled: !!activeText.trim() && !tooLong,
    staleTime: Infinity,
    retry: false,
  });

  const handleRecordingComplete = async (file: File) => {
    if (!activeText.trim()) {
      toast({
        title: "Sentence Required",
        description: "Please enter or select a sentence before recording.",
        variant: "destructive",
      });
      return;
    }

    if (tooLong) {
      toast({
        title: "Too many characters",
        description: `Maximum ${MAX_CHARS} Chinese characters per recording.`,
        variant: "destructive",
      });
      return;
    }

    try {
      const uploadRes = await uploadFile(file);
      if (!uploadRes) throw new Error("Upload failed");

      const newRecording = await createRecording.mutateAsync({
        audioUrl: uploadRes.objectPath,
        sentenceText: activeText,
        ...(rerecordOf ? { rerecordOf } : {}),
      });

      setFeedbackSentenceText(activeText);
      setFeedbackRecordingId(newRecording.id);
    } catch (error: any) {
      const msg = error?.message || "";
      if (msg.startsWith("429:") || msg.includes("DAILY_LIMIT")) {
        setShowUpsell(true);
        return;
      }
      const errorMsg = error instanceof Error ? error.message : "Failed to submit recording. Please try again.";
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const handlePracticeAgain = () => {
    setFeedbackRecordingId(null);
    setFeedbackSentenceText("");
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-3 animate-in">
        <div className="space-y-4">
          <div className="flex items-center gap-1">
            {feedbackRecordingId !== null ? (
              <button onClick={handlePracticeAgain} className="p-1 -ml-1 rounded-md hover:bg-muted transition-colors" data-testid="back-to-record-btn">
                <ChevronLeft className="w-9 h-9 text-foreground" strokeWidth={3} />
              </button>
            ) : (
              <button onClick={() => window.history.back()} className="p-1 -ml-1 rounded-md hover:bg-muted transition-colors" data-testid="back-btn">
                <ChevronLeft className="w-9 h-9 text-foreground" strokeWidth={3} />
              </button>
            )}
            <h1 className="text-3xl font-bold font-display">
              {feedbackRecordingId !== null ? "Your Results" : rerecordOf ? "Re-record" : "New Recording"}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/profile?highlight=chineseLevel">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full border-primary/30 hover:border-primary/60 hover:bg-primary/5 text-base font-semibold px-5"
                data-testid="level-btn"
              >
                {userLevel} ✎
              </Button>
            </Link>
          </div>
        </div>

        {feedbackRecordingId !== null ? (
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-5">
              <RecordingFeedback
                recordingId={feedbackRecordingId}
                sentenceText={feedbackSentenceText}
                onPracticeAgain={handlePracticeAgain}
              />
            </CardContent>
          </Card>
        ) : (
        <>
        {rerecordOf && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-primary/5 border-primary/20 text-primary text-sm font-medium" data-testid="rerecord-banner">
            Re-recording — your new attempt will be compared to your original.
          </div>
        )}

        <div className="space-y-4">
          {!rerecordOf && <div className="space-y-3">
            <div className="space-y-2">
              <div>
                <h2 className="text-base font-semibold">{userLevel} Phrases</h2>
                <p className="text-sm text-muted-foreground">Scroll to browse, tap to select</p>
              </div>
              <div className="flex gap-3 items-center text-sm text-muted-foreground">
                <span className="font-medium">Tones by Color</span>
                <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>1st
                <span className="inline-block w-3 h-3 rounded-full bg-yellow-500"></span>2nd
                <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>3rd
                <span className="inline-block w-3 h-3 rounded-full bg-blue-500"></span>4th
              </div>
            </div>
            <p className="text-sm text-muted-foreground/70 -mt-1">
              Sample readings currently generated by text-to-speech, so tones may be slightly incorrect.{" "}
              <a href="https://youtu.be/eIP8yVcDZRI?si=yfL6BcmhWmtz7GVv" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80 transition-colors">Click here</a> to watch how tones change in context.
            </p>

            <div className="space-y-2" data-testid="phrase-list">
              {rows.map((row, ri) => (
                <ScrollRow key={ri}>
                  {row.map((phrase, i) => (
                    <CompactPhraseChip
                      key={ri * 4 + i}
                      phrase={phrase}
                      onSelect={handleSelectPhrase}
                      isSelected={selectedPhrase === phrase}
                      onPlay={playPhrase}
                      isLoadingPhrase={isPhraseLoading}
                      anyLoading={anyLoading}
                    />
                  ))}
                </ScrollRow>
              ))}
            </div>
          </div>}

          {!rerecordOf && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Or type your own sentence
            </label>
            <div className="relative">
              <Input
                placeholder={`Type Chinese here (max ${MAX_CHARS} characters)...`}
                className="text-base bg-muted/20 focus:bg-background transition-colors pr-16"
                value={selectedPhrase ? "" : text}
                onChange={(e) => {
                  if (e.target.value.length <= 40) {
                    setText(e.target.value);
                    setSelectedPhrase(null);
                  }
                }}
                maxLength={40}
                disabled={!!selectedPhrase}
                data-testid="sentence-input"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums">
                {selectedPhrase ? "" : `${text.length}/40`}
              </span>
            </div>
          </div>
          )}

          {(selectedPhrase || text.trim()) && (
            <Card className={`border-primary/30 bg-primary/5 shadow-sm sticky top-0 z-10 ${tooLong ? "border-destructive/50 bg-destructive/5" : ""}`} data-testid="active-phrase-display">
              <CardContent className="py-5 px-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-2">Recording</p>
                    {selectedPhrase ? (
                      <div>
                        <SandhiPhraseDisplay characters={selectedPhrase.characters} charSize="text-3xl" pinyinSize="text-base" />
                        <p className="text-base text-muted-foreground mt-2">{selectedPhrase.english}</p>
                      </div>
                    ) : typedToneChars.length > 0 ? (
                      <SandhiPhraseDisplay characters={typedToneChars} charSize="text-3xl" pinyinSize="text-base" />
                    ) : (
                      <p className="text-2xl font-medium text-foreground">{text}</p>
                    )}

                    {tooLong && (
                      <div className="mt-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                          {charCost} chars — max {MAX_CHARS}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedPhrase && (
                      <div className="flex items-center gap-0.5" data-testid="active-phrase-play-btns">
                        <button
                          onClick={() => playPhrase(phraseToText(selectedPhrase))}
                          disabled={anyLoading}
                          className="flex items-center gap-1 px-3 py-2 rounded-full hover:bg-primary/10 text-primary/70 hover:text-primary transition-colors text-[16px] font-bold"
                          data-testid="active-phrase-speak-btn"
                        >
                          {isPhraseLoading(phraseToText(selectedPhrase)) ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Volume2 className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    )}
                    <button
                      onClick={handleClearPhrase}
                      className="p-2 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      data-testid="clear-phrase-btn"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-muted/30 p-3 border-b border-border/50 flex gap-2 items-center">
                <Info className="w-4 h-4 text-primary shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Speak naturally and clearly with your microphone close. You'll get instant AI pronunciation feedback.
                </p>
              </div>
              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                isUploading={isUploading || createRecording.isPending}
                referenceAudioUrl={ttsData?.audioUrl}
              />
            </CardContent>
          </Card>
        </div>
        </>
        )}
      </div>

      <UpsellModal
        open={showUpsell}
        onClose={() => setShowUpsell(false)}
        reason="recordings"
      />
    </Layout>
  );
}
