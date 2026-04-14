import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { format, parseISO } from "date-fns";
import {
  Timer, CheckCircle2, RotateCcw, Trophy,
  Copy, Grid3X3, ChevronRight, CheckCircle, Lightbulb,
} from "lucide-react";
import { SiX, SiFacebook, SiWhatsapp, SiThreads } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CrosswordGrid, cellKey } from "@/components/CrosswordGrid";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CrosswordWord {
  number: number;
  direction: "across" | "down";
  startRow: number;
  startCol: number;
  length: number;
  clue: string;
}

interface CrosswordPuzzle {
  id: number;
  puzzleIndex: number;
  title: string;
  grid: boolean[][];
  words: CrosswordWord[];
  wordCount: number;
  status: {
    cells: Record<string, string>;
    elapsedSeconds: number | null;
    isComplete: boolean;
    completedAt: string | null;
  } | null;
}

interface ArchiveEntry {
  id: number;
  puzzleIndex: number;
  title: string;
  wordCount: number;
  date: string;
  isComplete: boolean;
}

type GamePhase = "pre-start" | "playing" | "completed";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWordCells(word: CrosswordWord) {
  return Array.from({ length: word.length }, (_, i) => ({
    row: word.direction === "across" ? word.startRow : word.startRow + i,
    col: word.direction === "across" ? word.startCol + i : word.startCol,
  }));
}

function buildCellNumberMap(words: CrosswordWord[]): Record<string, number> {
  const map: Record<string, number> = {};
  const sorted = [...words].sort((a, b) => a.number - b.number);
  for (const w of sorted) {
    const k = cellKey(w.startRow, w.startCol);
    if (!map[k]) map[k] = w.number;
  }
  return map;
}

