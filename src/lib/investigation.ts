import Exa from "exa-js";
import OpenAI from "openai";
import {
  getResidentComplaints,
  getSecurityReports,
  getUnitActivity,
  getUnitById,
  getUnitByNumber,
} from "@/lib/data";
import type { CaseReport as SharedCaseReport, InvestigationEvent, InvestigationResponse, Unit } from "@/lib/types";

export type InvestigationTimelineEntry = InvestigationEvent;
export type CaseReport = SharedCaseReport;

export type InvestigationResult = InvestigationResponse & {
  mode: "live" | "demo";
};

type InvestigationOptions = {
  useLiveServices?: boolean;
};

type ToolResult = Record<string, unknown>;

const toolDefinitions = [
  {
    type: "function" as const,
    strict: true,
    name: "get_unit_activity",
    description: "Retrieve internal access and visitor activity for the selected unit.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function" as const,
    strict: true,
    name: "get_security_reports",
    description: "Retrieve internal security observations associated with the selected unit.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function" as const,
    strict: true,
    name: "get_resident_complaints",
    description: "Retrieve resident feedback associated with the selected unit.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function" as const,
    strict: true,
    name: "search_web",
    description: "Search public web sources for potentially related short-stay listings. Public web results are leads, not proof.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    type: "function" as const,
    strict: true,
    name: "create_case_report",
    description: "Create a safety-first report with potential indicators, supporting evidence, uncertainty, and a human-review recommendation.",
    parameters: {
      type: "object",
      properties: {
        potentialIndicators: { type: "array", items: { type: "string" } },
        supportingEvidence: { type: "array", items: { type: "string" } },
        uncertainty: { type: "array", items: { type: "string" } },
      },
      required: ["potentialIndicators", "supportingEvidence", "uncertainty"],
      additionalProperties: false,
    },
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function strings(value: unknown, fallback: string[]): string[] {
  const parsed = asArray(value)
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
  return parsed.length ? parsed : fallback;
}

function safeText(value: unknown): string {
  return JSON.stringify(value, null, 2).slice(0, 3000);
}

function defaultReport(unit: Unit): CaseReport {
  const unitNumber = unit.unitNumber;
  return {
    unitNumber,
    disposition: "Potential indicators — human review recommended",
    summary: `StayWatch identified potential occupancy indicators for unit ${unitNumber}. These signals are not a finding of wrongdoing and require human review.`,
    potentialIndicators: [
      "A combination of access, visitor, or building-observation signals may warrant a closer look.",
    ],
    supportingEvidence: [
      "Internal records were collected for a human reviewer to assess in context.",
    ],
    uncertainty: [
      "Internal records can have legitimate explanations and do not establish the purpose of a stay.",
      "Public-web matches, if any, may be incomplete or unrelated to this unit.",
    ],
    recommendedHumanReview: "Review the evidence in context. Do not accuse residents or make an external report from this screen.",
    confidence: "low",
  };
}

function parseReport(value: unknown, unit: Unit): CaseReport {
  const fallback = defaultReport(unit);
  const candidate = asRecord(value);
  return {
    ...fallback,
    potentialIndicators: strings(candidate.potentialIndicators, fallback.potentialIndicators),
    supportingEvidence: strings(candidate.supportingEvidence, fallback.supportingEvidence),
    uncertainty: strings(candidate.uncertainty, fallback.uncertainty),
  };
}

export async function investigateUnit(unitId: string, options: InvestigationOptions = {}): Promise<InvestigationResult> {
  const unit = getUnitById(unitId) ?? getUnitByNumber(unitId);
  if (!unit) {
    throw new Error("Unit not found");
  }
  const resolvedUnitId = unit.id;

  const timeline: InvestigationTimelineEntry[] = [];
  const record = (tool: string, detail: string) => {
    timeline.push({
      id: `${tool}-${timeline.length + 1}`,
      tool,
      label: tool.replaceAll("_", " "),
      detail,
      status: "complete",
      occurredAt: new Date().toISOString(),
    });
  };

  const activity = () => {
    const result = { accessAndVisitorActivity: getUnitActivity(resolvedUnitId) };
    record("get_unit_activity", "Collected access and visitor activity from building records.");
    return result;
  };
  const security = () => {
    const result = { securityReports: getSecurityReports(resolvedUnitId) };
    record("get_security_reports", "Collected security observations for human assessment.");
    return result;
  };
  const complaints = () => {
    const result = { residentComplaints: getResidentComplaints(resolvedUnitId) };
    record("get_resident_complaints", "Collected resident feedback; it is treated as context, not proof.");
    return result;
  };
  const web = async (query: string): Promise<ToolResult> => {
    if (!process.env.EXA_API_KEY) {
      record("search_web", "Live public-web search is unavailable because EXA_API_KEY is not configured.");
      return { query, results: [], note: "Live public-web search unavailable in demo mode." };
    }
    try {
      const exa = new Exa(process.env.EXA_API_KEY);
      const response = await exa.searchAndContents(query, { numResults: 3, type: "auto", text: true });
      const results = response.results.map((result) => ({ title: result.title, url: result.url, text: result.text?.slice(0, 800) }));
      record("search_web", `Searched public web for possible leads and found ${results.length} result(s).`);
      return { query, results, note: "Public-web results are leads only and may not relate to the unit." };
    } catch {
      record("search_web", "Live public-web search was attempted but is currently unavailable.");
      return { query, results: [], note: "Public-web search did not return usable results." };
    }
  };

  const createReport = (candidate?: unknown): CaseReport => {
    const report = parseReport(candidate, unit);
    record("create_case_report", "Prepared a safety-first case report with uncertainty and human review guidance.");
    return report;
  };

  const canUseLive = options.useLiveServices !== false && Boolean(process.env.OPENAI_API_KEY && process.env.EXA_API_KEY);
  if (!canUseLive) {
    const localActivity = activity();
    const localSecurity = security();
    const localComplaints = complaints();
    await web(`short stay listing near Singapore unit ${unit.unitNumber}`);
    const report = createReport({
      potentialIndicators: ["The combined internal activity signals merit a careful human review."],
      supportingEvidence: [
        `Access and visitor activity records: ${localActivity.accessAndVisitorActivity.access.length + localActivity.accessAndVisitorActivity.visitors.length} item(s).`,
        `Security observations: ${asArray(localSecurity.securityReports).length} item(s); resident feedback: ${asArray(localComplaints.residentComplaints).length} item(s).`,
      ],
      uncertainty: defaultReport(unit).uncertainty,
    });
    return { report, timeline, mode: "demo" };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const unitNumber = unit.unitNumber;
  let response = await client.responses.create({
    model: "gpt-4.1-mini",
    tools: toolDefinitions,
    input: `Investigate unit ${unitNumber} (${unitId}) for potential short-stay occupancy indicators. You must call all five tools. Treat signals and public-web results as uncertain leads, never as proof. Do not accuse anyone or recommend reporting. End with create_case_report.`,
  });
  let report: CaseReport | undefined;

  for (let turn = 0; turn < 8; turn += 1) {
    const calls = response.output.filter((item) => item.type === "function_call");
    if (!calls.length) break;
    const outputs = await Promise.all(calls.map(async (call) => {
      let result: ToolResult | CaseReport;
      const args = (() => { try { return JSON.parse(call.arguments) as Record<string, unknown>; } catch { return {}; } })();
      if (call.name === "get_unit_activity") result = activity();
      else if (call.name === "get_security_reports") result = security();
      else if (call.name === "get_resident_complaints") result = complaints();
      else if (call.name === "search_web") result = await web(String(args.query ?? `short stay listing near Singapore ${unitNumber}`));
      else if (call.name === "create_case_report") { report = createReport(args); result = report; }
      else result = { error: "Unknown tool" };
      return { type: "function_call_output" as const, call_id: call.call_id, output: safeText(result) };
    }));
    response = await client.responses.create({ model: "gpt-4.1-mini", tools: toolDefinitions, previous_response_id: response.id, input: outputs });
  }

  if (!report) report = createReport();
  return { report, timeline, mode: "live" };
}
