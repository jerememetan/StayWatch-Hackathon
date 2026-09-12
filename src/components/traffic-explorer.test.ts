import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("traffic explorer markup", () => {
  it("does not put React <title> elements inside the SVG chart", () => {
    const source = readFileSync(path.join(__dirname, "traffic-explorer.tsx"), "utf8");
    expect(source).not.toMatch(/<title[\s>]/);
  });
});
