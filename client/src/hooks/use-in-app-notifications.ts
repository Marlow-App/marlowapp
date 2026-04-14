import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const POLL_INTERVAL_MS = 15_000;
const FIRST_VISIT_LOOKBACK_MS = 5 * 60 * 1000;

export function useInAppNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const lastSeenRef = useRef<Date | null>(null);
  const initializedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user?.id || initializedRef.current) return;
    initializedRef.current = true;

    const storageKey = `marlow_last_notif_${user.id}`;
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      lastSeenRef.current = new Date(stored);
    } else {
      lastSeenRef.current = new Date(Date.now() - FIRST_VISIT_LOOKBACK_MS);
    }

    async function check() {
      const lastSeen = lastSeenRef.current!;
      const now = new Date();

      try {
        if (user!.role === "learner") {
          const res = await fetch("/api/recordings");
          if (res.status === 401) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            return;
          }
          if (!res.ok) return;
          const recordings: any[] = await res.json();

          lastSeenRef.current = now;
          localStorage.setItem(storageKey, now.toISOString());

          let newFeedbackCount = 0;
          for (const rec of recordings) {
            if (rec.feedback && rec.feedback.length > 0) {
              for (const fb of rec.feedback) {
                if (fb.createdAt && new Date(fb.createdAt) > lastSeen) {
                  newFeedbackCount++;
                  break;
                }
              }
            }
          }

          if (newFeedbackCount > 0) {
            toast({
              title: "New feedback!",
              description: `You received feedback on ${newFeedbackCount} recording${newFeedbackCount > 1 ? "s" : ""}. Check My Progress to see it.`,
            });
          }
        } else if (user!.role === "reviewer") {
          const res = await fetch("/api/recordings/pending");
          if (res.status === 401) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            return;
          }
          if (!res.ok) return;
          const pending: any[] = await res.json();

          lastSeenRef.current = now;
          localStorage.setItem(storageKey, now.toISOString());

          const newCount = pending.filter((r: any) =>
            r.createdAt && new Date(r.createdAt) > lastSeen
          ).length;

          if (newCount > 0) {
            toast({
              title: `${newCount} new recording${newCount > 1 ? "s" : ""} to review!`,
              description: `${newCount === 1 ? "A learner has" : "Learners have"} submitted ${newCount === 1 ? "a recording" : "recordings"} waiting for your feedback.`,
            });
          }
        }
      } catch {
        // Silently fail — notifications are best-effort
      }
    }

    check();
    intervalRef.current = setInterval(check, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      initializedRef.current = false;
    };
  }, [user?.id]);
}
