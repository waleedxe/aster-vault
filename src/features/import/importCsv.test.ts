import { describe, expect, it } from "vitest";

import { parseCsv, rowsToItems } from "./importCsv";

describe("parseCsv", () => {
  it("splits simple rows and fields", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles quoted fields with commas and escaped quotes", () => {
    const csv = 'name,note\n"North, star","He said ""hi"""';
    expect(parseCsv(csv)).toEqual([
      ["name", "note"],
      ["North, star", 'He said "hi"'],
    ]);
  });
});

describe("rowsToItems", () => {
  it("maps generic columns to login items", () => {
    const csv = [
      "name,url,username,password,note",
      "GitHub,https://github.com,dev,hunter2,work account",
      "Fastmail,https://fastmail.com,me@example.com,pw2,",
    ].join("\n");

    const items = rowsToItems(csv);
    expect(items).toHaveLength(2);
    expect(items[0].item_type).toBe("login");
    expect(items[0].title).toBe("GitHub");
    expect(items[0].fields?.username).toBe("dev");
    expect(items[0].fields?.password).toBe("hunter2");
    expect(items[0].notes).toBe("work account");
    expect(items[1].fields?.url).toBe("https://fastmail.com");
  });

  it("maps a Proton Pass-style header set", () => {
    const csv = [
      "name,username,password,url",
      "Proton,user@proton.me,secret,https://proton.me",
    ].join("\n");
    const items = rowsToItems(csv);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Proton");
    expect(items[0].fields?.password).toBe("secret");
  });

  it("returns nothing for a header-only file", () => {
    expect(rowsToItems("name,password")).toEqual([]);
  });
});
