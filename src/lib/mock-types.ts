import type { AccessActivity, ResidentComplaint, SecurityReport, Unit, VisitorActivity } from "./types";

export type DateWindow = { start: string; end: string };
export type ActivityPeriod = "recent" | "baseline" | "all";
export type MockAccess = AccessActivity & { credentialId: string; holderType: string; result: "granted" | "denied"; accessPoint: string };
export type MockVisitor = VisitorActivity & {
  visitorId: string;
  validFrom: string;
  validUntil: string;
  timestampMeaning: "authorization-start";
  hostDeclared: boolean;
  registrationChannel: string;
  context: "unspecified" | "family" | "maintenance" | "social" | "delivery";
  contextStatus: "self-reported" | "documented";
};
export type MockSecurityReport = SecurityReport & {
  topic: "guest-arrivals" | "family-visit" | "maintenance" | "delivery";
  verification: "unverified" | "corroborated";
  relatedRecordIds: string[];
};
export type MockComplaint = ResidentComplaint & {
  verification: "unverified" | "corroborated" | "withdrawn";
  relatedRecordIds: string[];
  resolution: string | null;
};
export type MockDatabase = {
  metadata: {
    schemaVersion: 1;
    synthetic: true;
    label: string;
    asOf: string;
    building: { name: string; district: string; country: string };
    observationWindow: DateWindow;
    baselineWindow: DateWindow;
    recentWindow: DateWindow;
    limitations: string[];
    sourceFiles: string[];
    availability: { securityReports: { available: boolean; reason: string }; residentComplaints: { available: boolean; reason: string } };
  };
  units: (Omit<Unit, "riskScore" | "riskLevel" | "signals"> & { block: string; registeredOccupants: number; tenancyType: string })[];
  accessActivity: MockAccess[];
  visitorActivity: MockVisitor[];
  securityReports: MockSecurityReport[];
  residentComplaints: MockComplaint[];
};

export type ActivitySummary = {
  period: ActivityPeriod;
  window: DateWindow;
  accessCount: number;
  entryCount: number;
  exitCount: number;
  uniqueCredentials: number;
  visitorCount: number;
  uniqueVisitors: number;
  overnightVisitors: null;
  grantedCount: number;
  deniedCount: number;
  uniqueVisitorCredentials: number;
  shortAuthorizationCount: number;
  lateNightEntries: number;
  familyVisitors: number;
  maintenanceVisitors: number;
};

export type ActivityComparison = {
  baseline: ActivitySummary;
  recent: ActivitySummary;
  all: ActivitySummary;
  changes: { accessCount: number; uniqueCredentials: number; visitorCount: number; uniqueVisitors: number };
  limitations: string[];
};

export type ActivityPage = {
  unitId: string;
  period: ActivityPeriod;
  window: DateWindow;
  offset: number;
  limit: number;
  access: MockAccess[];
  visitors: MockVisitor[];
  totals: { access: number; visitors: number };
  /** The next offset is applied independently to both arrays; an exhausted table returns []. */
  nextOffset: number | null;
  comparison: ActivityComparison;
};
