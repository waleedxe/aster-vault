import { useTranslation } from "react-i18next";

import { changeLanguage } from "../../i18n/changeLanguage";
import { useSettingsStore, type Language } from "../../stores/settingsStore";

const LANGUAGES: { value: Language; labelKey: string }[] = [
  { value: "en", labelKey: "settings.english" },
  { value: "ar", labelKey: "settings.arabic" },
];

/** English / Arabic switcher with correct direction handling. */
export function LanguageSwitcher() {
  const { t } = useTranslation();
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  const select = (value: Language) => {
    setLanguage(value);
    void changeLanguage(value);
  };

  return (
    <div
      role="group"
      aria-label={t("settings.language")}
      className="inline-flex rounded-vault border border-mist p-1 dark:border-navy"
    >
      {LANGUAGES.map((option) => {
        const active = language === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => select(option.value)}
            className={
              "rounded-[8px] px-3 py-1 text-sm focus-visible:outline-2 focus-visible:outline-emerald " +
              (active
                ? "bg-emerald text-white"
                : "text-muted hover:text-ink dark:hover:text-porcelain")
            }
          >
            {t(option.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
