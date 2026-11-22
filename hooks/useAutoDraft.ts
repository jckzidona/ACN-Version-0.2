import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const PREFIX = "acn-draft:";

/** Removes every locally kept form draft (used on sign-out so shared computers stay clean). */
export function clearAllDrafts() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable */
  }
}

/**
 * Automatically keeps a draft of a form in this browser while the user types.
 * - Restores an unsaved draft when the form is opened again.
 * - Call `clear()` after the form is successfully saved.
 * `ready` should become true once the form's starting values are loaded.
 */
export function useAutoDraft<T>(
  key: string | null,
  value: T,
  restore: (draft: T) => void,
  ready = true,
) {
  const fullKey = key ? PREFIX + key : null;
  const [armed, setArmed] = useState(false);
  const baseline = useRef<string | undefined>(undefined);
  const valueRef = useRef(value);
  valueRef.current = value;
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Reset when the form identity changes
  useEffect(() => {
    setArmed(false);
    baseline.current = undefined;
    setSavedAt(null);
    setTimeout(() => {
      if (baseline.current === undefined) baseline.current = JSON.stringify(valueRef.current);
    }, 0);
  }, [fullKey]);

  // Restore once starting values are ready
  useEffect(() => {
    if (!fullKey || !ready || armed) return;
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { v: T; t: number };
        restoreRef.current(parsed.v);
        baseline.current = "";
        setSavedAt(parsed.t);
        toast.info("Unsaved draft restored.", { id: fullKey });
      }
    } catch {
      /* ignore bad drafts */
    }
    setArmed(true);
  }, [fullKey, ready, armed]);

  // Save (debounced) whenever the value changes
  useEffect(() => {
    if (!fullKey || !armed) return;
    const json = JSON.stringify(value);
    if (baseline.current === undefined) {
      baseline.current = json;
      return;
    }
    const timer = setTimeout(() => {
      try {
        if (json === baseline.current) {
          localStorage.removeItem(fullKey);
          setSavedAt(null);
        } else {
          const t = Date.now();
          localStorage.setItem(fullKey, JSON.stringify({ v: value, t }));
          setSavedAt(t);
        }
      } catch {
        /* storage full or unavailable */
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [fullKey, armed, value]);

  const clear = useCallback(() => {
    if (!fullKey) return;
    try {
      localStorage.removeItem(fullKey);
    } catch {
      /* ignore */
    }
    baseline.current = undefined;
    setSavedAt(null);
    setTimeout(() => {
      if (baseline.current === undefined) baseline.current = JSON.stringify(valueRef.current);
    }, 0);
  }, [fullKey]);

  return { clear, savedAt };
}
