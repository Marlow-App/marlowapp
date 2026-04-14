export function countChineseChars(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0xf900 && code <= 0xfaff)
    ) {
      count++;
    }
  }
  return count;
}

export const MAX_CHARS = 10;

// Free tier limits
export const FREE_RECORDINGS_PER_DAY = 5;
export const FREE_ERROR_POPUPS_PER_DAY = 3;
export const FREE_PRACTICE_LIST_MAX = 3;

// Subscription plans
export const SUBSCRIPTION_PLANS = [
  {
    id: "monthly" as const,
    label: "Monthly",
    priceUsd: 9.99,
    interval: "month" as const,
    highlight: null,
    description: "Billed monthly, cancel any time",
  },
  {
    id: "yearly" as const,
    label: "Yearly",
    priceUsd: 99.99,
    interval: "year" as const,
    highlight: "best_value" as const,
    description: "Save 17% vs monthly",
  },
] as const;

export type SubscriptionPlanId = typeof SUBSCRIPTION_PLANS[number]["id"];
