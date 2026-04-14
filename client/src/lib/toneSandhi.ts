import type { ToneChar } from "@/data/phrases";

export interface SandhiChar {
  char: string;
  tone: 1 | 2 | 3 | 4 | 0;
  pinyin: string;
  originalTone: 1 | 2 | 3 | 4 | 0;
  originalPinyin: string;
  changed: boolean;
}

const TONE_MARKS: Record<number, Record<string, string>> = {
  0: { a: "a", e: "e", i: "i", o: "o", u: "u", ü: "ü" },
  1: { a: "ā", e: "ē", i: "ī", o: "ō", u: "ū", ü: "ǖ" },
  2: { a: "á", e: "é", i: "í", o: "ó", u: "ú", ü: "ǘ" },
  3: { a: "ǎ", e: "ě", i: "ǐ", o: "ǒ", u: "ǔ", ü: "ǚ" },
  4: { a: "à", e: "è", i: "ì", o: "ò", u: "ù", ü: "ǜ" },
};

function stripToneMark(ch: string): { vowel: string } | null {
  for (const tone of [1, 2, 3, 4]) {
    for (const [base, marked] of Object.entries(TONE_MARKS[tone])) {
      if (ch === marked) return { vowel: base };
    }
  }
  return null;
}

export function changePinyinTone(py: string, newTone: 0 | 1 | 2 | 3 | 4): string {
  if (!py) return py;
  const chars = Array.from(py);
  for (let i = 0; i < chars.length; i++) {
    const stripped = stripToneMark(chars[i]);
    if (stripped) {
      chars[i] = TONE_MARKS[newTone][stripped.vowel] || stripped.vowel;
      return chars.join("");
    }
    if ("aeiouü".includes(chars[i]) && newTone > 0) {
      const remaining = py.slice(i);
      const vowelIdx = findToneVowelIndex(remaining);
      if (vowelIdx >= 0) {
        const absIdx = i + vowelIdx;
        const base = chars[absIdx];
        if (TONE_MARKS[newTone][base]) {
          chars[absIdx] = TONE_MARKS[newTone][base];
          return chars.join("");
        }
      }
    }
  }
  return py;
}

function findToneVowelIndex(s: string): number {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "a" || s[i] === "e") return i;
  }
  const ouIdx = s.indexOf("ou");
  if (ouIdx >= 0) return ouIdx;
  for (let i = s.length - 1; i >= 0; i--) {
    if ("iouü".includes(s[i])) return i;
  }
  return -1;
}

const FALLBACK_WORDS = new Set([
  "你好","高兴","认识","北京","学习","中文","请问","洗手间","哪里",
  "今天","天气","谢谢","帮助","美国","英语","多少","明白","喜欢",
  "中国","老师","明天","对不起","什么","上海","地铁","手机","吃饭",
  "觉得","意思","漂亮","每天","早上","跑步","普通话","可以","试试",
  "现在","名字","好看","知道","需要","翻译","地方","还是","咖啡",
  "爱好","读书","担心","问题","春节","快乐","一起","生日","朋友",
  "昨天","电影","工作","小心","颜色","公园","散步","打算","明年",
  "便宜","微信","肚子","周末","夏天","已经","路上","有没有","住在",
  "一点","有点","老虎","水果","可能","以后","以前","开始","准备",
  "睡觉","起床","洗澡","回家","出去","怎么","为什么","这里","那里",
  "自己","别人","这个","那个","哪个",
]);

function segmentByWordStart(chars: ToneChar[]): number[][] {
  const hasAnnotations = chars.some(c => c.wordStart === false);
  if (hasAnnotations) {
    const segments: number[][] = [];
    let current: number[] = [];
    for (let i = 0; i < chars.length; i++) {
      if (chars[i].wordStart === false && current.length > 0) {
        current.push(i);
      } else {
        if (current.length > 0) segments.push(current);
        current = [i];
      }
    }
    if (current.length > 0) segments.push(current);
    return segments;
  }

  const text = chars.map(c => c.char).join("");
  const segments: number[][] = [];
  let i = 0;
  while (i < chars.length) {
    let bestLen = 1;
    for (let len = Math.min(4, chars.length - i); len >= 2; len--) {
      if (FALLBACK_WORDS.has(text.slice(i, i + len))) {
        bestLen = len;
        break;
      }
    }
    const seg: number[] = [];
    for (let j = i; j < i + bestLen; j++) seg.push(j);
    segments.push(seg);
    i += bestLen;
  }
  return segments;
}

const YI_ORDINAL_CHARS = new Set([
  "号", "月", "年", "日", "楼", "层", "次", "名", "等",
  "班", "组", "排", "册", "集", "季", "期", "版", "届",
]);

