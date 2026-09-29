import { useEffect, useRef } from "react";

import { noteActivity } from "../lib/tauri";

/**
 * Auto-lock on inactivity.
 *
 * Listens for user activity, tells the backend to reset its idle timer, and
 * invokes `onLock` after `minutes` of inactivity. A value of 0 disables the
 * timer.
 */
export function useAutoLock(
  enabled: boolean,
  minutes: number,
  onLock: () => void,
): void {
  const timerRef = useRef<number | null>(null);
  const onLockRef = useRef(onLock);

  useEffect(() => {
    onLockRef.current = onLock;
  }, [onLock]);

  useEffect(() => {
    if (!enabled || minutes <= 0) {
      return;
    }

    const reset = () => {
      void noteActivity().catch(() => undefined);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(
        () => onLockRef.current(),
        minutes * 60 * 1000,
      );
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];
    events.forEach((event) =>
      window.addEventListener(event, reset, { passive: true }),
    );
    reset();

    return () => {
      events.forEach((event) => window.removeEventListener(event, reset));
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [enabled, minutes]);
}
