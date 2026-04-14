import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type GamePhase = "pre-start" | "playing" | "completed";

interface CrosswordGridWord {
  number: number;
  direction: "across" | "down";
  startRow: number;
  startCol: number;
  length: number;
}

interface CrosswordGridPuzzle {
  grid: boolean[][];
  words: CrosswordGridWord[];
  wordCount?: number;
}

export interface CrosswordGridProps {
  puzzle: CrosswordGridPuzzle;
  cells: Record<string, string>;
  checkState: Record<string, boolean | null>;
  phase: GamePhase;
  selectedKey: string | null;
  activeCellKeys: Set<string>;
  cellNumbers: Record<string, number>;
  hintedKeys?: Set<string>;
  onCellFocus: (row: number, col: number) => void;
  onCellChar: (key: string, char: string) => void;
  onCellKeyDown: (key: string, e: React.KeyboardEvent<HTMLInputElement>) => void;
  readOnly?: boolean;
}

export function cellKey(row: number, col: number): string {
  return `${row}-${col}`;
}

export function CrosswordGrid({
  puzzle,
  cells,
  checkState,
  phase,
  selectedKey,
  activeCellKeys,
  cellNumbers,
  hintedKeys = new Set(),
  onCellFocus,
  onCellChar,
  onCellKeyDown,
  readOnly = false,
}: CrosswordGridProps) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!selectedKey || phase !== "playing" || readOnly) return;
    const input = inputRefs.current[selectedKey];
    if (input && document.activeElement !== input) {
      input.focus({ preventScroll: true });
    }
  }, [selectedKey, phase, readOnly]);

  return (
    <div className="relative">
      <div
        className="grid gap-1 p-2 bg-foreground/5 rounded-xl border border-border"
        style={{ gridTemplateColumns: `repeat(${puzzle.grid[0]?.length ?? 4}, 1fr)` }}
        data-testid="crossword-grid"
      >
        {puzzle.grid.map((row, r) =>
          row.map((isWhite, c) => {
            const k = cellKey(r, c);
            const num = cellNumbers[k];
            const isSelected = selectedKey === k;
            const isHighlighted = activeCellKeys.has(k);
            const isHinted = hintedKeys.has(k);
            const checkResult = checkState[k];
            const charValue = cells[k] ?? "";

            if (!isWhite) {
              return (
                <div
                  key={k}
                  className="w-16 h-16 md:w-20 md:h-20 rounded-md bg-foreground/80 dark:bg-foreground/60"
                  data-testid={`cell-black-${k}`}
                />
              );
            }

            return (
              <div
                key={k}
                className={cn(
                  "w-16 h-16 md:w-20 md:h-20 rounded-md border-2 relative transition-all duration-100 cursor-pointer select-none",
                  isSelected
                    ? "border-primary bg-primary/15 shadow-sm"
                    : isHighlighted
                      ? "border-primary/40 bg-primary/8"
                      : "border-border bg-card",
                  isHinted && !isSelected && "border-violet-400 bg-violet-50 dark:bg-violet-950/30",
                  !readOnly && !isSelected && !isHighlighted && !isHinted && "hover:border-primary/30",
                  checkResult === true && "border-green-500 bg-green-50 dark:bg-green-950/30",
                  checkResult === false && "border-red-500 bg-red-50 dark:bg-red-950/30",
                )}
                data-testid={`cell-${k}`}
                onClick={() => {
                  if (phase !== "completed") {
                    onCellFocus(r, c);
                    inputRefs.current[k]?.focus({ preventScroll: true });
                  }
                }}
              >
                {num && (
                  <span className="absolute top-0.5 left-1 text-[9px] font-bold text-muted-foreground leading-none z-10 pointer-events-none">
                    {num}
                  </span>
                )}

                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <span
                    className={cn(
                      "text-2xl font-bold",
                      isHinted && "text-violet-600 dark:text-violet-400",
                      checkResult === true && "text-green-700 dark:text-green-400",
                      checkResult === false && "text-red-600 dark:text-red-400",
                    )}
                  >
                    {charValue}
                  </span>
                </div>

                {!readOnly && (
                  <input
                    key={k}
                    ref={el => { inputRefs.current[k] = el; }}
                    type="text"
                    inputMode="text"
                    lang="zh-CN"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    tabIndex={phase === "completed" ? -1 : 0}
                    readOnly={phase === "completed"}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 caret-transparent"
                    data-testid={`input-${k}`}
                    onFocus={() => {
                      if (phase !== "completed") onCellFocus(r, c);
                    }}
                    onCompositionEnd={(e) => {
                      const composed = (e.data || "").trim();
                      const char = Array.from(composed)[0];
                      if (char) {
                        onCellChar(k, char);
                      }
                      if (e.currentTarget) {
                        e.currentTarget.value = "";
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing) return;
                      onCellKeyDown(k, e);
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
