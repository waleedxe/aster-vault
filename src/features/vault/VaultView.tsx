import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Pencil, Star, Trash2 } from "lucide-react";

import { GeneratorPanel } from "../generator/GeneratorPanel";
import { useClipboard } from "../../hooks/useClipboard";
import * as api from "../../lib/tauri";
import type { ItemDto, ItemInput, ItemType } from "../../lib/tauri";
import { useSettingsStore } from "../../stores/settingsStore";
import { filterByView, useVaultStore } from "../../stores/vaultStore";

interface FieldSpec {
  key: string;
  labelKey: string;
  secret?: boolean;
}

const FIELD_SCHEMA: Record<ItemType, FieldSpec[]> = {
  login: [
    { key: "username", labelKey: "fields.username" },
    { key: "password", labelKey: "fields.password", secret: true },
    { key: "url", labelKey: "fields.url" },
  ],
  note: [],
  card: [
    { key: "holder", labelKey: "fields.holder" },
    { key: "number", labelKey: "fields.number", secret: true },
    { key: "expiry", labelKey: "fields.expiry" },
    { key: "cvv", labelKey: "fields.cvv", secret: true },
  ],
  identity: [
    { key: "full_name", labelKey: "fields.fullName" },
    { key: "email", labelKey: "fields.email" },
    { key: "phone", labelKey: "fields.phone" },
    { key: "address", labelKey: "fields.address" },
  ],
  totp: [{ key: "secret", labelKey: "fields.secret", secret: true }],
};

const ITEM_TYPES: ItemType[] = ["login", "note", "card", "identity", "totp"];

/** The main vault screen: list, detail, and editor. */
export function VaultView() {
  const { t } = useTranslation();
  const items = useVaultStore((state) => state.items);
  const view = useVaultStore((state) => state.view);
  const query = useVaultStore((state) => state.query);
  const setQuery = useVaultStore((state) => state.setQuery);
  const selectedId = useVaultStore((state) => state.selectedId);
  const select = useVaultStore((state) => state.select);
  const refresh = useVaultStore((state) => state.refresh);

  const [editing, setEditing] = useState<ItemDto | "new" | null>(null);
  const [reusedCount, setReusedCount] = useState(0);

  useEffect(() => {
    void api
      .reusedPasswordCount()
      .then(setReusedCount)
      .catch(() => setReusedCount(0));
  }, [items]);

  const visible = filterByView(items, view);
  const selected = visible.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="flex h-full">
      <section className="flex w-1/2 min-w-72 flex-col border-e border-mist dark:border-navy">
        <div className="flex items-center gap-2 border-b border-mist p-4 dark:border-navy">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("vault.search")}
            className="w-full rounded-vault border border-mist bg-transparent px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-emerald dark:border-navy"
          />
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="min-h-10 shrink-0 rounded-vault bg-emerald px-3 py-2 text-sm font-medium text-white"
          >
            {t("actions.new")}
          </button>
        </div>

        {reusedCount > 0 && (
          <p role="status" className="px-4 py-2 text-xs text-amber">
            {t("vault.reused", { count: reusedCount })}
          </p>
        )}

        <ul className="flex-1 overflow-auto">
          {visible.length === 0 && (
            <li className="p-6 text-sm text-muted">{t("vault.empty")}</li>
          )}
          {visible.map((item) => {
            const active = item.id === selectedId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => select(item.id)}
                  className={
                    "flex w-full items-center gap-3 border-b border-mist/60 px-4 py-3 text-start dark:border-navy/60 " +
                    (active
                      ? "bg-mint/50 dark:bg-midnight"
                      : "hover:bg-mist/40 dark:hover:bg-navy/30")
                  }
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-9 w-9 shrink-0 rounded-[10px] bg-emerald/80"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {item.title || t("vault.untitled")}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {t(`type.${item.item_type}`)}
                      {item.fields.username ? ` · ${item.fields.username}` : ""}
                    </span>
                  </span>
                  {item.favorite && (
                    <Star
                      className="h-4 w-4 fill-amber text-amber"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex-1 overflow-auto p-6">
        {selected ? (
          <ItemDetail
            item={selected}
            onEdit={() => setEditing(selected)}
            onChanged={() => void refresh()}
          />
        ) : (
          <p className="text-sm text-muted">{t("vault.selectItem")}</p>
        )}
      </section>

      {editing && (
        <ItemEditor
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            void refresh().then(() => select(saved.id));
          }}
        />
      )}
    </div>
  );
}