const NEUTRAL_UNDERLYING_TONES: Record<string, 1 | 2 | 3 | 4> = {
  "个": 4, "了": 3, "的": 4, "得": 2, "地": 4,
  "着": 2, "过": 4, "们": 2, "子": 3, "头": 2, "上": 4,
  "下": 4, "里": 3, "面": 4, "边": 1, "些": 1,
  "吗": 3, "呢": 2, "吧": 4, "啊": 1,
};

function getEffectiveTone(char: string, storedTone: 0 | 1 | 2 | 3 | 4): 0 | 1 | 2 | 3 | 4 {
  if (storedTone !== 0) return storedTone;
  return NEUTRAL_UNDERLYING_TONES[char] ?? 0;
}

function markChanged(r: SandhiChar, newTone: 0 | 1 | 2 | 3 | 4, newPinyin: string) {
  r.tone = newTone;
  r.pinyin = newPinyin;
  r.changed = true;
}

export function applyToneSandhi(chars: ToneChar[]): SandhiChar[] {
  const result: SandhiChar[] = chars.map(c => ({
    char: c.char,
    tone: c.tone,
    pinyin: c.pinyin,
    originalTone: c.tone,
    originalPinyin: c.pinyin,
    changed: false,
  }));

  const segments = segmentByWordStart(chars);

  for (const seg of segments) {
    const len = seg.length;
    if (len < 2) continue;

    if (len === 2) {
      if (result[seg[0]].tone === 3 && result[seg[1]].tone === 3) {
        markChanged(result[seg[0]], 2, changePinyinTone(result[seg[0]].originalPinyin, 2));
      }
    } else if (len === 3) {
      const t0 = result[seg[0]].tone, t1 = result[seg[1]].tone, t2 = result[seg[2]].tone;
      if (t0 === 3 && t1 === 3 && t2 === 3) {
        markChanged(result[seg[0]], 2, changePinyinTone(result[seg[0]].originalPinyin, 2));
        markChanged(result[seg[1]], 2, changePinyinTone(result[seg[1]].originalPinyin, 2));
      } else if (t0 === 3 && t1 === 3) {
        markChanged(result[seg[0]], 2, changePinyinTone(result[seg[0]].originalPinyin, 2));
      } else if (t1 === 3 && t2 === 3) {
        markChanged(result[seg[1]], 2, changePinyinTone(result[seg[1]].originalPinyin, 2));
      }
    } else {
      for (let k = 0; k < len - 1; k++) {
        if (result[seg[k]].tone === 3 && result[seg[k + 1]].tone === 3) {
          markChanged(result[seg[k]], 2, changePinyinTone(result[seg[k]].originalPinyin, 2));
        }
      }
    }
  }

  for (let i = 0; i < result.length; i++) {
    if (result[i].char !== "不") continue;
    if (i + 1 < result.length) {
      const nextEff = getEffectiveTone(result[i + 1].char, result[i + 1].tone as 0 | 1 | 2 | 3 | 4);
      if (nextEff === 4) {
        markChanged(result[i], 2, changePinyinTone("bù", 2));
      }
    }
  }

  for (let i = 0; i < result.length; i++) {
    if (result[i].char !== "一") continue;
    if (i + 1 < result.length && YI_ORDINAL_CHARS.has(result[i + 1].char)) continue;
    if (i + 1 < result.length) {
      const nextEff = getEffectiveTone(result[i + 1].char, result[i + 1].tone as 0 | 1 | 2 | 3 | 4);
      if (nextEff === 4) {
        markChanged(result[i], 2, changePinyinTone("yī", 2));
      } else if (nextEff === 1 || nextEff === 2 || nextEff === 3) {
        markChanged(result[i], 4, changePinyinTone("yī", 4));
      }
    }
  }

  return result;
}

export function hasSandhiChanges(chars: ToneChar[]): boolean {
  return applyToneSandhi(chars).some(c => c.changed);
}

export const hasSandhi = hasSandhiChanges;

export interface ActiveSandhiRules {
  t3: boolean;
  bu: boolean;
  yi: boolean;
}

export function detectSandhiRules(chars: ToneChar[]): ActiveSandhiRules {
  const result = applyToneSandhi(chars);
  let t3 = false, bu = false, yi = false;
  for (const r of result) {
    if (!r.changed) continue;
    if (r.char === "不") { bu = true; continue; }
    if (r.char === "一") { yi = true; continue; }
    if (r.originalTone === 3 && r.tone === 2) { t3 = true; }
  }
  return { t3, bu, yi };
}

export function pinyinCharsToToneChars(pinyinChars: { char: string; py: string; tone: number }[]): ToneChar[] {
  return pinyinChars.map(p => ({
    char: p.char,
    tone: (p.tone >= 0 && p.tone <= 4 ? p.tone : 0) as 0 | 1 | 2 | 3 | 4,
    pinyin: p.py,
  }));
}
