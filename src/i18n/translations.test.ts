import { describe, expect, it } from "vitest";

import ar from "./ar.json";
import en from "./en.json";

type Json = Record<string, unknown>;

function flattenKeys(obj: Json, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object") {
      return flattenKeys(value as Json, path);
    }
    return [path];
  });
}

describe("translations", () => {
  it("English and Arabic expose exactly the same keys", () => {
    const enKeys = flattenKeys(en as Json).sort();
    const arKeys = flattenKeys(ar as Json).sort();
    expect(arKeys).toEqual(enKeys);
  });

  it("has no empty translation values", () => {
    for (const [lang, dict] of Object.entries({ en, ar })) {
      const empties = Object.entries(dict as Json).filter(
        ([, value]) => value === "" || value === null,
      );
      expect(empties, `empty values in ${lang}`).toEqual([]);
    }
  });
});
