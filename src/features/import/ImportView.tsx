import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, Card, Select, toast } from "../../components/ui";
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
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    const text = await file.text();
    setFileName(file.name);
    setItems(rowsToItems(text));
  };

  const doImport = async () => {
    setBusy(true);
    let count = 0;
    try {
      for (const item of items) {
        await api.createItem(item);
        count += 1;
      }
      toast(t("import.result", { count }), "emerald");
      setItems([]);
      await refresh();
    } catch (err) {
      toast(String(err), "amber");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-title font-semibold">{t("import.title")}</h1>
      <Card className="border-amber/50 bg-amber/10 p-4">
        <p className="text-sm text-amber-text">{t("import.intro")}</p>
      </Card>

      <Card className="space-y-4 p-4">
        <Select
          label={t("import.source")}
          value={source}
          onChange={(event) =>
            setSource(event.target.value as "generic" | "proton")
          }
        >
          <option value="generic">{t("import.genericCsv")}</option>
          <option value="proton">{t("import.protonPass")}</option>
        </Select>

        <label className="block text-sm">
          {t("import.chooseFile")}
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
            }}
            className="mt-1 block w-full text-sm text-muted file:me-3 file:rounded-control file:border file:border-mist file:bg-transparent file:px-3 file:py-1.5 file:text-sm dark:file:border-navy"
          />
        </label>

        {fileName && (
          <p className="text-sm text-muted">
            {fileName} — {items.length} {t("nav.allItems")}
          </p>
        )}

        <Button
          disabled={items.length === 0 || busy}
          onClick={() => void doImport()}
        >
          {t("import.import")}
        </Button>
      </Card>
    </div>
  );
}
