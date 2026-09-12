import { describe, expect, it } from "vitest";
import { getUnitByNumber } from "./data";
import { scoreUnit } from "./scoring";

describe("scoreUnit", () => {
  it("ranks #18-04 for high potential-indicator review", () => {
    const unit = getUnitByNumber("18-04");

    expect(unit).toBeDefined();
    expect(scoreUnit(unit!).riskLevel).toBe("high");
    expect(scoreUnit(unit!).riskScore).toBeGreaterThanOrEqual(70);
  });

  it("keeps ordinary activity below a potential-indicator review", () => {
    const unit = getUnitByNumber("12-02");

    expect(unit).toBeDefined();
    expect(scoreUnit(unit!).riskLevel).not.toBe("high");
    expect(scoreUnit(unit!).riskScore).toBeLessThan(70);
  });
});
