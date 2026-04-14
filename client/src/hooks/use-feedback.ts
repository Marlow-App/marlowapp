import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertFeedback } from "@shared/schema";

export function useCreateFeedback(recordingId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertFeedback) => {
      const url = buildUrl(api.feedback.create.path, { id: recordingId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to submit feedback");
      }
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate the specific recording query to update the UI immediately
      queryClient.invalidateQueries({ queryKey: [api.recordings.get.path, recordingId] });
      // Refresh pending lists
      queryClient.invalidateQueries({ queryKey: [api.recordings.listPending.path] });
    },
  });
}
