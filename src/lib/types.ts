export type RiskLevel = "low" | "medium" | "high";

export type UnitSignal = {
  id: string;
  title: string;
  detail: string;
  points: number;
  category: "access" | "visitor" | "security" | "complaint";
};

export type Unit = {
  id: string;
  unitNumber: string;
  residentLabel: string;
  floor: number;
  bedrooms: number;
  riskScore: number;
  riskLevel: RiskLevel;
  signals: UnitSignal[];
};

export type AccessActivity = {
  id: string;
  unitId: string;
  occurredAt: string;
  direction: "entry" | "exit";
  credentialLabel: string;
  note: string;
};

export type VisitorActivity = {
  id: string;
  unitId: string;
  occurredAt: string;
  visitorLabel: string;
  purpose: string;
  note: string;
};

export type SecurityReport = {
  id: string;
  unitId: string;
  occurredAt: string;
  observation: string;
  status: "open" | "noted";
};

export type ResidentComplaint = {
  id: string;
  unitId: string;
  occurredAt: string;
  concern: string;
  status: "received" | "reviewed";
};

export type InvestigationEvent = {
  id: string;
  tool: string;
  label: string;
  detail: string;
  status: "complete";
  occurredAt: string;
};

export type CaseReport = {
  unitNumber: string;
  disposition: string;
  summary: string;
  potentialIndicators: string[];
  supportingEvidence: string[];
  uncertainty: string[];
  recommendedHumanReview: string;
  confidence: "low" | "medium" | "high";
};

export type InvestigationResponse = {
  report: CaseReport;
  timeline: InvestigationEvent[];
};
