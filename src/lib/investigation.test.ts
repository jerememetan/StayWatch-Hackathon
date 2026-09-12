import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { investigateUnit } from "./investigation";

const services = vi.hoisted(() => ({ responses: vi.fn(), search: vi.fn() }));
vi.mock("openai", () => ({ default: class { responses = { create: services.responses }; } }));
vi.mock("exa-js", () => ({ default: class { searchAndContents = services.search; } }));

function tool(name: string, args: Record<string, unknown> = {}) {
  return { id: `response-${name}`, output: [{ type: "function_call", name, arguments: JSON.stringify(args), call_id: `call-${name}` }] };
}

const reportArgs = {
  summary: "Several potential indicators warrant checking the context.",
  potentialIndicators: ["Visitor records require comparison with the baseline."],
  supportingEvidence: ["The selected unit's recent and baseline records were retrieved."],
  uncertainty: ["Visitor purpose and payment are not established by building records."],
  recommendedHumanReview: "Review the visitor register and any available legitimate explanations.",
  confidence: "low",
};

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key-never-logged");
  vi.stubEnv("EXA_API_KEY", "test-key-never-logged");
  services.responses.mockReset();
  services.search.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("investigateUnit", () => {
  it("returns a safety-first local investigation when live credentials are unavailable", async () => {
    const result = await investigateUnit("A-03-01", { useLiveServices: false });

    expect(result.report.unitNumber).toBe("A-03-01");
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
    expect(services.responses).not.toHaveBeenCalled();
    expect(services.search).not.toHaveBeenCalled();
    expect(result.timeline.find((entry) => entry.tool === "search_web")?.status).toBe("unavailable");
  });

  it("passes complete paginated JSON from the selected unit back to the model", async () => {
    const requests: unknown[] = [];
    const sequence = [
      tool("get_unit_activity", { period: "recent", offset: 0 }),
      tool("get_security_reports"),
      tool("get_resident_complaints"),
      tool("search_web", { query: "Marina View Singapore short stay apartments" }),
      tool("create_case_report", reportArgs),
    ];
    services.responses.mockImplementation(async (request) => {
      requests.push(JSON.parse(JSON.stringify(request)));
      return sequence.shift();
    });
    services.search.mockResolvedValue({ results: [{ title: "Broad area result", url: "https://example.com/listing", text: "An unrelated listing in Singapore." }] });

    const result = await investigateUnit("A-03-01");
    expect(result.mode).toBe("live");
    expect(services.responses).toHaveBeenCalledTimes(5);
    expect(services.search).toHaveBeenCalledTimes(1);
    const second = requests[1] as { input: { type: string; output?: string }[] };
    const serialized = second.input.find((item) => item.type === "function_call_output")!.output!;
    expect(serialized.length).toBeGreaterThan(3000);
    const payload = JSON.parse(serialized);
    expect(payload.unitId).toBe("UNIT-003");
    expect(payload.access.length).toBeLessThanOrEqual(20);
    expect(payload.access.every((row: { unitId: string }) => row.unitId === "UNIT-003")).toBe(true);
    expect(payload.comparison.recent.visitorCount).toBeGreaterThanOrEqual(0);
    expect(payload.comparison.baseline.visitorCount).toBeGreaterThanOrEqual(0);
    expect(result.timeline[0].input).toEqual({ period: "recent", offset: 0 });
    expect(result.timeline[0].output).toEqual(payload);
    expect(result.report.summary).toBe(reportArgs.summary);
    expect(result.report.webSources?.[0].url).toBe("https://example.com/listing");
  });

  it("rejects a premature report and never claims an unfinished live run completed", async () => {
    services.responses.mockResolvedValueOnce(tool("create_case_report", reportArgs));
    services.responses.mockResolvedValueOnce({ id: "no-tools", output: [] });
    await expect(investigateUnit("A-03-01")).rejects.toThrow(/did not complete/i);
    const nextInput = services.responses.mock.calls[1][0].input;
    expect(JSON.parse(nextInput.find((item: { type: string }) => item.type === "function_call_output").output).error).toMatch(/internal records/i);
  });

  it("records an unavailable web lookup without substituting invented listings", async () => {
    [tool("get_unit_activity", { period: "baseline", offset: 0 }), tool("get_security_reports"), tool("get_resident_complaints"), tool("search_web", { query: "Marina View Singapore short stay" }), tool("create_case_report", reportArgs)]
      .forEach((response) => services.responses.mockResolvedValueOnce(response));
    services.search.mockRejectedValue(new Error("upstream secret diagnostic"));
    const result = await investigateUnit("A-03-01");
    const web = result.timeline.find((entry) => entry.tool === "search_web")!;
    expect(web.status).toBe("unavailable");
    expect(JSON.stringify(result)).not.toContain("upstream secret diagnostic");
    expect(result.report.webSources).toEqual([]);
    expect(result.report.uncertainty.join(" ")).toMatch(/unavailable/i);
  });

  it("rejects cross-unit arguments and malformed arguments before querying records", async () => {
    const requests: { input: { type: string; output?: string }[] }[] = [];
    const sequence = [
      tool("get_unit_activity", { period: "recent", offset: 0, unitId: "UNIT-007" }),
      { output: [{ type: "function_call", name: "get_unit_activity", arguments: "null", call_id: "bad-json" }] },
      tool("get_unit_activity", { period: "recent", offset: 0 }),
      tool("get_security_reports"), tool("get_resident_complaints"), tool("create_case_report", reportArgs),
    ];
    services.responses.mockImplementation(async (request) => {
      requests.push(JSON.parse(JSON.stringify(request)));
      return sequence.shift();
    });
    const result = await investigateUnit("UNIT-003");
    expect(result.timeline.slice(0, 2).every((entry) => entry.status === "error")).toBe(true);
    const outputs = requests[3].input.filter((item) => item.type === "function_call_output").map((item) => JSON.parse(item.output!));
    expect(outputs.slice(0, 2).every((item) => item.error)).toBe(true);
    expect(outputs[2].unitId).toBe("UNIT-003");
    expect(outputs[2].access.every((row: { unitId: string }) => row.unitId === "UNIT-003")).toBe(true);
    expect(result.report.uncertainty.join(" ")).toMatch(/no public-web search/i);
  });

  it("uses OpenAI when Exa is not configured and preserves the missing-source gap", async () => {
    vi.stubEnv("EXA_API_KEY", "");
    [tool("get_unit_activity", { period: "recent", offset: 0 }), tool("get_security_reports"), tool("get_resident_complaints"), tool("search_web", { query: "Marina View Singapore short stay" }), tool("create_case_report", reportArgs)]
      .forEach((response) => services.responses.mockResolvedValueOnce(response));
    const result = await investigateUnit("A-03-01");
    expect(result.mode).toBe("live");
    expect(services.search).not.toHaveBeenCalled();
    expect(result.report.uncertainty.join(" ")).toMatch(/EXA_API_KEY is not configured/);
    for (const name of ["get_security_reports", "get_resident_complaints"]) {
      expect(result.timeline.find((entry) => entry.tool === name)?.status).toBe("unavailable");
    }
    for (const [request] of services.responses.mock.calls) {
      expect(request.store).toBe(false);
      expect(request.instructions).toMatch(/untrusted evidence/);
      expect(request.previous_response_id).toBeUndefined();
    }
  });

  it("bounds model turns and never manufactures a report after repeated tool calls", async () => {
    services.responses.mockResolvedValue(tool("get_unit_activity", { period: "recent", offset: 0 }));
    await expect(investigateUnit("A-03-01")).rejects.toThrow(/did not complete/i);
    expect(services.responses).toHaveBeenCalledTimes(12);
  });

  it("requires a structurally valid report instead of coercing invalid model arguments", async () => {
    [tool("get_unit_activity", { period: "recent", offset: 0 }), tool("get_security_reports"), tool("get_resident_complaints"),
      tool("create_case_report", { ...reportArgs, confidence: ["low"] }), tool("create_case_report", reportArgs)]
      .forEach((response) => services.responses.mockResolvedValueOnce(response));
    const result = await investigateUnit("A-03-01");
    expect(result.timeline.at(-2)?.status).toBe("error");
    expect(result.timeline.at(-1)?.status).toBe("complete");
    expect(result.report.confidence).toBe("low");
  });

  it.each([
    { field: "summary", value: "No denied entry attempts or security incidents (unitId: UNIT-003)." },
    { field: "potentialIndicators", value: ["No resident complaints for the unit."] },
    { field: "supportingEvidence", value: ["No denied entry attempts or security incidents (unitId: UNIT-003).", "No resident complaints for the unit."] },
  ])("revises unsupported source-absence claims in $field", async ({ field, value }) => {
    const corrected = { ...reportArgs, supportingEvidence: [
      "No security reports are available in the supplied dataset.",
      "No resident complaint data available; whether complaints occurred remains unknown.",
    ] };
    [tool("get_unit_activity", { period: "recent", offset: 0 }), tool("get_security_reports"), tool("get_resident_complaints"),
      tool("create_case_report", { ...reportArgs, [field]: value }), tool("create_case_report", corrected)]
      .forEach((response) => services.responses.mockResolvedValueOnce(response));
    const result = await investigateUnit("A-03-01");
    const rejected = result.timeline.at(-2)!;
    expect(rejected.tool).toBe("create_case_report");
    expect(rejected.status).toBe("error");
    expect((rejected.output as { error: string }).error).toMatch(/unavailable.*revise/i);
    expect(result.timeline.at(-1)?.status).toBe("complete");
    expect(result.report.supportingEvidence).toEqual(corrected.supportingEvidence);
    expect(result.report.summary).toBe(corrected.summary);
    expect(result.report.potentialIndicators).toEqual(corrected.potentialIndicators);
    expect(JSON.stringify(result.report)).not.toMatch(/no denied entry attempts or security incidents|no resident complaints for the unit/i);
    expect(services.responses).toHaveBeenCalledTimes(5);
  });

  it("limits web queries and preserves only returned HTTP or HTTPS citations", async () => {
    [tool("get_unit_activity", { period: "recent", offset: 0 }), tool("get_security_reports"), tool("get_resident_complaints"),
      tool("search_web", { query: "Marina View Singapore short stay" }), tool("search_web", { query: "Marina View Singapore nightly apartment" }), tool("search_web", { query: "Marina View Singapore rental" }), tool("create_case_report", reportArgs)]
      .forEach((response) => services.responses.mockResolvedValueOnce(response));
    services.search.mockResolvedValue({ results: [
      { title: "Unsafe scheme", url: "javascript:alert(1)", text: "Not a public source." },
      { title: "Returned URL", url: "https://example.com/actual-source", text: "Unverified broad area listing." },
    ] });
    const result = await investigateUnit("A-03-01");
    expect(services.search).toHaveBeenCalledTimes(2);
    expect(result.report.webSources).toHaveLength(1);
    expect(result.report.webSources?.[0].url).toBe("https://example.com/actual-source");
    expect(result.report.uncertainty.join(" ")).toMatch(/two-search limit/);
  });
});
