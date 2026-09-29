import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ar from "./ar.json";
import en from "./en.json";
import { applyDirection } from "./direction";
import { getStoredLanguage, type Language } from "../stores/settingsStore";

export type { Language };

const initialLanguage = getStoredLanguage();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: initialLanguage,
  fallbackLng: "en",
  interpolation: {
    // React already escapes rendered values.
    escapeValue: false,
  },
});

applyDirection(initialLanguage);

export default i18n;
