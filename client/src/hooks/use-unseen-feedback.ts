import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";

const POLL_INTERVAL_MS = 15_000;
const HOME_SEEN_EVENT = "marlow:home-seen";

export function useUnseenFeedback() {
  const { user } = useAuth();
  const [unseenCount, setUnseenCount] = useState(0);
  const lastVisitRef = useRef<Date | null>(null);
  const initializedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const storageKey = user?.id ? `marlow_home_visit_${user.id}` : null;

  const markHomeSeen = useCallback(() => {
    if (!storageKey) return;
    const now = new Date();
    lastVisitRef.current = now;
    localStorage.setItem(storageKey, now.toISOString());
    setUnseenCount(0);
    window.dispatchEvent(new CustomEvent(HOME_SEEN_EVENT));
  }, [storageKey]);

  useEffect(() => {
    if (!user?.id || user.role !== "learner" || initializedRef.current) return;
    initializedRef.current = true;

    const stored = localStorage.getItem(storageKey!);
    lastVisitRef.current = stored ? new Date(stored) : new Date(0);

    async function poll() {
      try {
        const res = await fetch("/api/recordings");
        if (res.status === 401) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          return;
        }
        if (!res.ok) return;
        const recordings: any[] = await res.json();
        const lastVisit = lastVisitRef.current!;

        let count = 0;
        for (const rec of recordings) {
          if (rec.feedback && rec.feedback.length > 0) {
            const hasNew = rec.feedback.some(
              (fb: any) => fb.createdAt && new Date(fb.createdAt) > lastVisit
            );
            if (hasNew) count++;
          }
        }
        setUnseenCount(count);
      } catch {
        // best-effort
      }
    }

    function onHomeSeen() {
      const stored = localStorage.getItem(storageKey!);
      if (stored) lastVisitRef.current = new Date(stored);
      setUnseenCount(0);
    }

    window.addEventListener(HOME_SEEN_EVENT, onHomeSeen);
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      initializedRef.current = false;
      window.removeEventListener(HOME_SEEN_EVENT, onHomeSeen);
    };
  }, [user?.id, user?.role]);

  return { unseenCount, markHomeSeen };
}
