import { useState, useMemo } from "react";
import type { ToneChar } from "@/data/phrases";
import {
  applyToneSandhi,
  detectSandhiRules,
  pinyinCharsToToneChars,
  type SandhiChar,
} from "@/lib/toneSandhi";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Info, Lightbulb } from "lucide-react";
import { useDisplayPrefs } from "@/hooks/use-display-prefs";

const TONE_COLORS: Record<number, string> = {
  1: "text-red-600 dark:text-red-400",
  2: "text-yellow-600 dark:text-yellow-400",
  3: "text-green-600 dark:text-green-400",
  4: "text-blue-600 dark:text-blue-400",
  0: "text-gray-500 dark:text-gray-400",
};

const TONE_PINYIN_COLORS: Record<number, string> = {
  1: "text-red-500 dark:text-red-400",
  2: "text-yellow-500 dark:text-yellow-400",
  3: "text-green-500 dark:text-green-400",
  4: "text-blue-500 dark:text-blue-400",
  0: "text-gray-400 dark:text-gray-500",
};

const TONE_PILL_COLORS: Record<number, string> = {
  1: "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900",
  2: "bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900",
  3: "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900",
  4: "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900",
  0: "bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800",
};

function isPunct(char: string, pinyin: string) {
  return !pinyin || /[，。！？、；：]/.test(char);
}

interface TipEntry {
  id: string;
  tone: number;
  charIndices: number[];
  isT3T3: boolean;
}

function getTipContent(entry: TipEntry, hasNonFinalT3: boolean): { label: string; heading: string; body: React.ReactNode } {
  if (entry.isT3T3) {
    return {
      label: "T3+T3 sandhi",
      heading: "Third-tone sandhi (T3+T3)",
      body: (
        <div className="space-y-2 text-xs leading-relaxed">
          <p className="text-muted-foreground">
            When two third-tone syllables appear in a row, the first changes to <strong>second tone</strong> in natural speech. This is called <em>T3+T3 sandhi</em>.
          </p>
          <div className="bg-muted/40 rounded px-2.5 py-2 font-mono text-[11px] space-y-0.5">
            <p>Written: T3 + T3</p>
            <p>Spoken:  T2 + T3</p>
            <p className="text-muted-foreground">e.g. 你好 nǐhǎo → <span className="text-foreground">níhǎo</span></p>
          </div>
          <p className="text-muted-foreground">
            The change happens automatically in speech — you don't need to consciously think about it. Just let the first syllable rise naturally into the second.
          </p>
        </div>
      ),
    };
  }

  switch (entry.tone) {
    case 1:
      return {
        label: "T1 tip",
        heading: "Pronouncing First Tone (T1) — ā",
        body: (
          <p className="text-muted-foreground text-xs leading-relaxed">
            Hold T1 <strong>high and completely flat</strong> — like sustaining a musical note.
            Your pitch should start high and stay there with no rise or fall.
            <br /><br />
            Common mistake: letting it drift upward or downward. Keep it level throughout.
          </p>
        ),
      };
    case 2:
      return {
        label: "T2 tip",
        heading: "Pronouncing Second Tone (T2) — á",
        body: (
          <p className="text-muted-foreground text-xs leading-relaxed">
            T2 rises from <strong>mid to high</strong> — like the rising pitch of a genuine question in English ("Really?").
            <br /><br />
            Start at a middle pitch and end noticeably higher. Keep the rise smooth and continuous.
            Common mistake: making it sound like T1 by starting too high.
          </p>
        ),
      };
    case 3:
      return {
        label: "T3 tip",
        heading: "Pronouncing Third Tone (T3) — ǎ",
        body: hasNonFinalT3 ? (
          <div className="space-y-2 text-xs leading-relaxed">
            <p className="text-muted-foreground">
              T3 in the middle of a phrase is <strong>not a full dip-and-rise</strong>. It's a <em>half-third tone</em> (半三声): just <strong>dip low</strong> without the final rise.
            </p>
            <div className="bg-muted/40 rounded px-2.5 py-2 font-mono text-[11px] space-y-0.5">
              <p>Non-final T3: low dip only ↘</p>
              <p>Final T3: dip then rise ↘↗</p>
            </div>
            <p className="text-muted-foreground">
              The full rise back up only happens on the <strong>last syllable of a phrase</strong>. Trying to fully rise on every T3 sounds choppy and unnatural.
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs leading-relaxed">
            At the end of a phrase, T3 makes the full <strong>dip-and-rise</strong> shape: start at mid pitch, fall to your lowest, then rise back up.
            <br /><br />
            In the middle of phrases, T3 only dips — the rise is dropped.
          </p>
        ),
      };
    case 4:
      return {
        label: "T4 tip",
        heading: "Pronouncing Fourth Tone (T4) — à",
        body: (
          <p className="text-muted-foreground text-xs leading-relaxed">
            T4 falls <strong>sharply from high to low</strong> in one quick drop — like a firm command or "Stop!" in English.
            <br /><br />
            Start high and fall decisively. Common mistake: making it too gentle. T4 should feel assertive and short.
          </p>
        ),
      };
    case 0:
      return {
        label: "Neutral tip",
        heading: "Neutral Tone (T0) — a",
        body: (
          <p className="text-muted-foreground text-xs leading-relaxed">
            The neutral tone is <strong>short, light, and unstressed</strong> — spoken quickly after the previous syllable.
            Don't give it any distinct pitch shape; just let it land softly.
            <br /><br />
            Common mistake: holding it too long or adding a tone shape. Keep it brief and relaxed.
          </p>
        ),
      };
    default:
      return { label: "Tip", heading: "Tone tip", body: null };
  }
}

