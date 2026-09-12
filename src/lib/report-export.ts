import type { InvestigationResponse } from "@/lib/types";

type InvestigationResult = InvestigationResponse & { mode: "live" | "demo" };

export type ReportSnapshot = {
  unitId: string;
  completedAt: string;
  result: InvestigationResult;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isPublicUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}

export function parseInvestigationResult(value: unknown): InvestigationResult {
  const invalid = () => { throw new Error("The service returned an incomplete report. Please try again."); };
  if (!isRecord(value) || !isRecord(value.report) || !Array.isArray(value.timeline)) return invalid();
  const report = value.report;
  if (typeof value.mode !== "string" || !["live", "demo"].includes(value.mode) ||
    !["unitNumber", "disposition", "summary", "recommendedHumanReview"].every((key) => typeof report[key] === "string") ||
    !["potentialIndicators", "supportingEvidence", "uncertainty"].every((key) => isTextList(report[key])) ||
    typeof report.confidence !== "string" || !["low", "medium", "high"].includes(report.confidence)) return invalid();
  if (report.webSources !== undefined && (!Array.isArray(report.webSources) || !report.webSources.every((source) =>
    isRecord(source) && ["id", "title", "excerpt"].every((key) => typeof source[key] === "string") && isPublicUrl(source.url)))) return invalid();
  if (!value.timeline.every((event) => isRecord(event) &&
    ["id", "tool", "label", "detail", "occurredAt"].every((key) => typeof event[key] === "string") &&
    Number.isFinite(Date.parse(String(event.occurredAt))) &&
    typeof event.status === "string" && ["complete", "unavailable", "error"].includes(event.status) &&
    (event.input === undefined || isRecord(event.input)))) return invalid();
  return value as InvestigationResult;
}

function textList(items: string[], emptyText: string) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : emptyText;
}

export function createReportDownload(snapshot: ReportSnapshot, format: "markdown" | "json") {
  const { unitId, completedAt, result } = snapshot;
  const { report, timeline, mode } = result;
  const basename = `staywatch-${report.unitNumber.replace(/[^a-zA-Z0-9-]/g, "-")}-${new Date(completedAt).toISOString().replace(/[:.]/g, "-")}`;
  const context = "All property and building records are fictional sample data. Public sources are unverified leads and cannot identify this synthetic unit. This report requires human review and does not establish wrongdoing.";

  if (format === "json") {
    return {
      filename: `${basename}.json`,
      mimeType: "application/json;charset=utf-8",
      content: JSON.stringify({ unitId, completedAt, mode, context, report, timeline }, null, 2),
    };
  }

  const sections = [
    `# StayWatch case report — Unit ${report.unitNumber}`,
    `- Unit ID: ${unitId}\n- Completed: ${completedAt}\n- Mode: ${mode === "live" ? "Live AI with sample building records" : "Offline demo; no live services called"}\n- Confidence: ${report.confidence}`,
    context,
    `## Disposition\n\n${report.disposition}`,
    `## Summary\n\n${report.summary}`,
    `## Potential indicators\n\n${textList(report.potentialIndicators, "No potential indicators returned.")}`,
    `## Supporting evidence\n\n${textList(report.supportingEvidence, "No supporting evidence returned.")}`,
    `## Uncertainty\n\n${textList(report.uncertainty, "No uncertainty notes returned; human review is still required.")}`,
    `## Recommended human review\n\n${report.recommendedHumanReview}`,
    `## Public sources\n\n${report.webSources?.length
      ? report.webSources.map((source) => `### ${source.id}: ${source.title}\n\n${source.url}\n\n${source.excerpt}`).join("\n\n")
      : "No public sources were retrieved. Refer to source checks and uncertainty for the available evidence."}`,
    `## Source checks\n\n${timeline.length ? timeline.map((event) => [
      `### ${event.label} (${event.status})`,
      `- Tool: ${event.tool}\n- Event ID: ${event.id}\n- Recorded: ${event.occurredAt}`,
      event.detail,
      `Query and returned evidence:\n\n${JSON.stringify({ input: event.input ?? {}, output: event.output ?? null }, null, 2).split("\n").map((line) => `    ${line}`).join("\n")}`,
    ].join("\n\n")).join("\n\n") : "No source-check details were returned."}`,
  ];

  return { filename: `${basename}.md`, mimeType: "text/markdown;charset=utf-8", content: `${sections.join("\n\n")}\n` };
}
