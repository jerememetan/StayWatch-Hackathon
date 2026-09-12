import { describe, expect, it } from "vitest";
import { createReportDownload, parseInvestigationResult, type ReportSnapshot } from "./report-export";

const snapshot: ReportSnapshot = {
  unitId: "UNIT-003",
  completedAt: "2026-09-12T04:30:00.000Z",
  result: {
    mode: "demo",
    report: {
      unitNumber: "A-03-01",
      disposition: "Potential indicators — human review recommended",
      summary: "Local sample-record review.",
      potentialIndicators: ["Recent visitor activity requires context."],
      supportingEvidence: ["ACCESS-003: one recorded entry. web-1: unverified public lead."],
      uncertainty: ["Security reports are unavailable; this is missing evidence."],
      recommendedHumanReview: "Verify ordinary explanations before any conclusion.",
      confidence: "low",
      webSources: [{ id: "web-1", title: "Public area source", url: "https://example.com/area", excerpt: "A broad area result; no unit match." }],
    },
    timeline: [{
      id: "security-1", tool: "get_security_reports", label: "Security reports",
      detail: "Security reports are unavailable.", status: "unavailable", occurredAt: "2026-09-12T04:30:00.000Z",
      input: {}, output: { unitId: "UNIT-003", available: false, records: [], note: "Missing evidence." },
    }],
  },
};

describe("report downloads", () => {
  it("preserves uncertainty, citations and source availability in a portable Markdown report", () => {
    const file = createReportDownload(snapshot, "markdown");
    expect(file.filename).toBe("staywatch-A-03-01-2026-09-12T04-30-00-000Z.md");
    for (const text of ["UNIT-003", snapshot.completedAt, "Offline demo; no live services called", "ACCESS-003", "https://example.com/area", "web-1", snapshot.result.report.uncertainty[0], "Security reports (unavailable)", '"available": false']) {
      expect(file.content).toContain(text);
    }
    expect(file.content).not.toContain("\\n##");
  });

  it("preserves the complete report and actual tool responses in JSON with run metadata", () => {
    const file = createReportDownload({ ...snapshot, result: { ...snapshot.result, mode: "live" } }, "json");
    const value = JSON.parse(file.content);
    expect(value).toMatchObject({ unitId: snapshot.unitId, completedAt: snapshot.completedAt, mode: "live" });
    expect(value.report).toEqual(snapshot.result.report);
    expect(value.timeline).toEqual(snapshot.result.timeline);
    expect(value.context).toContain("fictional");
  });

  it("does not turn an empty source list into evidence that no listings exist", () => {
    const file = createReportDownload({ ...snapshot, result: { ...snapshot.result, report: { ...snapshot.result.report, webSources: [] } } }, "markdown");
    expect(file.content).toContain("No public sources were retrieved.");
    expect(file.content).toContain(snapshot.result.report.uncertainty[0]);
  });
});

describe("client investigation response validation", () => {
  it("accepts a complete response without changing the underlying source data", () => {
    expect(parseInvestigationResult(snapshot.result)).toBe(snapshot.result);
  });

  it.each([
    null,
    { ...snapshot.result, mode: undefined },
    { ...snapshot.result, mode: ["live"] },
    { ...snapshot.result, timeline: [{ ...snapshot.result.timeline[0], occurredAt: "not a date" }] },
    { ...snapshot.result, timeline: [{ ...snapshot.result.timeline[0], status: "running" }] },
    { ...snapshot.result, report: { ...snapshot.result.report, uncertainty: null } },
    { ...snapshot.result, report: { ...snapshot.result.report, webSources: [{ ...snapshot.result.report.webSources![0], url: "javascript:alert(1)" }] } },
  ])("rejects incomplete or unsafe response data with a recoverable error", (value) => {
    expect(() => parseInvestigationResult(value)).toThrow("The service returned an incomplete report. Please try again.");
  });
});
