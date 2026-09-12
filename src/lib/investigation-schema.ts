import type { FunctionTool } from "openai/resources/responses/responses";

const emptyParameters = { type: "object", properties: {}, required: [], additionalProperties: false };
const textList = { type: "array", items: { type: "string" } };

export const investigationTools: FunctionTool[] = [
  {
    type: "function", name: "get_unit_activity", strict: true,
    description: "Query the selected unit's mock access and visitor records. Returns a page (20 per table), whole-period totals and a recent/baseline comparison. Start with period recent, offset 0. Use nextOffset to inspect more records or period baseline to check the comparison. Credential authorization is not evidence of an actual stay.",
    parameters: {
      type: "object", additionalProperties: false,
      properties: { period: { type: "string", enum: ["recent", "baseline", "all"] }, offset: { type: "integer", minimum: 0 } },
      required: ["period", "offset"],
    },
  },
  {
    type: "function", name: "get_security_reports", strict: true,
    description: "Read security observations for this unit. An unavailable source means evidence is missing, not that no incidents occurred.",
    parameters: emptyParameters,
  },
  {
    type: "function", name: "get_resident_complaints", strict: true,
    description: "Read resident feedback for this unit, retaining verification status. An unavailable source must be stated as an evidence gap.",
    parameters: emptyParameters,
  },
  {
    type: "function", name: "search_web", strict: true,
    description: "Use Exa to search public sources when internal evidence warrants checking a listing lead. Query using broad location/property description, never names or credential IDs. The property is fictional; real results cannot establish a match to the synthetic unit. At most two searches.",
    parameters: { type: "object", additionalProperties: false, properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    type: "function", name: "create_case_report", strict: true,
    description: "Finish the investigation after querying all three internal sources. Summarize only retrieved evidence and cite source record IDs or summary counts in supportingEvidence. Include ordinary explanations, missing evidence and next human verification steps. Explain why no web search was warranted if you skipped it. Never infer immigration status or wrongdoing.",
    parameters: {
      type: "object", additionalProperties: false,
      properties: {
        summary: { type: "string" },
        potentialIndicators: textList, supportingEvidence: textList, uncertainty: textList,
        recommendedHumanReview: { type: "string" }, confidence: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["summary", "potentialIndicators", "supportingEvidence", "uncertainty", "recommendedHumanReview", "confidence"],
    },
  },
];
