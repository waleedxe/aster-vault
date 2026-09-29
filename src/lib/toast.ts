import { create } from "zustand";

/** Visual tone for a toast. */
export type ToastTone = "neutral" | "emerald" | "amber";

/** A transient message. */
export interface ToastEntry {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: ToastEntry[];
  push: (message: string, tone: ToastTone) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, tone) => {
    const id = Math.random().toString(36).slice(2);
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }));
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Show a transient toast message. */
export function toast(message: string, tone: ToastTone = "neutral"): void {
  useToastStore.getState().push(message, tone);
}
