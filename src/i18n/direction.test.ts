import { describe, expect, it } from "vitest";

import { applyDirection, directionFor, isRtl } from "./direction";

describe("direction helpers", () => {
  it("treats Arabic as RTL and English as LTR", () => {
    expect(isRtl("ar")).toBe(true);
    expect(isRtl("en")).toBe(false);
    expect(directionFor("ar")).toBe("rtl");
    expect(directionFor("en")).toBe("ltr");
  });

  it("applies lang and dir to the document root", () => {
    applyDirection("ar");
    expect(document.documentElement.getAttribute("dir")).toBe("rtl");
    expect(document.documentElement.getAttribute("lang")).toBe("ar");

    applyDirection("en");
    expect(document.documentElement.getAttribute("dir")).toBe("ltr");
    expect(document.documentElement.getAttribute("lang")).toBe("en");
  });
});
