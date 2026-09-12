import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const run = vi.hoisted(() => vi.fn());
vi.mock("@/lib/investigation", () => ({ investigateUnit: run }));
beforeEach(() => { run.mockReset(); });

function request(body: unknown) {
  return new Request("http://localhost/api/investigate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("investigation route", () => {
  it.each([null, [], "UNIT-003", 4, {}, { unitId: " " }, { unitId: 3 }])("rejects malformed input %j without starting a run", async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });

  it("returns the investigation for a selected unit", async () => {
    run.mockResolvedValue({ mode: "live", report: { unitNumber: "A-03-01" }, timeline: [] });
    const response = await POST(request({ unitId: " UNIT-003 " }));
    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledWith("UNIT-003");
    expect((await response.json()).report.unitNumber).toBe("A-03-01");
  });

  it("returns not found for an unknown unit", async () => {
    run.mockRejectedValue(new Error("Unit not found"));
    expect((await POST(request({ unitId: "missing" }))).status).toBe(404);
  });

  it("does not expose raw provider diagnostics or secrets in a failure", async () => {
    run.mockRejectedValue(new Error("upstream invalid api key sk-do-not-display"));
    const response = await POST(request({ unitId: "UNIT-003" }));
    expect(response.status).toBe(500);
    const output = await response.text();
    expect(output).not.toContain("sk-do-not-display");
    expect(output).toMatch(/retry/i);
  });
});
