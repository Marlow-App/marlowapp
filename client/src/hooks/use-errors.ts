import { useQuery } from "@tanstack/react-query";
import type { PronunciationError } from "@shared/schema";

export function useAllErrors() {
  return useQuery<PronunciationError[]>({ queryKey: ["/api/errors"], retry: 3, staleTime: 5 * 60 * 1000 });
}
