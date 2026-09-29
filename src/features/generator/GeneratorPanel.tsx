import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import * as api from "../../lib/tauri";
import type { PasswordOptions } from "../../lib/tauri";

interface GeneratorPanelProps {
  onUse?: (value: string) => void;
}

const DEFAULT_OPTIONS: PasswordOptions = {
  length: 20,
  lowercase: true,
  uppercase: true,
  digits: true,
  symbols: true,
  exclude_ambiguous: true,
};

/** Password / passphrase generator panel. */
export function GeneratorPanel({ onUse }: GeneratorPanelProps) {
  const { t } = useTranslation();
  const [options, setOptions] = useState<PasswordOptions>(DEFAULT_OPTIONS);
  const [value, setValue] = useState("");
  const [words, setWords] = useState(4);
  const [passphraseMode, setPassphraseMode] = useState(false);
  const [strength, setStrength] = useState<api.StrengthDto | null>(null);

  const regenerate = useCallback(async () => {
    const generated = passphraseMode
      ? await api.generatePassphrase({
          words,
          separator: "-",
          capitalize: true,
        })
      : await api.generatePassword(options);
    setValue(generated);
    setStrength(await api.passwordStrength(generated));
  }, [options, passphraseMode, words]);

  useEffect(() => {
    // Generate an initial value on mount; subsequent values come from the
    // regenerate button. The rule cannot see that setState happens after await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void regenerate().catch(() => undefined);
  }, [regenerate]);

  const toggle = (key: keyof PasswordOptions) => {
    setOptions((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  return (
    <div className="space-y-4 rounded-vault border border-mist p-4 dark:border-navy">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("generator.title")}</h3>
        <button
          type="button"
          onClick={() => setPassphraseMode((v) => !v)}
          aria-pressed={passphraseMode}
          className="rounded-vault border border-mist px-2 py-1 text-xs dark:border-navy"
        >
          {t("generator.passphrase")}
        </button>
      </div>

      <div className="rounded-vault bg-mist/50 p-3 font-mono text-sm break-all tnum dark:bg-midnight/60">
        {value || "…"}
      </div>

      {strength && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>
            {t("generator.strength")}: {strength.label} (
            {Math.round(strength.entropy_bits)} bits)
          </span>
          <span
            aria-hidden="true"
            className="inline-block h-2 w-24 overflow-hidden rounded-full bg-mist dark:bg-navy"
          >
            <span
              className="block h-full bg-emerald"
              style={{ width: `${((strength.score + 1) / 5) * 100}%` }}
            />
          </span>
        </div>
      )}

      {passphraseMode ? (
        <label className="block text-sm">
          {t("generator.words")}
          <input
            type="number"
            min={3}
            max={10}
            value={words}
            onChange={(event) => setWords(Number(event.target.value))}
            className="mt-1 w-24 rounded-vault border border-mist bg-transparent px-2 py-1 dark:border-navy"
          />
        </label>
      ) : (
        <>
          <label className="block text-sm">
            {t("generator.length")}: {options.length}
            <input
              type="range"
              min={8}
              max={64}
              value={options.length}
              onChange={(event) =>
                setOptions((previous) => ({
                  ...previous,
                  length: Number(event.target.value),
                }))
              }
              className="mt-1 w-full accent-emerald"
            />
          </label>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {(["lowercase", "uppercase", "digits", "symbols"] as const).map(
              (key) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options[key]}
                    onChange={() => toggle(key)}
                  />
                  {t(`generator.${key}`)}
                </label>
              ),
            )}
            <label className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.exclude_ambiguous}
                onChange={() => toggle("exclude_ambiguous")}
              />
              {t("generator.excludeAmbiguous")}
            </label>
          </div>
        </>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void regenerate()}
          className="rounded-vault border border-mist px-3 py-2 text-sm dark:border-navy"
        >
          {t("actions.generate")}
        </button>
        {onUse && (
          <button
            type="button"
            onClick={() => onUse(value)}
            className="rounded-vault bg-emerald px-3 py-2 text-sm font-medium text-white"
          >
            {t("generator.use")}
          </button>
        )}
      </div>
    </div>
  );
}
