import importedDatabase from "../../data/mock-building.json";
import type { ActivityComparison, ActivityPage, ActivityPeriod, ActivitySummary, DateWindow, MockDatabase } from "./mock-types";
import type { Unit, UnitSignal } from "./types";

export const mockDatabase = importedDatabase as MockDatabase;
export const accessActivity = mockDatabase.accessActivity;
export const visitorActivity = mockDatabase.visitorActivity;
export const securityReports = mockDatabase.securityReports;
export const residentComplaints = mockDatabase.residentComplaints;

function windowFor(period: ActivityPeriod): DateWindow {
  if (period === "recent") return mockDatabase.metadata.recentWindow;
  if (period === "baseline") return mockDatabase.metadata.baselineWindow;
  return mockDatabase.metadata.observationWindow;
}
function inWindow(occurredAt: string, window: DateWindow): boolean {
  const day = occurredAt.slice(0, 10);
  return day >= window.start && day <= window.end;
}
function scopedActivity(unitId: string, period: ActivityPeriod) {
  const window = windowFor(period);
  return {
    access: accessActivity.filter((record) => record.unitId === unitId && inWindow(record.occurredAt, window)),
    visitors: visitorActivity.filter((record) => record.unitId === unitId && inWindow(record.occurredAt, window)),
  };
}
function summarize(unitId: string, period: ActivityPeriod): ActivitySummary {
  const { access, visitors } = scopedActivity(unitId, period);
  const granted = access.filter((record) => record.result === "granted");
  return {
    period, window: windowFor(period), accessCount: access.length,
    entryCount: granted.filter((record) => record.direction === "entry").length,
    exitCount: granted.filter((record) => record.direction === "exit").length,
    grantedCount: granted.length, deniedCount: access.length - granted.length,
    uniqueCredentials: new Set(granted.map((record) => record.credentialId)).size,
    uniqueVisitorCredentials: new Set(granted.filter((record) => ["visitor_card", "visitor_qr"].includes(record.holderType)).map((record) => record.credentialId)).size,
    visitorCount: visitors.length, uniqueVisitors: new Set(visitors.map((record) => record.visitorId)).size,
    overnightVisitors: null,
    shortAuthorizationCount: visitors.filter((record) => {
      const hours = (Date.parse(record.validUntil) - Date.parse(record.validFrom)) / 3_600_000;
      return hours >= 24 && hours <= 72;
    }).length,
    lateNightEntries: granted.filter((record) => {
      const hour = Number(record.occurredAt.slice(11, 13));
      return record.direction === "entry" && (hour >= 22 || hour < 6);
    }).length,
    familyVisitors: visitors.filter((record) => record.context === "family").length,
    maintenanceVisitors: visitors.filter((record) => record.context === "maintenance").length,
  };
}
function compareActivity(unitId: string): ActivityComparison {
  const baseline = summarize(unitId, "baseline"), recent = summarize(unitId, "recent");
  return {
    baseline, recent, all: summarize(unitId, "all"),
    changes: {
      accessCount: recent.accessCount - baseline.accessCount,
      uniqueCredentials: recent.uniqueCredentials - baseline.uniqueCredentials,
      visitorCount: recent.visitorCount - baseline.visitorCount,
      uniqueVisitors: recent.uniqueVisitors - baseline.uniqueVisitors,
    },
    limitations: [...mockDatabase.metadata.limitations,
      "Visitor counts measure registrations whose authorization starts in the window, not confirmed visits; uniqueVisitors counts registration IDs, not verified people.",
      "Entry/exit and credential metrics count granted access only; accessCount also includes denied attempts. Overnight visitors cannot be measured from these records.",
    ],
  };
}
export function getUnitActivity(unitId: string) {
  return { access: accessActivity.filter((record) => record.unitId === unitId), visitors: visitorActivity.filter((record) => record.unitId === unitId) };
}
export function getSecurityReports(unitId: string) { return securityReports.filter((record) => record.unitId === unitId); }
export function getResidentComplaints(unitId: string) { return residentComplaints.filter((record) => record.unitId === unitId); }

