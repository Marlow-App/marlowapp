import { useState, useCallback } from "react";

const STORAGE_KEY = "marlow_display_prefs";

interface DisplayPrefs {
  showPinyin: boolean;
  showSandhi: boolean;
  showTips: boolean;
}

const DEFAULT_PREFS: DisplayPrefs = {
  showPinyin: true,
  showSandhi: true,
  showTips: true,
};

function loadPrefs(): DisplayPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: DisplayPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
  }
}

export function useDisplayPrefs() {
  const [prefs, setPrefs] = useState<DisplayPrefs>(loadPrefs);

  const setShowPinyin = useCallback((value: boolean) => {
    setPrefs(prev => {
      const next = { ...prev, showPinyin: value };
      savePrefs(next);
      return next;
    });
  }, []);

  const setShowSandhi = useCallback((value: boolean) => {
    setPrefs(prev => {
      const next = { ...prev, showSandhi: value };
      savePrefs(next);
      return next;
    });
  }, []);

  const setShowTips = useCallback((value: boolean) => {
    setPrefs(prev => {
      const next = { ...prev, showTips: value };
      savePrefs(next);
      return next;
    });
  }, []);

  return {
    showPinyin: prefs.showPinyin,
    showSandhi: prefs.showSandhi,
    showTips: prefs.showTips,
    setShowPinyin,
    setShowSandhi,
    setShowTips,
  };
}