function ItemDetail({
  item,
  onEdit,
  onChanged,
}: {
  item: ItemDto;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { copy, copiedField, secondsLeft } = useClipboard();
  const clearSeconds = useSettingsStore((state) => state.clipboardClearSeconds);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const specs = FIELD_SCHEMA[item.item_type];

  const doCopy = (key: string, value: string) =>
    void copy(key, value, clearSeconds);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">
            {item.title || t("vault.untitled")}
          </h2>
          <p className="text-sm text-muted">{t(`type.${item.item_type}`)}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label={t("actions.favorite")}
            onClick={() =>
              void api.toggleFavorite(item.id).then(() => onChanged())
            }
            className="rounded-vault border border-mist p-2 dark:border-navy"
          >
            <Star
              className={
                "h-4 w-4 " +
                (item.favorite ? "fill-amber text-amber" : "text-muted")
              }
            />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-2 rounded-vault border border-mist px-3 py-2 text-sm dark:border-navy"
          >
            <Pencil className="h-4 w-4" /> {t("actions.edit")}
          </button>
          <button
            type="button"
            onClick={() => void api.deleteItem(item.id).then(() => onChanged())}
            className="flex items-center gap-2 rounded-vault border border-mist px-3 py-2 text-sm text-amber dark:border-navy"
          >
            <Trash2 className="h-4 w-4" /> {t("actions.delete")}
          </button>
        </div>
      </header>

      <dl className="space-y-3">
        {specs.map((spec) => {
          const value = item.fields[spec.key] ?? "";
          if (!value) return null;
          const shown =
            spec.secret && !revealed[spec.key]
              ? "•".repeat(Math.min(value.length, 16))
              : value;
          return (
            <div
              key={spec.key}
              className="rounded-vault border border-mist p-3 dark:border-navy"
            >
              <dt className="text-xs text-muted">{t(spec.labelKey)}</dt>
              <dd className="mt-1 flex items-center justify-between gap-2">
                <span className="break-all text-sm tnum">{shown}</span>
                <span className="flex shrink-0 gap-1">
                  {spec.secret && (
                    <button
                      type="button"
                      onClick={() =>
                        setRevealed((previous) => ({
                          ...previous,
                          [spec.key]: !previous[spec.key],
                        }))
                      }
                      className="rounded p-1 text-xs text-muted hover:text-ink dark:hover:text-porcelain"
                    >
                      {revealed[spec.key]
                        ? t("actions.hide")
                        : t("actions.reveal")}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={t("actions.copy")}
                    onClick={() => doCopy(spec.key, value)}
                    className="rounded p-1 text-muted hover:text-ink dark:hover:text-porcelain"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </span>
              </dd>
              {copiedField === spec.key && (
                <p role="status" className="mt-1 text-xs text-emerald">
                  {t("common.copiedClearing", { seconds: secondsLeft })}
                </p>
              )}
            </div>
          );
        })}
        {item.notes && (
          <div className="rounded-vault border border-mist p-3 dark:border-navy">
            <dt className="text-xs text-muted">{t("fields.notes")}</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm">{item.notes}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function ItemEditor({
  item,
  onClose,
  onSaved,
}: {
  item: ItemDto | null;
  onClose: () => void;
  onSaved: (saved: ItemDto) => void;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState<ItemType>(item?.item_type ?? "login");
  const [title, setTitle] = useState(item?.title ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [fields, setFields] = useState<Record<string, string>>(
    item?.fields ?? {},
  );
  const [showGenerator, setShowGenerator] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const specs = FIELD_SCHEMA[type];

  const save = async () => {
    const input: ItemInput = {
      item_type: type,
      title: title || t("vault.untitled"),
      notes,
      fields,
    };
    try {
      const saved = item
        ? await api.updateItem(item.id, input)
        : await api.createItem(input);
      onSaved(saved);
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-20 flex items-center justify-center bg-midnight/50 p-4"
    >
      <div className="max-h-full w-full max-w-lg overflow-auto rounded-vault bg-porcelain p-6 dark:bg-navy">
        <h2 className="text-lg font-semibold">
          {item ? t("actions.edit") : t("actions.new")}
        </h2>

        {!item && (
          <label className="mt-4 block text-sm">
            {t("fields.type")}
            <select
              value={type}
              onChange={(event) => setType(event.target.value as ItemType)}
              className="mt-1 w-full rounded-vault border border-mist bg-transparent px-3 py-2 dark:border-navy"
            >
              {ITEM_TYPES.map((option) => (
                <option key={option} value={option}>
                  {t(`type.${option}`)}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="mt-3 block text-sm">
          {t("fields.title")}
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-vault border border-mist bg-transparent px-3 py-2 dark:border-navy"
          />
        </label>

        {specs.map((spec) => (
          <label key={spec.key} className="mt-3 block text-sm">
            {t(spec.labelKey)}
            <div className="mt-1 flex gap-2">
              <input
                type={spec.secret ? "password" : "text"}
                value={fields[spec.key] ?? ""}
                onChange={(event) =>
                  setFields((previous) => ({
                    ...previous,
                    [spec.key]: event.target.value,
                  }))
                }
                className="w-full rounded-vault border border-mist bg-transparent px-3 py-2 dark:border-navy"
              />
              {spec.secret && (
                <button
                  type="button"
                  onClick={() => setShowGenerator((v) => !v)}
                  className="shrink-0 rounded-vault border border-mist px-3 text-sm dark:border-navy"
                >
                  {t("actions.generate")}
                </button>
              )}
            </div>
          </label>
        ))}

        {showGenerator && (
          <div className="mt-3">
            <GeneratorPanel
              onUse={(value) => {
                setFields((previous) => ({ ...previous, password: value }));
                setShowGenerator(false);
              }}
            />
          </div>
        )}

        <label className="mt-3 block text-sm">
          {t("fields.notes")}
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-vault border border-mist bg-transparent px-3 py-2 dark:border-navy"
          />
        </label>

        {error && <p className="mt-3 text-sm text-amber">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-vault border border-mist px-4 py-2 text-sm dark:border-navy"
          >
            {t("actions.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            className="min-h-10 rounded-vault bg-emerald px-4 py-2 text-sm font-medium text-white"
          >
            {t("actions.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