export function getUnitActivityPage(unitId: string, options: { period?: ActivityPeriod; offset?: number; limit?: number } = {}): ActivityPage {
  if (!mockDatabase.units.some((unit) => unit.id === unitId)) throw new Error("Unknown unit");
  const period = options.period ?? "recent", offset = options.offset ?? 0, requestedLimit = options.limit ?? 20;
  if (!["recent", "baseline", "all"].includes(period)) throw new Error("Invalid activity period");
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Offset must be a nonnegative integer");
  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1) throw new Error("Limit must be a positive integer");
  const limit = Math.min(requestedLimit, 50);
  const { access, visitors } = scopedActivity(unitId, period);
  // Both arrays use the same offset independently. An exhausted table returns [].
  const newestFirst = <T extends { occurredAt: string; id: string }>(rows: T[]) => rows.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id));
  return {
    unitId, period, window: windowFor(period), offset, limit,
    access: newestFirst(access).slice(offset, offset + limit), visitors: newestFirst(visitors).slice(offset, offset + limit),
    totals: { access: access.length, visitors: visitors.length },
    nextOffset: offset + limit < Math.max(access.length, visitors.length) ? offset + limit : null,
    comparison: compareActivity(unitId),
  };
}

function deriveSignals(unitId: string): UnitSignal[] {
  const all = summarize(unitId, "all"), comparison = compareActivity(unitId);
  const registrations = getUnitActivity(unitId).visitors.sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const consecutiveWindows = registrations.slice(1).filter((registration, index) => {
    const gapHours = (Date.parse(registration.validFrom) - Date.parse(registrations[index].validUntil)) / 3_600_000;
    return gapHours >= 0 && gapHours <= 24;
  }).length;
  const signals: UnitSignal[] = [];
  if (all.uniqueVisitorCredentials >= 6) signals.push({ id: "multiple-visitor-credentials", category: "access", points: 30,
    title: "Multiple visitor credentials recorded", detail: `${all.uniqueVisitorCredentials} distinct visitor credentials received granted access in August. The two 15-day windows contain ${comparison.baseline.uniqueVisitorCredentials} and ${comparison.recent.uniqueVisitorCredentials}; credentials do not identify distinct people.` });
  if (all.shortAuthorizationCount >= 6) signals.push({ id: "repeated-short-authorizations", category: "visitor", points: 25,
    title: "Repeated short authorization windows", detail: `${all.shortAuthorizationCount} registrations authorize 24–72 hours. Authorization duration is not a measured stay, and stated purposes may have ordinary explanations.` });
  if (consecutiveWindows >= 4) signals.push({ id: "consecutive-authorizations", category: "visitor", points: 20,
    title: "Successive visitor authorizations", detail: `${consecutiveWindows} authorization windows start within 24 hours after the previous one ends. This recurring pattern needs context; it does not establish paid accommodation.` });
  if (all.lateNightEntries >= 4 && all.uniqueVisitorCredentials >= 4) signals.push({ id: "late-access-pattern", category: "access", points: 15,
    title: "Late entries alongside visitor activity", detail: `${all.lateNightEntries} granted entries fall between 22:00 and 06:00, alongside ${all.uniqueVisitorCredentials} visitor credentials. Late hours alone do not establish a concern.` });
  return signals;
}
export const units: Unit[] = mockDatabase.units.map((unit) => ({ ...unit, riskScore: 0, riskLevel: "low", signals: deriveSignals(unit.id) }));
export function getUnitById(id: string): Unit | undefined { return units.find((unit) => unit.id === id); }
export function getUnitByNumber(number: string): Unit | undefined { return units.find((unit) => unit.unitNumber === number); }
export function getMockDataStats() {
  return { units: units.length, accessEvents: accessActivity.length, visitorRegistrations: visitorActivity.length,
    securityReports: securityReports.length, residentComplaints: residentComplaints.length,
    observationWindow: mockDatabase.metadata.observationWindow, synthetic: true as const };
}
