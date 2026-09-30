import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  MoreVertical,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";

import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  Menu,
  Select,
  Spinner,
  Textarea,
  toast,
} from "../../components/ui";
import { GeneratorPanel } from "../generator/GeneratorPanel";
import { useClipboard } from "../../hooks/useClipboard";
import * as api from "../../lib/tauri";
import type { ItemDto, ItemInput, ItemType } from "../../lib/tauri";
import { getRememberedBackupDir } from "../../lib/paths";
import { useSettingsStore } from "../../stores/settingsStore";
import { filterByView, useVaultStore } from "../../stores/vaultStore";

interface FieldSpec {
  key: string;
  labelKey: string;
  secret?: boolean;
  link?: boolean;
}

const FIELD_SCHEMA: Record<ItemType, FieldSpec[]> = {
  login: [
    { key: "username", labelKey: "fields.username" },
    { key: "password", labelKey: "fields.password", secret: true },
    { key: "url", labelKey: "fields.url", link: true },
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

function subtitleFor(item: ItemDto): string {
  return (
    item.fields.username ||
    item.fields.url ||
    item.fields.email ||
    item.notes ||
    ""
  );
}

/** The main vault screen: list/grid, detail, and editor. */
export function VaultView() {
  const { t } = useTranslation();
  const items = useVaultStore((state) => state.items);
  const view = useVaultStore((state) => state.view);
  const selectedId = useVaultStore((state) => state.selectedId);
  const select = useVaultStore((state) => state.select);
  const refresh = useVaultStore((state) => state.refresh);
  const busy = useVaultStore((state) => state.busy);

  const [editing, setEditing] = useState<ItemDto | "new" | null>(null);
  const [reusedCount, setReusedCount] = useState(0);
  const [sort, setSort] = useState<"name" | "updated">("name");
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const [backup, setBackup] = useState<{ has: boolean; text: string | null }>({
    has: false,
    text: null,
  });

  useEffect(() => {
    void api
      .reusedPasswordCount()
      .then(setReusedCount)
      .catch(() => setReusedCount(0));
  }, [items]);

  useEffect(() => {
    const dir = getRememberedBackupDir();
    if (!dir) return;
    let active = true;
    void api
      .secondsSinceLatestBackup(dir)
      .then((age) => {
        if (!active) return;
        if (age == null) {
          setBackup({ has: false, text: null });
        } else {
          setBackup({
            has: true,
            text: new Date(Date.now() - age * 1000).toLocaleString(),
          });
        }
      })
      .catch(() => {
        if (active) setBackup({ has: false, text: null });
      });
    return () => {
      active = false;
    };
  }, [items]);

  const visible = filterByView(items, view);
  const sorted = useMemo(() => {
    const copy = [...visible];
    copy.sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title)
        : b.updated_at - a.updated_at,
    );
    return copy;
  }, [visible, sort]);

  const selected = sorted.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="flex min-h-0 flex-1">
      <section className="flex w-1/2 min-w-72 flex-col border-e border-mist dark:border-navy">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <h2 className="text-section font-semibold">
            {t("nav.allItems")}{" "}
            <span className="text-sm font-normal text-muted tnum">
              {sorted.length}
            </span>
          </h2>
          <div className="flex items-center gap-2">
            {reusedCount > 0 && (
              <Badge tone="amber">
                {t("vault.reused", { count: reusedCount })}
              </Badge>
            )}
            <Menu
              label={t("home.sort")}
              trigger={
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  {t("home.sort")}:{" "}
                  {sort === "name" ? t("home.sortName") : t("home.sortUpdated")}
                </span>
              }
              items={[
                {
                  id: "name",
                  label: t("home.sortName"),
                  onSelect: () => setSort("name"),
                },
                {
                  id: "updated",
                  label: t("home.sortUpdated"),
                  onSelect: () => setSort("updated"),
                },
              ]}
            />
            <IconButton
              label={t("home.list")}
              size="sm"
              active={layout === "list"}
              onClick={() => setLayout("list")}
            >
              <List className="h-4 w-4" />
            </IconButton>
            <IconButton
              label={t("home.grid")}
              size="sm"
              active={layout === "grid"}
              onClick={() => setLayout("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </IconButton>
            <Button
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setEditing("new")}
            >
              {t("actions.new")}
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {busy && sorted.length === 0 ? (
            <div className="flex justify-center p-10 text-muted">
              <Spinner size={24} />
            </div>
          ) : sorted.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={t("vault.empty")}
                description={t("home.subtitle")}
                action={
                  <Button
                    size="sm"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={() => setEditing("new")}
                  >
                    {t("actions.new")}
                  </Button>
                }
              />
            </div>
          ) : layout === "list" ? (
            <ul>
              {sorted.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  active={item.id === selectedId}
                  onSelect={() => select(item.id)}
                  onEdit={() => setEditing(item)}
                  onChanged={() => void refresh()}
                />
              ))}
            </ul>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-4">
              {sorted.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => select(item.id)}
                  className={
                    "flex flex-col items-start gap-2 rounded-card border p-4 text-start transition-colors duration-[var(--duration-fast)] " +
                    (item.id === selectedId
                      ? "border-emerald bg-mint/40 dark:bg-navy-deep"
                      : "border-mist hover:bg-mist/40 dark:border-navy dark:hover:bg-navy/30")
                  }
                >
                  <Avatar name={item.title} />
                  <span className="w-full truncate text-sm font-medium">
                    {item.title || t("vault.untitled")}
                  </span>
                  <span className="w-full truncate text-xs text-muted">
                    {t(`type.${item.item_type}`)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="flex-1 overflow-auto p-6">
        {selected ? (
          <ItemDetail
            item={selected}
            backup={backup}
            onEdit={() => setEditing(selected)}
            onChanged={() => void refresh()}
          />
        ) : (
          <EmptyState title={t("vault.selectItem")} />
        )}
      </section>

      <ItemEditor
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        item={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          setEditing(null);
          void refresh().then(() => select(saved.id));
        }}
      />
    </div>
  );
}

