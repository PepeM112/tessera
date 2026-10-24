import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn", () => {
  it("drops falsy values and merges conflicting Tailwind classes", () => {
    expect(cn("p-2", false, undefined, "p-4")).toBe("p-4");
  });
});
