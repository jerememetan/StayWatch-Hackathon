import { describe, expect, it } from "vitest";
import { investigateUnit } from "./investigation";

describe("investigateUnit", () => {
  it("returns a safety-first local investigation when live credentials are unavailable", async () => {
    const result = await investigateUnit("18-04", { useLiveServices: false });

    expect(result.report.unitNumber).toBe("18-04");
    expect(result.report.recommendedHumanReview).toMatch(/review/i);
    expect(result.report.potentialIndicators.length).toBeGreaterThan(0);
    expect(result.report.uncertainty.length).toBeGreaterThan(0);
    expect(result.timeline.map((entry) => entry.tool)).toEqual([
      "get_unit_activity",
      "get_security_reports",
      "get_resident_complaints",
      "search_web",
      "create_case_report",
    ]);
  });
});
