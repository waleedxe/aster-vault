/** Text direction helpers for English (LTR) and Arabic (RTL). */

export function isRtl(language: string): boolean {
  return language === "ar";
}

export function directionFor(language: string): "rtl" | "ltr" {
  return isRtl(language) ? "rtl" : "ltr";
}

/** Apply the language and direction to the document root. */
export function applyDirection(language: string): void {
  const root = document.documentElement;
  root.setAttribute("lang", language);
  root.setAttribute("dir", directionFor(language));
}