function ItemRow({
  item,
  active,
  onSelect,
  onEdit,
  onChanged,
}: {
  item: ItemDto;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  return (
    <li
      className={
        "flex items-center gap-3 border-b border-mist/60 px-4 py-2 dark:border-navy/60 " +
        (active
          ? "bg-mint/40 dark:bg-navy-deep"
          : "hover:bg-mist/40 dark:hover:bg-navy/30")
      }
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <Avatar name={item.title} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {item.title || t("vault.untitled")}
          </span>
          <span className="block truncate text-xs text-muted">
            {subtitleFor(item)}
          </span>
        </span>
      </button>
      <IconButton
        label={t("actions.favorite")}
        size="sm"
        onClick={() => void api.toggleFavorite(item.id).then(onChanged)}
      >
        <Star
          className={
            "h-4 w-4 " + (item.favorite ? "fill-amber text-amber" : "")
          }
        />
      </IconButton>
      <Menu
        label={t("actions.edit")}
        trigger={<MoreVertical className="h-4 w-4" />}
        items={[
          {
            id: "edit",
            label: t("actions.edit"),
            icon: <Pencil className="h-4 w-4" />,
            onSelect: onEdit,
          },
          {
            id: "delete",
            label: t("actions.delete"),
            icon: <Trash2 className="h-4 w-4" />,
            danger: true,
            onSelect: () => void api.deleteItem(item.id).then(onChanged),
          },
        ]}
      />
    </li>
  );
}

function ItemDetail({
  item,
  backup,
  onEdit,
  onChanged,
}: {
  item: ItemDto;
  backup: { has: boolean; text: string | null };
  onEdit: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { copy } = useClipboard();
  const clearSeconds = useSettingsStore((state) => state.clipboardClearSeconds);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const specs = FIELD_SCHEMA[item.item_type];

  const doCopy = async (field: string, value: string) => {
    const ok = await copy(field, value, clearSeconds);
    if (ok)
      toast(t("common.copiedClearing", { seconds: clearSeconds }), "emerald");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={item.title} size={56} />
          <div>
            <h2 className="text-title font-semibold">
              {item.title || t("vault.untitled")}
            </h2>
            <p className="text-sm text-muted">
              {t(`type.${item.item_type}`)} · {t("home.vault")}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <IconButton
            label={t("actions.favorite")}
            onClick={() => void api.toggleFavorite(item.id).then(onChanged)}
          >
            <Star
              className={
                "h-4 w-4 " + (item.favorite ? "fill-amber text-amber" : "")
              }
            />
          </IconButton>
          <IconButton label={t("actions.edit")} onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton
            label={t("actions.delete")}
            onClick={() => void api.deleteItem(item.id).then(onChanged)}
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </header>

      {specs.map((spec) => {
        const value = item.fields[spec.key] ?? "";
        if (!value) return null;
        const shown =
          spec.secret && !revealed[spec.key]
            ? "•".repeat(Math.min(value.length, 18))
            : value;
        return (
          <Card key={spec.key} className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-2xs text-muted">{t(spec.labelKey)}</span>
              <span className="flex items-center gap-1">
                {spec.secret && (
                  <IconButton
                    label={
                      revealed[spec.key]
                        ? t("actions.hide")
                        : t("actions.reveal")
                    }
                    size="sm"
                    onClick={() =>
                      setRevealed((previous) => ({
                        ...previous,
                        [spec.key]: !previous[spec.key],
                      }))
                    }
                  >
                    {revealed[spec.key] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </IconButton>
                )}
                {spec.link && (
                  <IconButton
                    label={t("actions.open")}
                    size="sm"
                    onClick={() => void openUrl(value).catch(() => undefined)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </IconButton>
                )}
                <IconButton
                  label={t("actions.copy")}
                  size="sm"
                  onClick={() => void doCopy(spec.key, value)}
                >
                  <Copy className="h-4 w-4" />
                </IconButton>
              </span>
            </div>
            <div className="mt-1 break-all text-sm tnum">{shown}</div>
          </Card>
        );
      })}

      {item.notes && (
        <Card className="p-3">
          <span className="text-2xs text-muted">{t("fields.notes")}</span>
          <div className="mt-1 whitespace-pre-wrap text-sm">{item.notes}</div>
        </Card>
      )}

      <Card
        tone="raised"
        className="flex items-center gap-3 border-emerald/40 p-4"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald/12 text-emerald-text">
          <ExternalLink className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium text-emerald-text">
            {backup.has ? t("home.backupVerified") : t("home.noBackup")}
          </p>
          <p className="text-xs text-muted">
            {t("home.lastBackup")}: {backup.text ?? t("home.noBackup")}
          </p>
        </div>
      </Card>
    </div>
  );
}

function ItemEditor({
  item,
  open,
  onClose,
  onSaved,
}: {
  item: ItemDto | null;
  open: boolean;
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
  const [favorite, setFavorite] = useState(item?.favorite ?? false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const specs = FIELD_SCHEMA[type];

  const save = async () => {
    const input: ItemInput = {
      item_type: type,
      title: title || t("vault.untitled"),
      notes,
      fields,
      favorite,
    };
    setBusy(true);
    try {
      const saved = item
        ? await api.updateItem(item.id, input)
        : await api.createItem(input);
      onSaved(saved);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={item ? t("actions.edit") : t("actions.new")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("actions.cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {t("actions.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {!item && (
          <Select
            label={t("fields.type")}
            value={type}
            onChange={(event) => setType(event.target.value as ItemType)}
          >
            {ITEM_TYPES.map((option) => (
              <option key={option} value={option}>
                {t(`type.${option}`)}
              </option>
            ))}
          </Select>
        )}

        <Input
          label={t("fields.title")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {specs.map((spec) => (
          <div key={spec.key} className="flex items-end gap-2">
            <Input
              label={t(spec.labelKey)}
              type={spec.secret ? "password" : "text"}
              value={fields[spec.key] ?? ""}
              onChange={(event) =>
                setFields((previous) => ({
                  ...previous,
                  [spec.key]: event.target.value,
                }))
              }
            />
            {spec.secret && (
              <Button
                variant="secondary"
                onClick={() => setShowGenerator((v) => !v)}
              >
                {t("actions.generate")}
              </Button>
            )}
          </div>
        ))}

        {showGenerator && (
          <GeneratorPanel
            onUse={(value) => {
              setFields((previous) => ({ ...previous, password: value }));
              setShowGenerator(false);
            }}
          />
        )}

        <Textarea
          label={t("fields.notes")}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <Checkbox
          checked={favorite}
          onChange={(e) => setFavorite(e.target.checked)}
        >
          {t("actions.favorite")}
        </Checkbox>

        {error && <p className="text-sm text-amber-text">{error}</p>}
      </div>
    </Dialog>
  );
}
