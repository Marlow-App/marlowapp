import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Save, Edit2, ChevronDown, ChevronUp } from "lucide-react";

interface CrosswordWordEntry {
  number: number;
  direction: "across" | "down";
  startRow: number;
  startCol: number;
  length: number;
  clue: string;
  chars: string[];
  answer: string[];
}

interface CrosswordPuzzle {
  id: number;
  puzzleIndex: number;
  title: string;
  grid: boolean[][];
  words: CrosswordWordEntry[];
}

function cellKey(r: number, c: number) { return `${r}-${c}`; }

function getWordCells(word: CrosswordWordEntry) {
  return Array.from({ length: word.length }, (_, i) => ({
    row: word.direction === "across" ? word.startRow : word.startRow + i,
    col: word.direction === "across" ? word.startCol + i : word.startCol,
  }));
}

function PuzzleEditor({ puzzle, onClose }: { puzzle: CrosswordPuzzle; onClose: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState(puzzle.title);
  const [grid, setGrid] = useState<boolean[][]>(JSON.parse(JSON.stringify(puzzle.grid)));
  const [words, setWords] = useState<CrosswordWordEntry[]>(JSON.parse(JSON.stringify(puzzle.words)));

  const updateMutation = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/crossword/${puzzle.id}`, { title, grid, words }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crossword/all"] });
      toast({ title: "Saved!", description: "Puzzle updated successfully" });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Failed to save puzzle", variant: "destructive" }),
  });

  const toggleCell = (r: number, c: number) => {
    setGrid(prev => {
      const next = prev.map(row => [...row]);
      next[r][c] = !next[r][c];
      return next;
    });
  };

  const updateWordField = (idx: number, field: string, value: string) => {
    setWords(prev => prev.map((w, i) => i === idx ? { ...w, [field]: value } : w));
  };

  const updateWordAnswer = (idx: number, answerIdx: number, value: string) => {
    setWords(prev => prev.map((w, i) => {
      if (i !== idx) return w;
      const newAnswer = [...w.answer];
      newAnswer[answerIdx] = value.toLowerCase().trim();
      return { ...w, answer: newAnswer };
    }));
  };

  const updateWordChar = (idx: number, charIdx: number, value: string) => {
    setWords(prev => prev.map((w, i) => {
      if (i !== idx) return w;
      const newChars = [...w.chars];
      newChars[charIdx] = value;
      return { ...w, chars: newChars };
    }));
  };

  // Derive white cell map for live preview
  const wordCellMap = new Set<string>();
  const selectedWordCells: Record<string, string> = {};
  for (const word of words) {
    const cells = getWordCells(word);
    cells.forEach((c, i) => {
      const k = cellKey(c.row, c.col);
      wordCellMap.add(k);
      selectedWordCells[k] = word.chars[i] ?? "?";
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold font-display">Editing: Puzzle #{puzzle.puzzleIndex + 1}</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} size="sm">Cancel</Button>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} size="sm" className="gap-1.5" data-testid="save-puzzle-btn">
            <Save className="w-4 h-4" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Left: grid editor + title */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="puzzle-title">Title</Label>
            <Input
              id="puzzle-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="mt-1"
              data-testid="puzzle-title-input"
            />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Grid (click to toggle black/white)</p>
            <div
              className="grid gap-1 p-2 bg-foreground/5 rounded-xl border border-border inline-grid"
              style={{ gridTemplateColumns: `repeat(${grid[0]?.length ?? 4}, 1fr)` }}
              data-testid="editor-grid"
            >
              {grid.map((row, r) =>
                row.map((isWhite, c) => {
                  const k = cellKey(r, c);
                  const char = selectedWordCells[k];
                  return (
                    <div
                      key={k}
                      onClick={() => toggleCell(r, c)}
                      className={cn(
                        "w-12 h-12 rounded-md border-2 cursor-pointer flex items-center justify-center text-sm font-bold transition-colors select-none",
                        isWhite
                          ? "border-border bg-card hover:border-primary/40 text-foreground"
                          : "border-transparent bg-foreground/80 hover:bg-foreground/60"
                      )}
                      data-testid={`editor-cell-${k}`}
                    >
                      {isWhite && char && <span className="text-xs">{char}</span>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right: word editor */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Words & Clues</p>
          {words.map((word, idx) => (
            <Card key={idx} className="border-border/60">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {word.number}{word.direction === "across" ? "A" : "D"}
                  </span>
                  <span className="text-xs text-muted-foreground">{word.direction} · length {word.length}</span>
                </div>

                <div>
                  <Label className="text-xs">Clue</Label>
                  <Input
                    value={word.clue}
                    onChange={e => updateWordField(idx, "clue", e.target.value)}
                    className="mt-0.5 text-sm h-8"
                    data-testid={`word-clue-${idx}`}
                  />
                </div>

                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${word.length}, 1fr)` }}>
                  {Array.from({ length: word.length }, (_, i) => (
                    <div key={i} className="space-y-0.5">
                      <Input
                        value={word.chars[i] ?? ""}
                        onChange={e => updateWordChar(idx, i, e.target.value)}
                        maxLength={1}
                        placeholder="字"
                        className="h-8 text-center text-sm font-bold p-1"
                        data-testid={`word-char-${idx}-${i}`}
                      />
                      <Input
                        value={word.answer[i] ?? ""}
                        onChange={e => updateWordAnswer(idx, i, e.target.value)}
                        placeholder="pīn"
                        className="h-7 text-center text-[11px] p-1 text-muted-foreground"
                        data-testid={`word-answer-${idx}-${i}`}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CrosswordEditor() {
  const { user } = useAuth();
  const { data: puzzles, isLoading } = useQuery<CrosswordPuzzle[]>({ queryKey: ["/api/crossword/all"] });
  const [editingId, setEditingId] = useState<number | null>(null);

  if (user?.role !== "reviewer" && user?.role !== "admin") {
    return (
      <Layout>
        <div className="text-center py-16 text-muted-foreground">
          <p>Access restricted to reviewers/admins.</p>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  const editingPuzzle = puzzles?.find(p => p.id === editingId);

  return (
    <Layout>
      <div className="space-y-5 animate-in">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display">Crossword Editor</h1>
          <p className="text-sm text-muted-foreground mt-1">Edit puzzle clues, answers, and grid layout</p>
        </div>

        {editingPuzzle ? (
          <PuzzleEditor puzzle={editingPuzzle} onClose={() => setEditingId(null)} />
        ) : (
          <div className="space-y-3" data-testid="puzzle-list">
            {puzzles?.map(puzzle => (
              <Card key={puzzle.id} className="border-border/60">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">#{puzzle.puzzleIndex + 1} — {puzzle.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {puzzle.words.length} word{puzzle.words.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(puzzle.id)}
                    className="gap-1.5"
                    data-testid={`edit-puzzle-${puzzle.id}`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
