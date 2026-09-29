import i18n from "./index";
import { applyDirection } from "./direction";
import { setStoredLanguage, type Language } from "../stores/settingsStore";

/** Switch language, apply direction, and persist the choice. */
export async function changeLanguage(language: Language): Promise<void> {
  await i18n.changeLanguage(language);
  applyDirection(language);
  setStoredLanguage(language);
}
