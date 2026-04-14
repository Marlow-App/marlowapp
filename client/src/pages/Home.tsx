import { useState, useRef, useEffect } from "react";
import { getScoreBgColor, getScoreTextColor } from "@/lib/scoreColor";
import { useAuth } from "@/hooks/use-auth";
import { useRecordings, useCreateRecording } from "@/hooks/use-recordings";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { useTourSpotlight } from "@/contexts/TourSpotlightContext";
import { AudioRecorder } from "@/components/AudioRecorder";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Link, useLocation } from "wouter";
import {
  Mic2, PlayCircle, UserCircle, Zap, Loader2, X,
  Compass, BookOpen, Volume2, ChevronRight, Flame, CheckCircle2,
} from "lucide-react";
import {
  format, formatDistanceToNow, startOfWeek, addDays,
  isSameDay, isBefore, startOfDay,
} from "date-fns";
import { getDailyChallenge, phraseToText, getPhraseEnglish } from "@/data/phrases";
import { SandhiPhraseDisplay } from "@/components/SandhiPhraseDisplay";
import { usePhraseAudio } from "@/hooks/use-phrase-audio";
import { useQuery } from "@tanstack/react-query";
import { pinyin } from "pinyin-pro";
import { getPracticeWordTranslation } from "@/lib/practiceWordTranslations";
import { type PronunciationError, type PracticeListItem } from "@shared/schema";
import { ErrorDetailDialog } from "@/components/AIFeedbackDisplay";

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

function getDailyPracticeItem(items: PracticeItem[]): PracticeItem | null {
  if (!items.length) return null;
  const today = new Date();
  const seed = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000) + today.getFullYear() * 366;
  return items[seed % items.length];
}

function getDailyWord(words: string[]): string | null {
  if (!words?.length) return null;
  const today = new Date();
  const seed = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  return words[seed % words.length];
}

