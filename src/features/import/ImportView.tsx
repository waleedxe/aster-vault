import { useState } from "react";
import { useTranslation } from "react-i18next";

import * as api from "../../lib/tauri";
import type { ItemInput } from "../../lib/tauri";
import { useVaultStore } from "../../stores/vaultStore";
import { rowsToItems } from "./importCsv";

/** Import screen. Everything is parsed locally; nothing is uploaded. */
export function ImportView() {
  const { t } = useTranslation();
  const refresh = useVaultStore((state) => state.refresh);
  const [source, setSource] = useState<"generic" | "proton">("generic");
  const [fileName, setFileName] = useState<string | null>(null);
  const [items, setItems] = useState<ItemInput[]>([]);
  const [result, setResult] = useState<string | null>(null);

  const onFile = async (file: File) => {
    const text = await file.text();
    setFileName(file.name);
    setItems(rowsToItems(text));
    setResult(null);
  };

  const doImport = async () => {
    let count = 0;
    for (const item of items) {
      await api.createItem(item);
      count += 1;
    }
    setResult(t("import.result", { count }));
    setItems([]);
    await refresh();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">{t("import.title")}</h1>
      <p className="rounded-vault border border-amber/60 bg-amber/10 p-3 text-sm text-amber">
        {t("import.intro")}
      </p>

      <section className="space-y-3 rounded-vault border border-mist p-4 dark:border-navy">
        <label className="block text-sm">
          {t("import.source")}
          <select
            value={source}
            onChange={(event) =>
              setSource(event.target.value as "generic" | "proton")
            }
            className="mt-1 w-full rounded-vault border border-mist bg-transparent px-3 py-2 dark:border-navy"
          >
            <option value="generic">{t("import.genericCsv")}</option>
            <option value="proton">{t("import.protonPass")}</option>
          </select>
        </label>

        <label className="block text-sm">
          {t("import.chooseFile")}
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
            }}
            className="mt-1 block w-full text-sm"
          />
        </label>

        {fileName && (
          <p className="text-sm text-muted">
            {fileName} — {items.length} {t("nav.allItems")}
          </p>
        )}

        <button
          type="button"
          onClick={() => void doImport()}
          disabled={items.length === 0}
          className="rounded-vault bg-emerald px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {t("import.import")}
        </button>
        {result && (
          <p role="status" className="text-sm text-emerald">
            {result}
          </p>
        )}
      </section>
    </div>
  );
}
