import { pinyin } from "pinyin-pro";
import { getNeutralPatches } from "@/lib/neutralTones";

export const TONE_COLORS: Record<number, string> = {
  1: "text-red-600 dark:text-red-400",
  2: "text-orange-500 dark:text-orange-400",
  3: "text-green-600 dark:text-green-400",
  4: "text-blue-500 dark:text-blue-400",
  0: "text-gray-400 dark:text-gray-500",
};

export interface PinyinChar {
  char: string;
  py: string;
  tone: number;
}

export type PracticeListItem = { id: number; errorId: string; character?: string | null };

export function getCharPinyin(text: string): PinyinChar[] {
  const chars = Array.from(text);
  const isChinese = (ch: string) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch);

  const chineseOnly = chars.filter(isChinese).join("");
  const pinyinArr = pinyin(chineseOnly, { toneType: "symbol", type: "array" });
  const toneArr = pinyin(chineseOnly, { toneType: "num", type: "array" });

  const result: PinyinChar[] = [];
  let pIdx = 0;
  for (const ch of chars) {
    if (isChinese(ch)) {
      const toneStr = toneArr[pIdx] || "";
      const toneNum = parseInt(toneStr.slice(-1)) || 0;
      result.push({ char: ch, py: pinyinArr[pIdx] || "", tone: toneNum });
      pIdx++;
    } else {
      result.push({ char: ch, py: "", tone: 0 });
    }
  }
  const chineseEntries = result.filter(p => p.py !== "");
  const chineseText = chineseEntries.map(p => p.char).join("");
  const patches = getNeutralPatches(chineseText);
  patches.forEach((py, idx) => {
    if (chineseEntries[idx]) {
      chineseEntries[idx].py = py;
      chineseEntries[idx].tone = 0;
    }
  });
  return result;
}