function ToneTipPopover({
  entry,
  hasNonFinalT3,
  onHoverChange,
}: {
  entry: TipEntry;
  hasNonFinalT3: boolean;
  onHoverChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const { label, heading, body } = getTipContent(entry, hasNonFinalT3);
  const pillColor = TONE_PILL_COLORS[entry.tone] ?? TONE_PILL_COLORS[3];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${pillColor}`}
          data-testid={`tone-tip-btn-${entry.id}`}
          onMouseEnter={() => onHoverChange(entry.id)}
          onMouseLeave={() => onHoverChange(null)}
          onFocus={() => onHoverChange(entry.id)}
          onBlur={() => onHoverChange(null)}
        >
          <Lightbulb className="w-2.5 h-2.5 shrink-0" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="max-w-xs text-sm space-y-2 p-4" data-testid={`tone-tip-popover-${entry.id}`}>
        <p className="font-semibold text-foreground text-sm">{heading}</p>
        {body}
      </PopoverContent>
    </Popover>
  );
}

function CharDisplay({
  char,
  tone,
  pinyin,
  charSize = "text-2xl",
  pinyinSize = "text-xs",
  changed = false,
  showPinyin = true,
  highlighted = false,
}: {
  char: string;
  tone: number;
  pinyin: string;
  charSize?: string;
  pinyinSize?: string;
  changed?: boolean;
  showPinyin?: boolean;
  highlighted?: boolean;
}) {
  const isPunctuation = isPunct(char, pinyin);
  return (
    <span
      className={`inline-flex flex-col items-center mx-[1px] rounded transition-colors duration-150 ${
        highlighted && !isPunctuation ? "bg-primary/10" : ""
      }`}
    >
      {showPinyin && !isPunctuation && (
        <span className={`${pinyinSize} leading-tight font-medium ${TONE_PINYIN_COLORS[tone]}`}>
          {pinyin}
        </span>
      )}
      <span className={`${charSize} font-medium leading-tight ${isPunctuation ? "text-foreground/60" : TONE_COLORS[tone]}`}>
        {char}
      </span>
      {showPinyin && !isPunctuation && (
        <span className={`w-1 h-1 rounded-full mt-0.5 ${changed ? "bg-primary/60" : ""}`} />
      )}
    </span>
  );
}

function SandhiExplainerPopover({ t3, bu, yi }: { t3: boolean; bu: boolean; yi: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium hover:text-foreground transition-colors leading-none"
          data-testid="sandhi-label"
          aria-label="Learn why tones change"
        >
          As spoken
          <Info className="w-3 h-3 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="max-w-xs text-sm space-y-3 p-4" data-testid="sandhi-explainer-popover">
        <p className="font-semibold text-foreground text-sm">Why do some tones change?</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          In natural speech, certain tones shift depending on what comes before or after them. This is called <em>tone sandhi</em>.
        </p>
        {t3 && (
          <div className="space-y-0.5">
            <p className="font-medium text-foreground text-xs">Third-tone sandhi</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              When two third-tone (T3) syllables appear in a row, the first changes to second tone (T2) before it is spoken.
              <br />
              <span className="font-mono text-foreground">T3 + T3 → T2 + T3</span>
              <br />
              e.g. 你好 (nǐ hǎo) is spoken as <span className="font-mono text-foreground">níhǎo</span>
            </p>
          </div>
        )}
        {bu && (
          <div className="space-y-0.5">
            <p className="font-medium text-foreground text-xs">不 (bù) sandhi</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              不 is normally fourth tone (bù), but changes to second tone (bú) when the following syllable is also fourth tone.
              <br />
              <span className="font-mono text-foreground">不 + T4 → bú + T4</span>
            </p>
          </div>
        )}
        {yi && (
          <div className="space-y-0.5">
            <p className="font-medium text-foreground text-xs">一 (yī) sandhi</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              一 is normally first tone (yī), but its tone shifts based on what follows:
              <br />
              <span className="font-mono text-foreground">一 + T4 → yí + T4</span>
              <br />
              <span className="font-mono text-foreground">一 + T1/T2/T3 → yì + T1/T2/T3</span>
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function buildTipEntries(toneChars: ToneChar[], sandhiResult: SandhiChar[]): TipEntry[] {
  const n = toneChars.length;

  // Step 1: Find consecutive T3 groups (2+) in original toneChars, skipping punctuation
  const t3t3Owned = new Set<number>();
  const t3t3Groups: number[][] = [];
  let i = 0;
  while (i < n) {
    const tc = toneChars[i];
    if (tc.tone === 3 && !isPunct(tc.char, tc.pinyin)) {
      let j = i;
      while (
        j + 1 < n &&
        toneChars[j + 1].tone === 3 &&
        !isPunct(toneChars[j + 1].char, toneChars[j + 1].pinyin)
      ) {
        j++;
      }
      if (j > i) {
        const group: number[] = [];
        for (let k = i; k <= j; k++) {
          group.push(k);
          t3t3Owned.add(k);
        }
        t3t3Groups.push(group);
        i = j + 1;
        continue;
      }
    }
    i++;
  }

  // Step 2: Build tip entries in order of first appearance
  const tipMap = new Map<string, TipEntry>();
  const tipOrder: string[] = [];

  for (let idx = 0; idx < n; idx++) {
    const tc = toneChars[idx];
    if (isPunct(tc.char, tc.pinyin)) continue;

    // Check if this index starts a T3+T3 group
    const groupStarting = t3t3Groups.find(g => g[0] === idx);
    if (groupStarting) {
      const key = "t3t3";
      if (!tipMap.has(key)) {
        tipMap.set(key, { id: key, tone: 3, charIndices: [], isT3T3: true });
        tipOrder.push(key);
      }
      tipMap.get(key)!.charIndices.push(...groupStarting);
      // Skip to end of group
      idx = groupStarting[groupStarting.length - 1];
      continue;
    }

    if (t3t3Owned.has(idx)) continue;

    // Use effective (as-spoken) tone from sandhiResult
    const effectiveTone = sandhiResult[idx]?.tone ?? tc.tone;
    const key = `tone-${effectiveTone}`;
    if (!tipMap.has(key)) {
      tipMap.set(key, { id: key, tone: effectiveTone, charIndices: [], isT3T3: false });
      tipOrder.push(key);
    }
    tipMap.get(key)!.charIndices.push(idx);
  }

  return tipOrder.map(k => tipMap.get(k)!);
}

interface SandhiPhraseDisplayProps {
  characters?: ToneChar[];
  pinyinChars?: { char: string; py: string; tone: number }[];
  charSize?: string;
  pinyinSize?: string;
  showSandhiRow?: boolean;
}

export function SandhiPhraseDisplay({
  characters,
  pinyinChars,
  charSize = "text-2xl",
  pinyinSize = "text-xs",
  showSandhiRow = true,
}: SandhiPhraseDisplayProps) {
  const { showPinyin, showSandhi, showTips } = useDisplayPrefs();
  const [hoveredTipId, setHoveredTipId] = useState<string | null>(null);

  const toneChars: ToneChar[] = useMemo(() => {
    if (characters) return characters;
    if (pinyinChars) return pinyinCharsToToneChars(pinyinChars);
    return [];
  }, [characters, pinyinChars]);

  const sandhiResult: SandhiChar[] = useMemo(() => applyToneSandhi(toneChars), [toneChars]);
  const hasChanges = useMemo(() => sandhiResult.some(c => c.changed), [sandhiResult]);
  const rules = useMemo(() => detectSandhiRules(toneChars), [toneChars]);

  const effectiveShowSandhi = showSandhiRow && showSandhi && hasChanges;

  const tipEntries = useMemo(() => buildTipEntries(toneChars, sandhiResult), [toneChars, sandhiResult]);

  // The last non-punctuation char index in sandhiResult (for non-final T3 detection)
  const lastContentIdx = useMemo(() => {
    for (let i = sandhiResult.length - 1; i >= 0; i--) {
      if (!isPunct(sandhiResult[i].char, sandhiResult[i].pinyin)) return i;
    }
    return -1;
  }, [sandhiResult]);

  // Whether any T3 tip char is in a non-final position
  const hasNonFinalT3 = useMemo(() => {
    const t3Entry = tipEntries.find(e => e.id === "tone-3");
    if (!t3Entry) return false;
    return t3Entry.charIndices.some(idx => idx !== lastContentIdx);
  }, [tipEntries, lastContentIdx]);

  // Highlighted char indices from hovered tip
  const highlightedIndices = useMemo<Set<number>>(() => {
    if (!hoveredTipId) return new Set();
    const entry = tipEntries.find(e => e.id === hoveredTipId);
    return new Set(entry?.charIndices ?? []);
  }, [hoveredTipId, tipEntries]);

  const tipsBar = showTips && tipEntries.length > 0 ? (
    <div className="flex flex-wrap gap-1.5 mt-2.5" data-testid="tone-tips-bar">
      {tipEntries.map(entry => (
        <ToneTipPopover
          key={entry.id}
          entry={entry}
          hasNonFinalT3={hasNonFinalT3}
          onHoverChange={setHoveredTipId}
        />
      ))}
    </div>
  ) : null;

  if (!effectiveShowSandhi) {
    return (
      <div data-testid="sandhi-phrase-display">
        <div className="flex flex-wrap items-end gap-x-0.5 gap-y-1" data-testid="sandhi-original-row">
          {toneChars.map((tc, i) => (
            <CharDisplay
              key={i}
              char={tc.char}
              tone={tc.tone}
              pinyin={tc.pinyin}
              charSize={charSize}
              pinyinSize={pinyinSize}
              showPinyin={showPinyin}
              highlighted={highlightedIndices.has(i)}
            />
          ))}
        </div>
        {tipsBar}
      </div>
    );
  }

  return (
    <div data-testid="sandhi-phrase-display">
      <div
        className="overflow-x-auto"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
      >
        <div className="flex items-end gap-3 min-w-max">
          <div className="flex-shrink-0 flex flex-col">
            <span
              className="h-4 flex items-center text-[10px] uppercase tracking-wider text-muted-foreground font-medium"
              data-testid="sandhi-original-label"
            >
              Original
            </span>
            <div className="flex flex-wrap items-end gap-x-0.5 gap-y-1" data-testid="sandhi-original-row">
              {toneChars.map((tc, i) => (
                <CharDisplay
                  key={i}
                  char={tc.char}
                  tone={tc.tone}
                  pinyin={tc.pinyin}
                  charSize={charSize}
                  pinyinSize={pinyinSize}
                  showPinyin={showPinyin}
                  highlighted={highlightedIndices.has(i)}
                />
              ))}
            </div>
          </div>

          <div className="w-px bg-border flex-shrink-0 self-stretch" />

          <div className="flex-shrink-0 flex flex-col">
            <div className="h-4 flex items-center">
              <SandhiExplainerPopover t3={rules.t3} bu={rules.bu} yi={rules.yi} />
            </div>
            <div className="flex flex-wrap items-end gap-x-0.5 gap-y-1" data-testid="sandhi-spoken-row">
              {sandhiResult.map((sc, i) => (
                <CharDisplay
                  key={i}
                  char={sc.char}
                  tone={sc.tone}
                  pinyin={sc.pinyin}
                  charSize={charSize}
                  pinyinSize={pinyinSize}
                  changed={sc.changed}
                  showPinyin={showPinyin}
                  highlighted={highlightedIndices.has(i)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      {tipsBar}
    </div>
  );
}
