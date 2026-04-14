import { useQuery } from "@tanstack/react-query";

export interface SubscriptionStatus {
  tier: "free" | "pro";
  status: string | null;
  periodEnd: string | null;
  isUnlimited?: boolean;
}

export function useSubscription() {
  return useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription/status"],
    staleTime: 30 * 1000,
  });
}

export function useIsPro(): boolean {
  const { data } = useSubscription();
  return data?.tier === "pro" && (data?.status === "active" || data?.status === "canceling" || !!data?.isUnlimited);
}