function calculateStreak(recordings: any[]): number {
  if (!recordings.length) return 0;
  const recordingDays = new Set(
    recordings.map(r => format(new Date(r.createdAt), "yyyy-MM-dd"))
  );
  const today = startOfDay(new Date());
  const todayKey = format(today, "yyyy-MM-dd");
  // If today has no recording, check if yesterday does (streak still alive today)
  let cursor = recordingDays.has(todayKey) ? today : addDays(today, -1);
  if (!recordingDays.has(format(cursor, "yyyy-MM-dd"))) return 0;
  let count = 0;
  while (recordingDays.has(format(cursor, "yyyy-MM-dd"))) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function useAppTour() {
  const [showTour, setShowTour] = useState(() => !localStorage.getItem("appTourSeen"));
  const dismissTour = () => { localStorage.setItem("appTourSeen", "1"); setShowTour(false); };
  return { showTour, dismissTour };
}

function AppTourBanner({ onDismiss }: { onDismiss: () => void }) {
  const { setSpotlightHref, openMobileMenu } = useTourSpotlight();
  const clickedHref = useRef<string | null>(null);
  useEffect(() => { return () => setSpotlightHref(null); }, [setSpotlightHref]);

  const tourItems = [
    { href: "/record", icon: Mic2, label: "Record New", desc: "Record yourself speaking Chinese phrases and get instant AI feedback." },
    { href: "/learner-portal", icon: PlayCircle, label: "My Progress", desc: "Track your recordings and review your AI pronunciation scores." },
    { href: "/practice-list", icon: BookOpen, label: "Practice List", desc: "Review your saved errors and drill the sounds you find most challenging." },
    { href: "/profile", icon: UserCircle, label: "Profile", desc: "Set your Chinese level, manage your credits, and customize your experience." },
  ];

  return (
    <Card className="border-border bg-muted/60" data-testid="app-tour-banner">
      <CardContent className="pt-4 pb-4 md:pt-6 md:pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Compass className="w-6 h-6 md:w-8 md:h-8 text-primary" />
            </div>
            <div className="space-y-3 md:space-y-4">
              <div>
                <h3 className="font-semibold text-2xl md:text-3xl font-display">Welcome to Marlow!</h3>
                <p className="text-base text-muted-foreground mt-1">Here's a quick look at what you can do:</p>
              </div>
              <ul className="space-y-1 md:space-y-2">
                {tourItems.map(({ href, icon: Icon, label, desc }) => (
                  <li
                    key={href}
                    className="flex items-start gap-2 md:gap-3 cursor-pointer rounded-lg px-2 py-1 -mx-2 md:px-3 md:py-2 md:-mx-3 transition-colors hover:bg-primary/5"
                    onMouseEnter={() => setSpotlightHref(href)}
                    onMouseLeave={() => setSpotlightHref(clickedHref.current)}
                    onClick={() => { clickedHref.current = href; openMobileMenu(); setSpotlightHref(href); }}
                    data-testid={`tour-item-${label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Icon className="w-4 h-4 md:w-6 md:h-6 text-primary mt-0.5 shrink-0" />
                    <span className="text-base md:text-lg"><strong>{label}</strong> — {desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <button onClick={onDismiss} className="p-1 rounded-full hover:bg-primary/10 transition-colors shrink-0" data-testid="tour-dismiss-btn">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function WeekCalendarStrip({
  recordings,
  selectedDate,
  onSelectDate,
}: {
  recordings: any[];
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
}) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 3));

  const daysWithRecordings = new Set(
    recordings.map(r => format(new Date(r.createdAt), "yyyy-MM-dd"))
  );

  return (
    <div className="flex justify-between items-center gap-1" data-testid="week-calendar-strip">
      {days.map(day => {
        const dateKey = format(day, "yyyy-MM-dd");
        const isToday = isSameDay(day, today);
        const isPast = isBefore(day, today) || isToday;
        const hasRecordings = daysWithRecordings.has(dateKey);
        const isSelected = selectedDate !== null && isSameDay(day, selectedDate);
        const isFuture = !isPast;

        return (
          <button
            key={dateKey}
            type="button"
            onClick={() => {
              if (isFuture) return;
              onSelectDate(isSelected ? null : day);
            }}
            disabled={isFuture}
            className={`
              flex flex-col items-center gap-0.5 rounded-2xl py-2.5 px-1.5 flex-1 transition-all duration-200
              ${isSelected ? "bg-primary text-primary-foreground shadow-lg scale-105" : ""}
              ${!isSelected && isToday ? "bg-primary/10 ring-2 ring-primary/30" : ""}
              ${!isSelected && !isToday && isPast && hasRecordings ? "hover:bg-primary/15 cursor-pointer" : ""}
              ${!isSelected && !isToday && isPast && !hasRecordings ? "hover:bg-primary/10 cursor-pointer" : ""}
              ${isFuture ? "opacity-25 cursor-default" : ""}
            `}
            data-testid={`calendar-day-${dateKey}`}
          >
            <span className={`text-[10px] font-semibold uppercase tracking-widest leading-none ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
              {format(day, "EEE").slice(0, 2)}
            </span>
            <span className={`text-lg font-bold leading-tight ${isSelected ? "text-primary-foreground" : isToday ? "text-primary" : ""}`}>
              {format(day, "d")}
            </span>
            <div className="h-2 flex items-center justify-center">
              {hasRecordings ? (
                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-primary-foreground/80" : "bg-primary"}`} />
              ) : (
                <span className="w-1.5 h-1.5" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

const DAY_RECORDING_CAP = 5;

function DayRecordingsPanel({ date, recordings }: { date: Date; recordings: any[] }) {
  const dayRecordings = recordings.filter(r => isSameDay(new Date(r.createdAt), date));
  const capped = dayRecordings.slice(0, DAY_RECORDING_CAP);
  const hasMore = dayRecordings.length > DAY_RECORDING_CAP;
  const dateParam = format(date, "yyyy-MM-dd");

  return (
    <div className="animate-in slide-in-from-top-2 duration-300" data-testid="day-recordings-panel">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {format(date, "EEEE, MMMM d")}
        </p>
        <span className="text-xs text-muted-foreground">{dayRecordings.length} recording{dayRecordings.length !== 1 ? "s" : ""}</span>
      </div>
      {dayRecordings.length === 0 ? (
        <div className="text-center py-6 bg-muted/20 rounded-2xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No recordings on this day</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {capped.map(recording => {
              const score = recording.feedback?.[0]?.overallScore;
              return (
                <Link key={recording.id} href={`/recordings/${recording.id}`} className="block">
                  <div className="flex items-center gap-3 bg-card border border-border/60 rounded-xl px-4 py-3.5 hover:shadow-md transition-all duration-200 cursor-pointer" data-testid={`day-recording-${recording.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-base truncate">{recording.sentenceText}</p>
                      {getPhraseEnglish(recording.sentenceText) && (
                        <p className="text-xs text-muted-foreground truncate">{getPhraseEnglish(recording.sentenceText)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {score != null && (
                        <span className={`text-sm font-bold ${getScoreTextColor(score)}`}>{score}%</span>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          {hasMore && (
            <Link href={`/learner-portal?date=${dateParam}`} className="block mt-3">
              <div className="flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-primary/30 text-primary text-sm font-medium hover:bg-primary/5 transition-colors cursor-pointer" data-testid="day-recordings-view-more">
                View all {dayRecordings.length} recordings →
              </div>
            </Link>
          )}
        </>
      )}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isReviewer = user?.role === "reviewer";
  const { data: recordings, isLoading } = useRecordings();
  const { data: practiceList } = useQuery<PracticeItem[]>({ queryKey: ["/api/practice-list"] });
  const { data: crosswordData } = useQuery<{
    wordCount: number;
    status: { isComplete: boolean } | null;
    title: string;
    puzzleIndex: number;
  }>({ queryKey: ["/api/crossword/today"] });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [practiceDialogItem, setPracticeDialogItem] = useState<PracticeItem | null>(null);
  const [practiceDialogRecordWord, setPracticeDialogRecordWord] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const { uploadFile, isUploading } = useUpload();
  const createRecording = useCreateRecording();
  const { playPhrase, isLoading: isPhraseLoading, anyLoading } = usePhraseAudio();
  const { showTour, dismissTour } = useAppTour();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const userLevel = user?.chineseLevel || "Beginner";
  const dailyChallenge = getDailyChallenge(userLevel);
  const challengeText = phraseToText(dailyChallenge);

  const handleRecordingComplete = async (file: File) => {
    try {
      const uploadRes = await uploadFile(file);
      if (!uploadRes) throw new Error("Upload failed");
      const newRecording = await createRecording.mutateAsync({
        audioUrl: uploadRes.objectPath,
        sentenceText: challengeText,
      });
      setDrawerOpen(false);
      navigate(`/record?feedbackId=${newRecording.id}&sentenceText=${encodeURIComponent(challengeText)}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to submit recording. Please try again.";
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
    }
  };

  if (isReviewer) {
    return (
      <Layout>
        <div className="space-y-8 animate-in">
          <header>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
              {format(new Date(), "EEEE, d MMMM yyyy")}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground font-display">
              {greeting}, {user?.firstName || "Reviewer"}
            </h1>
          </header>
          <section>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/reviewer-hub">
                <Button className="w-full justify-start h-16 text-lg" variant="outline">
                  <PlayCircle className="mr-3 h-6 w-6 text-primary" />
                  Start Reviewing
                </Button>
              </Link>
              <Link href="/profile">
                <Button className="w-full justify-start h-16 text-lg" variant="outline">
                  <UserCircle className="mr-3 h-6 w-6 text-primary" />
                  Manage Profile
                </Button>
              </Link>
            </div>
          </section>
        </div>
      </Layout>
    );
  }

  const allRecordings = recordings ?? [];
  const streak = calculateStreak(allRecordings);

  return (
    <Layout>
      <div className="space-y-6 animate-in">

        {/* Hero header */}
        <div className="relative rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 px-6 pt-6 pb-5 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary))_0%,transparent_60%)]" />
          <div className="relative">
            <p className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-widest mb-1" data-testid="home-date-label">
              {format(new Date(), "EEEE, d MMMM yyyy")}
            </p>
            <div className="flex items-start justify-between gap-4 mb-5">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground font-display leading-tight" data-testid="home-greeting">
                {greeting},<br />{user?.firstName || "Learner"}!
              </h1>
              <Link href="/record">
                <Button size="sm" className="rounded-full shadow-md shadow-primary/20 shrink-0 mt-1" data-testid="hero-record-btn">
                  <Mic2 className="mr-1.5 h-4 w-4" />
                  Record
                </Button>
              </Link>
            </div>

            {/* Streak badge */}
            {streak > 0 && (
              <div className="flex items-center gap-2 mb-4" data-testid="streak-badge">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                  streak >= 7
                    ? "bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800"
                    : "bg-primary/10 text-primary border border-primary/20"
                }`}>
                  <Flame className={`w-4 h-4 shrink-0 ${streak >= 7 ? "text-orange-500" : "text-primary"}`} />
                  <span data-testid="streak-count">{streak}-day streak</span>
                </div>
                {streak === 1 && (
                  <span className="text-xs text-muted-foreground">Keep going!</span>
                )}
                {streak >= 3 && streak < 7 && (
                  <span className="text-xs text-muted-foreground">You're on a roll!</span>
                )}
                {streak >= 7 && (
                  <span className="text-xs text-muted-foreground font-medium">🔥 Amazing streak!</span>
                )}
              </div>
            )}

            {/* Week calendar strip */}
            <WeekCalendarStrip
              recordings={allRecordings}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </div>
        </div>

        {/* Day recordings panel (slides in when a day is selected) */}
        {selectedDate && (
          <DayRecordingsPanel date={selectedDate} recordings={allRecordings} />
        )}

        {showTour && <AppTourBanner onDismiss={dismissTour} />}

        {/* Daily Challenge */}
        <section data-testid="daily-challenge-section">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-bold font-display">Daily Challenge</h2>
          </div>
          <Card className="bg-gradient-to-br from-primary/8 to-primary/3 border-primary/15 overflow-hidden" data-testid="daily-challenge-card">
            <CardContent className="p-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Link href="/profile?highlight=chineseLevel">
                      <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full cursor-pointer hover:bg-primary/20 transition-colors" data-testid="daily-challenge-level">
                        {dailyChallenge.level} ✎
                      </span>
                    </Link>
                    <button
                      onClick={() => playPhrase(challengeText)}
                      disabled={anyLoading}
                      className="flex items-center gap-1 p-1.5 rounded-full hover:bg-primary/10 text-primary/60 hover:text-primary transition-colors"
                      data-testid="daily-challenge-play-btn"
                    >
                      {isPhraseLoading(challengeText) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-full shadow-sm shrink-0"
                    data-testid="daily-challenge-record-btn"
                    onClick={() => setDrawerOpen(true)}
                  >
                    <Mic2 className="mr-1.5 h-4 w-4" />
                    Record This
                  </Button>
                </div>
                <div data-testid="daily-challenge-characters" className="overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
                  <SandhiPhraseDisplay characters={dailyChallenge.characters} charSize="text-2xl" pinyinSize="text-xs" />
                </div>
                <p className="text-sm text-muted-foreground" data-testid="daily-challenge-english">
                  {dailyChallenge.english}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Recording Drawer */}
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent className="md:left-[calc(25%+8rem)] md:right-[calc(25%-8rem)] md:rounded-[10px]" data-testid="recording-drawer">
            <DrawerHeader className="text-center px-8 pt-6">
              <DrawerTitle>Record Daily Challenge</DrawerTitle>
              <DrawerDescription>{dailyChallenge.english}</DrawerDescription>
              <div className="flex justify-center mt-3" data-testid="drawer-phrase-characters">
                <SandhiPhraseDisplay characters={dailyChallenge.characters} charSize="text-2xl" pinyinSize="text-sm" />
              </div>
            </DrawerHeader>
            <div className="px-8 pb-8">
              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                isUploading={isUploading || createRecording.isPending}
              />
            </div>
          </DrawerContent>
        </Drawer>

        {/* Practice Drill */}
        {(() => {
          const items = practiceList ?? [];
          const item = getDailyPracticeItem(items);
          if (!item) return null;
          const { error } = item;
          const practiceWord = getDailyWord(error.practiceWords ?? []);
          if (!practiceWord) return null;
          const wordPinyin = pinyin(practiceWord, { toneType: "symbol", type: "string" });
          const translation = getPracticeWordTranslation(practiceWord);
          const catColor = CATEGORY_COLORS[error.category] ?? "";
          const catLabel = CATEGORY_LABELS[error.category] ?? error.category;
          return (
            <section data-testid="practice-drill-section">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-primary" />
                <h2 className="text-lg font-bold font-display">Practice Drill</h2>
                <Link href="/practice-list" className="ml-auto text-sm text-primary font-medium hover:underline" data-testid="practice-drill-see-all">
                  See all →
                </Link>
              </div>
              <Card className="border-border/60" data-testid="practice-drill-card">
                <CardContent className="p-5">
                  <div className="flex items-start gap-5">
                    <div className="flex flex-col items-center shrink-0 bg-muted/40 rounded-2xl px-4 py-3 min-w-[72px]">
                      <span className="text-xs text-muted-foreground font-medium mb-0.5">{wordPinyin}</span>
                      <span className="text-3xl font-bold leading-tight">{practiceWord}</span>
                      <div className="flex items-center gap-3 mt-1.5">
                        <button
                          type="button"
                          onClick={() => playPhrase(practiceWord)}
                          disabled={anyLoading}
                          className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                          aria-label={`Pronounce ${practiceWord}`}
                          data-testid="practice-drill-speak-btn"
                        >
                          {isPhraseLoading(practiceWord) ? (
                            <Loader2 className="w-4 h-4 text-primary animate-spin" />
                          ) : (
                            <Volume2 className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setPracticeDialogRecordWord(practiceWord); setPracticeDialogItem(item); }}
                          className="text-muted-foreground hover:text-primary transition-colors"
                          aria-label={`Record ${practiceWord}`}
                          data-testid="practice-drill-record-btn"
                        >
                          <Mic2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${catColor}`}>{catLabel}</span>
                        <span className="text-xs font-mono text-muted-foreground">{error.id}</span>
                      </div>
                      <p className="font-semibold text-base leading-snug">{error.commonError}</p>
                      {translation && (
                        <p className="text-sm text-muted-foreground mt-0.5">"{translation}"</p>
                      )}
                      {error.simpleExplanation && (
                        <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{error.simpleExplanation}</p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 rounded-full"
                        onClick={() => setPracticeDialogItem(item)}
                        data-testid="practice-drill-go-btn"
                      >
                        Practice this error
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          );
        })()}

        {/* Daily Crossword Teaser */}
        <section data-testid="crossword-section">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🀄</span>
            <h2 className="text-lg font-bold font-display">Daily Crossword</h2>
          </div>
          <Link href="/crossword">
            <Card className="bg-gradient-to-br from-indigo-50/80 to-indigo-50/20 dark:from-indigo-950/30 dark:to-indigo-950/10 border-indigo-200/50 dark:border-indigo-800/30 hover:shadow-md hover:border-indigo-300/70 dark:hover:border-indigo-700/50 transition-all duration-200 cursor-pointer" data-testid="crossword-card">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                  <span className="text-2xl">🀄</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base">Today's Puzzle</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {crosswordData
                      ? `${crosswordData.wordCount} words · ${crosswordData.title}`
                      : "Fill in Chinese vocabulary using pinyin — a new puzzle every day!"}
                  </p>
                </div>
                {crosswordData?.status?.isComplete ? (
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full shrink-0" data-testid="crossword-completed-badge">
                    <CheckCircle2 className="w-4 h-4" />
                    Completed
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400 shrink-0" data-testid="crossword-play-link">
                    Play
                    <ChevronRight className="w-4 h-4" />
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        </section>

        {/* Recent Activity */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold font-display">Recent Activity</h2>
            <Link href="/learner-portal" className="text-sm text-primary font-medium hover:underline">See all</Link>
          </div>

          {allRecordings.length > 0 ? (
            <div className="space-y-3">
              {allRecordings.slice(0, 5).map(recording => {
                const score = recording.feedback?.[0]?.overallScore;
                return (
                  <Link key={recording.id} href={`/recordings/${recording.id}`} className="block">
                    <div
                      className="flex items-center gap-4 bg-card border border-border/60 rounded-2xl px-5 py-4 hover:shadow-md hover:border-primary/20 transition-all duration-200 cursor-pointer"
                      data-testid={`recent-recording-${recording.id}`}
                    >
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Mic2 className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-lg truncate leading-tight">{recording.sentenceText}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(recording.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {score != null && (
                          <span className={`text-base font-bold ${getScoreTextColor(score)}`}>{score}%</span>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/20 rounded-3xl border border-dashed border-muted-foreground/20">
              <Mic2 className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <h3 className="text-base font-semibold text-foreground">No recordings yet</h3>
              <p className="text-muted-foreground mt-1 max-w-xs mx-auto mb-5 text-sm">
                Start your journey to perfect tones by recording your first sentence.
              </p>
              <Link href="/record">
                <Button variant="outline" size="sm" className="rounded-full">Start Recording</Button>
              </Link>
            </div>
          )}
        </section>

      </div>

      <ErrorDetailDialog
        error={practiceDialogItem?.error ?? null}
        open={!!practiceDialogItem}
        onClose={() => { setPracticeDialogItem(null); setPracticeDialogRecordWord(undefined); }}
        character={practiceDialogItem?.character ?? undefined}
        recordingId={practiceDialogItem?.recordingId ?? undefined}
        defaultRecordWord={practiceDialogRecordWord}
      />
    </Layout>
  );
}
