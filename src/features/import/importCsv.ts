import type { ItemInput } from "../../lib/tauri";

/** Parse a CSV string into rows, handling simple quoted fields. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

function headerIndex(headers: string[], candidates: string[]): number {
  return headers.findIndex((header) =>
    candidates.includes(header.trim().toLowerCase()),
  );
}

/**
 * Build item inputs from CSV rows using header mapping.
 *
 * Handles generic CSV exports and Proton Pass CSV exports (which share the same
 * header names). Parsing is entirely local; nothing is uploaded.
 */
export function rowsToItems(text: string): ItemInput[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim().toLowerCase());

  const titleIndex = headerIndex(headers, ["name", "title", "item"]);
  const usernameIndex = headerIndex(headers, [
    "username",
    "user",
    "email",
    "login",
  ]);
  const passwordIndex = headerIndex(headers, ["password", "pass"]);
  const urlIndex = headerIndex(headers, ["url", "website", "uri", "login_uri"]);
  const noteIndex = headerIndex(headers, ["note", "notes", "extra"]);
  const totpIndex = headerIndex(headers, ["totp", "otp"]);

  const items: ItemInput[] = [];
  for (const row of rows.slice(1)) {
    const fields: Record<string, string> = {};
    if (usernameIndex >= 0 && row[usernameIndex])
      fields.username = row[usernameIndex];
    if (passwordIndex >= 0 && row[passwordIndex])
      fields.password = row[passwordIndex];
    if (urlIndex >= 0 && row[urlIndex]) fields.url = row[urlIndex];
    if (totpIndex >= 0 && row[totpIndex]) fields.secret = row[totpIndex];

    const hasPassword = passwordIndex >= 0 && Boolean(row[passwordIndex]);
    const itemType =
      !hasPassword && totpIndex >= 0 && row[totpIndex] ? "totp" : "login";
    items.push({
      item_type: itemType,
      title: (titleIndex >= 0 && row[titleIndex]) || "Imported item",
      fields,
      notes: (noteIndex >= 0 && row[noteIndex]) || "",
    });
  }
  return items;
}