function getWordsForCell(words: CrosswordWord[], row: number, col: number) {
  const result: { word: CrosswordWord; cellIdx: number }[] = [];
  for (const word of words) {
    const cells = getWordCells(word);
    const idx = cells.findIndex(c => c.row === row && c.col === col);
    if (idx !== -1) result.push({ word, cellIdx: idx });
  }
  return result;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function generateShareText(puzzleIndex: number, grid: boolean[][], elapsedSeconds: number): string {
  const gridEmoji = grid.map(row => row.map(isWhite => isWhite ? "🟩" : "⬛").join("")).join("\n");
  return `Marlow 中文填字游戏 #${puzzleIndex + 1} 🀄\nSolved in ${formatTime(elapsedSeconds)} ✅\n\n${gridEmoji}\n\nPlay Marlow's daily Chinese crossword 👉 marlow.app/crossword`;
}

function isChineseChar(char: string): boolean {
  const cp = char.codePointAt(0) ?? 0;
  return (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0xf900 && cp <= 0xfaff);
}

// ─── Main Crossword Component ──────────────────────────────────────────────────

export default function CrosswordPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const search = useSearch();

  // Check if viewing a specific puzzle via query params ?p=<puzzleIndex>&d=<YYYY-MM-DD>
  const urlParams = new URLSearchParams(search);
  const viewingIndex = urlParams.has("p") ? Number(urlParams.get("p")) : null;
  const viewingDate = urlParams.get("d") ?? null;
  const isViewingArchive = viewingIndex !== null && !isNaN(viewingIndex);

  const { data: todayPuzzle, isLoading: todayLoading } = useQuery<CrosswordPuzzle>({
    queryKey: ["/api/crossword/today"],
    enabled: !isViewingArchive,
  });

  const { data: archivePuzzle, isLoading: archiveLoading } = useQuery<CrosswordPuzzle>({
    queryKey: ["/api/crossword/puzzle", viewingIndex, viewingDate],
    queryFn: async () => {
      const dateQuery = viewingDate ? `?date=${viewingDate}` : "";
      const res = await fetch(`/api/crossword/puzzle/${viewingIndex}${dateQuery}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load puzzle: ${res.status}`);
      return res.json();
    },
    enabled: isViewingArchive,
  });

  const puzzle = isViewingArchive ? archivePuzzle : todayPuzzle;
  const isLoading = isViewingArchive ? archiveLoading : todayLoading;

  const { data: archive } = useQuery<ArchiveEntry[]>({
    queryKey: ["/api/crossword/archive"],
    enabled: !isViewingArchive,
  });

  // Game state
  const [phase, setPhase] = useState<GamePhase>("pre-start");
  const [cells, setCells] = useState<Record<string, string>>({});
  const [checkState, setCheckState] = useState<Record<string, boolean | null>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [activeWordNum, setActiveWordNum] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [hintedKeys, setHintedKeys] = useState<Set<string>>(new Set());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset and restore state whenever puzzle changes (covers today → archive and archive → archive navigation)
  useEffect(() => {
    if (!puzzle) return;
    // Always reset all game state first
    if (timerRef.current) clearInterval(timerRef.current);
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setSelectedKey(null);
    setActiveWordNum(null);
    setCheckState({});
    setStartTime(null);
    setHintedKeys(new Set());
    // Apply saved status for this specific puzzle
    if (puzzle.status?.isComplete) {
      setCells((puzzle.status.cells as Record<string, string>) ?? {});
      setElapsedSeconds(puzzle.status.elapsedSeconds ?? 0);
      setPhase("completed");
    } else if (puzzle.status?.cells && Object.keys(puzzle.status.cells).length > 0) {
      setCells((puzzle.status.cells as Record<string, string>) ?? {});
      setElapsedSeconds(puzzle.status.elapsedSeconds ?? 0);
      setPhase("pre-start");
    } else {
      setCells({});
      setElapsedSeconds(0);
      setPhase("pre-start");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle?.id]);

  // Timer
  useEffect(() => {
    if (phase === "playing" && startTime !== null) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, startTime]);

  const progressMutation = useMutation({
    mutationFn: (data: { puzzleId: number; cells: Record<string, string>; elapsedSeconds: number }) =>
      apiRequest("POST", "/api/crossword/today/progress", data),
  });

  // Autosave (debounced 2s)
  useEffect(() => {
    if (phase !== "playing" || !puzzle || isViewingArchive) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      const elapsed = startTime !== null ? Math.floor((Date.now() - startTime) / 1000) : elapsedSeconds;
      progressMutation.mutate({ puzzleId: puzzle.id, cells, elapsedSeconds: elapsed });
    }, 2000);
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, phase]);

  const checkMutation = useMutation({
    mutationFn: async (data: { puzzleId: number; cells: Record<string, string> }) => {
      const res = await apiRequest("POST", "/api/crossword/check", data);
      return res.json() as Promise<{ results: Record<string, boolean> }>;
    },
  });

  const completeMutation = useMutation({
    mutationFn: (data: { puzzleId: number; cells: Record<string, string>; elapsedSeconds: number }) =>
      apiRequest("POST", "/api/crossword/complete", data),
  });

  const handleStart = useCallback(() => {
    const now = Date.now();
    const resumeElapsed = elapsedSeconds;
    setStartTime(now - resumeElapsed * 1000);
    setPhase("playing");
  }, [elapsedSeconds]);

  const handleCheck = useCallback(async () => {
    if (!puzzle) return;
    const current = startTime !== null ? Math.floor((Date.now() - startTime) / 1000) : elapsedSeconds;
    if (!isViewingArchive) {
      progressMutation.mutate({ puzzleId: puzzle.id, cells, elapsedSeconds: current });
    }

    let results: Record<string, boolean>;
    try {
      const data = await checkMutation.mutateAsync({ puzzleId: puzzle.id, cells });
      results = data.results;
    } catch (_e) {
      toast({ title: "Check failed", description: "Could not check answers. Please try again.", variant: "destructive" });
      return;
    }

    setCheckState(results);

    const whiteCells = puzzle.grid.flatMap((row, r) =>
      row.map((isWhite, c) => isWhite ? cellKey(r, c) : null).filter(Boolean) as string[]
    );
    const allCorrect = whiteCells.every(k => results[k] === true);

    if (allCorrect) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (!isViewingArchive) {
        try {
          await completeMutation.mutateAsync({ puzzleId: puzzle.id, cells, elapsedSeconds: current });
        } catch (_e) {
          toast({ title: "All correct!", description: "Your answers are right, but we couldn't save your result. Try clicking Check again.", variant: "destructive" });
          return;
        }
      }
      setElapsedSeconds(current);
      setPhase("completed");
      toast({ title: "🎉 Puzzle Complete!", description: `Solved in ${formatTime(current)}` });
    } else {
      setTimeout(() => {
        setCells(prev => {
          const next = { ...prev };
          Object.entries(results).forEach(([k, correct]) => {
            if (!correct) delete next[k];
          });
          return next;
        });
        setCheckState({});
      }, 2000);
      toast({ title: "Not quite!", description: "Wrong answers have been cleared. Keep trying!", variant: "destructive" });
    }
  }, [puzzle, cells, elapsedSeconds, startTime, isViewingArchive]);

  const handleReset = useCallback(() => {
    setCells({});
    setCheckState({});
    setSelectedKey(null);
    setActiveWordNum(null);
    setElapsedSeconds(0);
    setPhase("pre-start");
    setStartTime(null);
    setHintedKeys(new Set());
  }, []);

  const hintMutation = useMutation({
    mutationFn: async (data: { puzzleId: number; cells: Record<string, string> }) => {
      const res = await apiRequest("POST", "/api/crossword/hint", data);
      return res.json() as Promise<{ key: string; char: string }>;
    },
    onSuccess: ({ key, char }) => {
      setCells(prev => ({ ...prev, [key]: char }));
      setHintedKeys(prev => new Set(prev).add(key));
    },
    onError: () => {
      toast({ title: "No hints needed!", description: "All cells are already correct.", variant: "destructive" });
    },
  });

  const handleHint = useCallback(() => {
    if (!puzzle || phase !== "playing") return;
    hintMutation.mutate({ puzzleId: puzzle.id, cells });
  }, [puzzle, phase, cells]);

  // ─── Cell interactions ────────────────────────────────────────────────────

  const selectCell = useCallback((row: number, col: number, puzz: CrosswordPuzzle) => {
    const k = cellKey(row, col);
    if (selectedKey === k) {
      const wordsHere = getWordsForCell(puzz.words, row, col);
      if (wordsHere.length > 1) {
        const curIdx = wordsHere.findIndex(w => w.word.number === activeWordNum);
        const next = wordsHere[(curIdx + 1) % wordsHere.length];
        setActiveWordNum(next.word.number);
      }
    } else {
      setSelectedKey(k);
      const wordsHere = getWordsForCell(puzz.words, row, col);
      if (wordsHere.length > 0) {
        const preferred = wordsHere.find(w => w.word.number === activeWordNum) ?? wordsHere[0];
        setActiveWordNum(preferred.word.number);
      } else {
        setActiveWordNum(null);
      }
    }
  }, [selectedKey, activeWordNum]);

  const computeNextCellKey = useCallback((puzz: CrosswordPuzzle, fromRow: number, fromCol: number, wordNum: number): string | null => {
    const word = puzz.words.find(w => w.number === wordNum);
    if (!word) return null;
    const wordCells = getWordCells(word);
    const curIdx = wordCells.findIndex(c => c.row === fromRow && c.col === fromCol);
    if (curIdx >= 0 && curIdx < wordCells.length - 1) {
      const next = wordCells[curIdx + 1];
      return cellKey(next.row, next.col);
    }
    return null;
  }, []);

  const advanceToNextCell = useCallback((puzz: CrosswordPuzzle, fromRow: number, fromCol: number, wordNum: number) => {
    const nextKey = computeNextCellKey(puzz, fromRow, fromCol, wordNum);
    if (nextKey) setSelectedKey(nextKey);
  }, [computeNextCellKey]);

  const moveToPrevCell = useCallback((puzz: CrosswordPuzzle, fromRow: number, fromCol: number, wordNum: number) => {
    const word = puzz.words.find(w => w.number === wordNum);
    if (!word) return;
    const wordCells = getWordCells(word);
    const curIdx = wordCells.findIndex(c => c.row === fromRow && c.col === fromCol);
    if (curIdx > 0) {
      const prev = wordCells[curIdx - 1];
      setSelectedKey(cellKey(prev.row, prev.col));
    }
  }, []);

  // Called when a character is confirmed in a cell (after IME or direct input)
  const handleCellChar = useCallback((key: string, char: string) => {
    if (!puzzle || phase !== "playing") return;
    // Only accept single characters (Chinese or other)
    const firstChar = char.trim()[0] ?? "";
    if (!firstChar) return;
    setCells(prev => ({ ...prev, [key]: firstChar }));
    // Auto-advance if a CJK character was entered
    if (isChineseChar(firstChar) && activeWordNum !== null) {
      const [rowStr, colStr] = key.split("-");
      advanceToNextCell(puzzle, Number(rowStr), Number(colStr), activeWordNum);
    }
  }, [puzzle, phase, activeWordNum, advanceToNextCell]);

  const handleCellFocus = useCallback((row: number, col: number) => {
    if (!puzzle) return;
    if (phase === "pre-start") handleStart();
    selectCell(row, col, puzzle);
  }, [puzzle, phase, selectCell, handleStart]);

  const handleCellKeyDown = useCallback((key: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!puzzle || phase !== "playing") return;
    const [rowStr, colStr] = key.split("-");
    const row = Number(rowStr);
    const col = Number(colStr);

    if (e.key === "Backspace") {
      e.preventDefault();
      const cur = cells[key] ?? "";
      if (cur.length > 0) {
        setCells(prev => { const n = { ...prev }; delete n[key]; return n; });
      }
      // Always navigate to prev cell on backspace (clear + move in one press)
      if (activeWordNum !== null) {
        moveToPrevCell(puzzle, row, col, activeWordNum);
      }
    } else if (e.key === "Enter" || e.key === " " || e.key === "Tab") {
      e.preventDefault();
      if (activeWordNum !== null) advanceToNextCell(puzzle, row, col, activeWordNum);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const numCols = puzzle.grid[0]?.length ?? 4;
      for (let c = col + 1; c < numCols; c++) {
        if (puzzle.grid[row]?.[c]) { setSelectedKey(cellKey(row, c)); break; }
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      for (let c = col - 1; c >= 0; c--) {
        if (puzzle.grid[row]?.[c]) { setSelectedKey(cellKey(row, c)); break; }
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const numRows = puzzle.grid.length ?? 4;
      for (let r = row + 1; r < numRows; r++) {
        if (puzzle.grid[r]?.[col]) { setSelectedKey(cellKey(r, col)); break; }
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      for (let r = row - 1; r >= 0; r--) {
        if (puzzle.grid[r]?.[col]) { setSelectedKey(cellKey(r, col)); break; }
      }
    }
  }, [puzzle, phase, cells, activeWordNum, advanceToNextCell, moveToPrevCell]);

  // ─── Rendering ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  if (!puzzle) {
    return (
      <Layout>
        <div className="text-center py-16 text-muted-foreground">
          <Grid3X3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No puzzle available. Check back soon!</p>
        </div>
      </Layout>
    );
  }

  const cellNumbers = buildCellNumberMap(puzzle.words);
  const activeWord = activeWordNum ? puzzle.words.find(w => w.number === activeWordNum) : undefined;
  const activeCellKeys = activeWord
    ? new Set(getWordCells(activeWord).map(c => cellKey(c.row, c.col)))
    : new Set<string>();

  const acrossWords = puzzle.words.filter(w => w.direction === "across").sort((a, b) => a.number - b.number);
  const downWords = puzzle.words.filter(w => w.direction === "down").sort((a, b) => a.number - b.number);

  // Completed state share text
  const shareText = generateShareText(puzzle.puzzleIndex, puzzle.grid, elapsedSeconds);
  const encodedText = encodeURIComponent(shareText);
  const shareUrl = encodeURIComponent("https://marlow.app/crossword");
  const copyShare = async () => {
    await navigator.clipboard.writeText(shareText);
    toast({ title: "Copied!", description: "Share text copied to clipboard" });
  };

  return (
    <Layout>
      <div className="space-y-5 animate-in max-w-2xl mx-auto">

        {/* Header */}
        <div>
          {isViewingArchive && (
            <button
              onClick={() => navigate("/crossword")}
              className="text-xs text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1 transition-colors"
            >
              ← Back to today's puzzle
            </button>
          )}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
            {isViewingArchive && viewingDate
              ? format(parseISO(viewingDate), "EEEE, d MMMM yyyy")
              : format(new Date(), "EEEE, d MMMM yyyy")}
          </p>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold font-display leading-tight flex items-center gap-2">
                <span className="text-2xl">🀄</span> Daily Crossword
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Puzzle #{puzzle.puzzleIndex + 1} · {puzzle.title}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {phase !== "pre-start" && (
                <div className="flex items-center gap-1.5 text-sm font-mono font-semibold bg-muted px-3 py-1.5 rounded-lg" data-testid="crossword-timer">
                  <Timer className="w-3.5 h-3.5 text-muted-foreground" />
                  {formatTime(elapsedSeconds)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Completed celebration banner ────────────────────────────────────── */}
        {phase === "completed" && (
          <Card
            className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 text-center"
            data-testid="completed-banner"
          >
            <CardContent className="py-8 px-6 space-y-5">
              <div className="flex flex-col items-center gap-3">
                <Trophy className="w-12 h-12 text-primary" />
                <div>
                  <p className="font-bold text-2xl font-display">Puzzle Complete! 🎉</p>
                  <p className="text-base text-muted-foreground mt-1">
                    Solved in <span className="font-semibold text-foreground">{formatTime(elapsedSeconds)}</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">Come back tomorrow for a new puzzle!</p>
                </div>
              </div>
              {/* Practice again */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCells({});
                  setCheckState({});
                  setSelectedKey(null);
                  setActiveWordNum(null);
                  setElapsedSeconds(0);
                  setStartTime(null);
                  setHintedKeys(new Set());
                  setPhase("pre-start");
                }}
                className="gap-1.5 text-muted-foreground"
                data-testid="practice-again-btn"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Practice Again
              </Button>
              {/* Share row */}
              <div className="flex flex-wrap justify-center gap-2" data-testid="share-row">
                <a href={`https://twitter.com/intent/tweet?text=${encodedText}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="gap-1.5" data-testid="share-x"><SiX className="w-3.5 h-3.5" />X</Button>
                </a>
                <a href={`https://threads.net/intent/post?text=${encodedText}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="gap-1.5" data-testid="share-threads"><SiThreads className="w-3.5 h-3.5" />Threads</Button>
                </a>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="gap-1.5" data-testid="share-facebook"><SiFacebook className="w-3.5 h-3.5" />Facebook</Button>
                </a>
                <a href={`https://wa.me/?text=${encodedText}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="gap-1.5" data-testid="share-whatsapp"><SiWhatsapp className="w-3.5 h-3.5" />WhatsApp</Button>
                </a>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={copyShare} data-testid="share-copy">
                  <Copy className="w-3.5 h-3.5" />Copy
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Game area: grid + clues ─────────────────────────────────────────── */}
        <div className="md:flex md:gap-6 space-y-5 md:space-y-0">
          {/* Grid column */}
          <div className="flex flex-col items-center gap-3">
            <CrosswordGrid
              puzzle={puzzle}
              cells={cells}
              checkState={checkState}
              phase={phase}
              selectedKey={selectedKey}
              activeCellKeys={activeCellKeys}
              cellNumbers={cellNumbers}
              hintedKeys={hintedKeys}
              onCellFocus={handleCellFocus}
              onCellChar={handleCellChar}
              onCellKeyDown={handleCellKeyDown}
              readOnly={phase === "completed"}
            />

            {/* Action buttons */}
            {phase === "playing" && (
              <div className="flex gap-2 flex-wrap justify-center" data-testid="playing-actions">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="gap-1.5 text-muted-foreground"
                  data-testid="reset-btn"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleHint}
                  disabled={hintMutation.isPending}
                  className="gap-1.5 text-violet-600 border-violet-200 hover:bg-violet-50 hover:border-violet-300 dark:text-violet-400 dark:border-violet-800 dark:hover:bg-violet-950/30"
                  data-testid="hint-btn"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  Hint
                </Button>
                <Button
                  size="sm"
                  onClick={handleCheck}
                  disabled={checkMutation.isPending}
                  className="gap-1.5"
                  data-testid="check-btn"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {checkMutation.isPending ? "Checking..." : "Check Answers"}
                </Button>
              </div>
            )}
          </div>

          {/* Clues column */}
          <div className="flex-1 space-y-4 min-w-0 overflow-y-auto max-h-[450px] pr-1" data-testid="clues-panel">
            {phase === "playing" && (
              <p className="text-xs text-muted-foreground italic">
                Type using your Chinese keyboard — one character per cell
              </p>
            )}

            {acrossWords.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Across</h3>
                <div className="space-y-1">
                  {acrossWords.map(word => {
                    const isActiveWord = word.number === activeWordNum;
                    return (
                      <div
                        key={`across-${word.number}`}
                        className={cn(
                          "flex gap-2 text-sm px-2 py-1.5 rounded-lg transition-colors",
                          phase === "playing" ? "cursor-pointer" : "cursor-default",
                          isActiveWord ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50",
                        )}
                        onClick={() => {
                          if (phase !== "playing") return;
                          const firstCell = getWordCells(word)[0];
                          setSelectedKey(cellKey(firstCell.row, firstCell.col));
                          setActiveWordNum(word.number);
                        }}
                        data-testid={`clue-across-${word.number}`}
                      >
                        <span className="font-bold shrink-0 w-5 text-right">{word.number}</span>
                        <span className="leading-snug italic text-muted-foreground">"{word.clue}"</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {downWords.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Down</h3>
                <div className="space-y-1">
                  {downWords.map(word => {
                    const isActiveWord = word.number === activeWordNum;
                    return (
                      <div
                        key={`down-${word.number}`}
                        className={cn(
                          "flex gap-2 text-sm px-2 py-1.5 rounded-lg transition-colors",
                          phase === "playing" ? "cursor-pointer" : "cursor-default",
                          isActiveWord ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50",
                        )}
                        onClick={() => {
                          if (phase !== "playing") return;
                          const firstCell = getWordCells(word)[0];
                          setSelectedKey(cellKey(firstCell.row, firstCell.col));
                          setActiveWordNum(word.number);
                        }}
                        data-testid={`clue-down-${word.number}`}
                      >
                        <span className="font-bold shrink-0 w-5 text-right">{word.number}</span>
                        <span className="leading-snug italic text-muted-foreground">"{word.clue}"</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {phase === "playing" && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded-xl p-3 space-y-1">
                <p className="font-semibold">How to play:</p>
                <p>• Click a cell, then use your Chinese keyboard to type characters</p>
                <p>• On mobile: tap a cell to open your keyboard, switch to Chinese input</p>
                <p>• Press <kbd className="bg-muted border border-border rounded px-1">⌫</kbd> to delete</p>
                <p>• Click <strong>Check Answers</strong> when you're ready!</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Past Puzzles library (today only) ───────────────────────────────── */}
        {!isViewingArchive && archive && archive.length > 0 && (
          <div className="space-y-3" data-testid="archive-section">
            <h2 className="text-base font-bold font-display">Past Puzzles</h2>
            <div className="grid gap-2">
              {archive.map(entry => (
                <button
                  key={entry.puzzleIndex}
                  onClick={() => navigate(`/crossword?p=${entry.puzzleIndex}&d=${entry.date}`)}
                  className="flex items-center justify-between gap-3 w-full text-left px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors"
                  data-testid={`archive-entry-${entry.puzzleIndex}`}
                >
                  <div className="flex items-center gap-3">
                    {entry.isComplete ? (
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-border shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-semibold leading-tight">
                        Puzzle #{entry.puzzleIndex + 1} · {entry.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(parseISO(entry.date), "EEEE, d MMM")}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
