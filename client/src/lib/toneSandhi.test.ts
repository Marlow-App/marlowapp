import { applyToneSandhi } from "./toneSandhi";

type TC = { char: string; tone: 0 | 1 | 2 | 3 | 4; pinyin: string; wordStart?: boolean };

function chars(arr: [string, 0 | 1 | 2 | 3 | 4, string][]): TC[] {
  return arr.map(([char, tone, pinyin]) => ({ char, tone, pinyin }));
}

let passed = 0;
let failed = 0;

function assert(desc: string, actual: boolean) {
  if (actual) {
    console.log(`  ✓ ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ ${desc}`);
    failed++;
  }
}

function tone(result: ReturnType<typeof applyToneSandhi>, idx: number) {
  return result[idx].tone;
}

function changed(result: ReturnType<typeof applyToneSandhi>, idx: number) {
  return result[idx].changed;
}

// ── Regression: no T3 sandhi across word boundaries ─────────────────────────
console.log("\n你家有几口人 — no cross-word T3 sandhi");
{
  const r = applyToneSandhi(chars([
    ["你", 3, "nǐ"],
    ["家", 1, "jiā"],
    ["有", 3, "yǒu"],
    ["几", 3, "jǐ"],
    ["口", 3, "kǒu"],
    ["人", 2, "rén"],
  ]));
  assert("有 (idx 2) stays T3, not changed", !changed(r, 2) && tone(r, 2) === 3);
  assert("几 (idx 3) stays T3, not changed", !changed(r, 3) && tone(r, 3) === 3);
  assert("口 (idx 4) stays T3, not changed", !changed(r, 4) && tone(r, 4) === 3);
}

console.log("\n这里有没有地铁站 — no sandhi between 里 and 有");
{
  const r = applyToneSandhi(chars([
    ["这", 4, "zhè"],
    ["里", 0, "li"],
    ["有", 3, "yǒu"],
    ["没", 2, "méi"],
    ["有", 3, "yǒu"],
    ["地", 4, "dì"],
    ["铁", 3, "tiě"],
    ["站", 4, "zhàn"],
  ]));
  assert("里 (idx 1, neutral T0) not changed", !changed(r, 1));
  assert("有 (idx 2) stays T3, not changed by cross-word sandhi", !changed(r, 2) && tone(r, 2) === 3);
}

// ── Positive controls: within-word T3 sandhi still works ────────────────────
console.log("\n你好 — within-word T3 sandhi fires correctly");
{
  const r = applyToneSandhi([
    { char: "你", tone: 3, pinyin: "nǐ" },
    { char: "好", tone: 3, pinyin: "hǎo", wordStart: false },
  ]);
  assert("你 (idx 0) changes to T2", changed(r, 0) && tone(r, 0) === 2);
  assert("好 (idx 1) stays T3", !changed(r, 1) && tone(r, 1) === 3);
}

console.log("\n洗手间 (3-char word, T3+T3+T1) — 洗 changes, 手 stays");
{
  const r = applyToneSandhi(chars([
    ["洗", 3, "xǐ"],
    ["手", 3, "shǒu"],
    ["间", 1, "jiān"],
  ]));
  assert("洗 (idx 0) changes to T2", changed(r, 0) && tone(r, 0) === 2);
  assert("手 (idx 1) stays T3", !changed(r, 1) && tone(r, 1) === 3);
}

console.log("\n不 sandhi — 不 before T4 becomes T2");
{
  const r = applyToneSandhi(chars([
    ["不", 4, "bù"],
    ["对", 4, "duì"],
  ]));
  assert("不 (idx 0) changes to T2 before T4", changed(r, 0) && tone(r, 0) === 2);
}

console.log("\n一 sandhi — 一 before T4 becomes T2");
{
  const r = applyToneSandhi(chars([
    ["一", 1, "yī"],
    ["下", 4, "xià"],
  ]));
  assert("一 (idx 0) changes to T2 before T4", changed(r, 0) && tone(r, 0) === 2);
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
