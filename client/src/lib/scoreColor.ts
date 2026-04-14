// 11-step color scale matching the red→green gradient (0-9%, 10-19%, …, 100%)
const BG: string[] = [
  "bg-red-500",    // 0–9%
  "bg-orange-500", // 10–19%
  "bg-orange-400", // 20–29%
  "bg-amber-500",  // 30–39%
  "bg-amber-400",  // 40–49%
  "bg-yellow-400", // 50–59%
  "bg-lime-400",   // 60–69%
  "bg-lime-500",   // 70–79%
  "bg-green-500",  // 80–89%
  "bg-green-400",  // 90–99%
  "bg-green-600",  // 100%
];

const TEXT: string[] = [
  "text-red-600 dark:text-red-400",         // 0–9%
  "text-orange-600 dark:text-orange-400",   // 10–19%
  "text-orange-500 dark:text-orange-400",   // 20–29%
  "text-amber-600 dark:text-amber-400",     // 30–39%
  "text-amber-500 dark:text-amber-400",     // 40–49%
  "text-yellow-600 dark:text-yellow-400",   // 50–59%
  "text-lime-600 dark:text-lime-400",       // 60–69%
  "text-lime-700 dark:text-lime-400",       // 70–79%
  "text-green-600 dark:text-green-400",     // 80–89%
  "text-green-500 dark:text-green-400",     // 90–99%
  "text-green-700 dark:text-green-500",     // 100%
];

function bucket(score: number): number {
  return Math.min(10, Math.floor(score / 10));
}

export function getScoreBgColor(score: number): string {
  return BG[bucket(score)];
}

export function getScoreTextColor(score: number): string {
  return TEXT[bucket(score)];
}
