import { useState, useCallback, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";

export function usePhraseAudio() {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef<Map<string, string>>(new Map());

  const playPhrase = useCallback(async (text: string) => {
    const key = text;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const cached = audioCache.current.get(key);
    if (cached) {
      const audio = new Audio(cached);
      audioRef.current = audio;
      audio.play().catch(console.error);
      return;
    }

    setLoadingKey(key);
    try {
      const res = await apiRequest("POST", "/api/phrase-audio/generate", { text, gender: "F" });
      const data = await res.json();
      audioCache.current.set(key, data.audioUrl);
      const audio = new Audio(data.audioUrl);
      audioRef.current = audio;
      audio.play().catch(console.error);
    } catch (err) {
      console.error("Failed to generate phrase audio:", err);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.rate = 0.8;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } finally {
      setLoadingKey(null);
    }
  }, []);

  const isLoading = useCallback((text: string) => {
    return loadingKey === text;
  }, [loadingKey]);

  const anyLoading = loadingKey !== null;

  return { playPhrase, isLoading, anyLoading };
}
