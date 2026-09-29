import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copy text to the clipboard and clear it after `clearSeconds`.
 *
 * The clear only happens if the app is still the most recent writer; we cannot
 * make the clipboard atomic, which is documented as a limitation.
 */
export function useClipboard() {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const copy = useCallback(
    async (field: string, value: string, clearSeconds: number) => {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        return false;
      }
      clearTimers();
      setCopiedField(field);
      setSecondsLeft(clearSeconds);

      intervalRef.current = window.setInterval(() => {
        setSecondsLeft((previous) => (previous > 0 ? previous - 1 : 0));
      }, 1000);

      timerRef.current = window.setTimeout(() => {
        void navigator.clipboard.writeText("").catch(() => undefined);
        setCopiedField(null);
        setSecondsLeft(0);
        clearTimers();
      }, clearSeconds * 1000);

      return true;
    },
    [clearTimers],
  );

  useEffect(() => clearTimers, [clearTimers]);

  return { copy, copiedField, secondsLeft };
}
