import type {
  AccessActivity,
  ResidentComplaint,
  SecurityReport,
  Unit,
  VisitorActivity,
} from "./types";

export const units: Unit[] = [
  {
    id: "unit-18-04",
    unitNumber: "18-04",
    residentLabel: "Registered household",
    floor: 18,
    bedrooms: 2,
    riskScore: 0,
    riskLevel: "low",
    signals: [
      {
        id: "access-turnover",
        category: "access",
        title: "Unusually frequent credential turnover",
        detail: "Several different valid credentials were used during short stays over 14 days.",
        points: 30,
      },
      {
        id: "visitor-frequency",
        category: "visitor",
        title: "Repeated short visitor stays",
        detail: "Visitor log entries show several brief, consecutive stays with different names.",
        points: 24,
      },
      {
        id: "security-observation",
        category: "security",
        title: "Security observation requires context",
        detail: "A staff note records luggage arrivals; it does not establish purpose or identity.",
        points: 16,
      },
      {
        id: "neighbour-concern",
        category: "complaint",
        title: "Neighbour concern received",
        detail: "A nearby resident reported late-night corridor activity; the report is unverified.",
        points: 12,
      },
    ],
  },
  {
    id: "unit-12-02",
    unitNumber: "12-02",
    residentLabel: "Registered household",
    floor: 12,
    bedrooms: 3,
    riskScore: 0,
    riskLevel: "low",
    signals: [
      {
        id: "expected-visitor",
        category: "visitor",
        title: "Recorded family visit",
        detail: "One visitor entry aligns with a normal weekend family visit.",
        points: 8,
      },
    ],
  },
  {
    id: "unit-09-11",
    unitNumber: "09-11",
    residentLabel: "Registered household",
    floor: 9,
    bedrooms: 1,
    riskScore: 0,
    riskLevel: "low",
    signals: [],
  },
  {
    id: "unit-21-07",
    unitNumber: "21-07",
    residentLabel: "Registered household",
    floor: 21,
    bedrooms: 2,
    riskScore: 0,
    riskLevel: "low",
    signals: [
      {
        id: "one-security-note",
        category: "security",
        title: "Single delivery-related note",
        detail: "A single staff note describes a delivery delay.",
        points: 10,
      },
    ],
  },
];

export const accessActivity: AccessActivity[] = [
  { id: "access-1804-1", unitId: "unit-18-04", occurredAt: "2026-09-09T22:18:00+08:00", direction: "entry", credentialLabel: "Valid credential A", note: "Evening entry recorded." },
  { id: "access-1804-2", unitId: "unit-18-04", occurredAt: "2026-09-10T09:42:00+08:00", direction: "exit", credentialLabel: "Valid credential A", note: "Morning exit recorded." },
  { id: "access-1804-3", unitId: "unit-18-04", occurredAt: "2026-09-10T17:06:00+08:00", direction: "entry", credentialLabel: "Valid credential B", note: "Different valid credential recorded." },
  { id: "access-1804-4", unitId: "unit-18-04", occurredAt: "2026-09-12T13:20:00+08:00", direction: "entry", credentialLabel: "Valid credential C", note: "Different valid credential recorded." },
  { id: "access-1202-1", unitId: "unit-12-02", occurredAt: "2026-09-08T11:00:00+08:00", direction: "entry", credentialLabel: "Registered credential", note: "Weekend entry recorded." },
];

export const visitorActivity: VisitorActivity[] = [
  { id: "visitor-1804-1", unitId: "unit-18-04", occurredAt: "2026-09-09T22:06:00+08:00", visitorLabel: "Visitor 1", purpose: "Not stated", note: "Signed in with one overnight bag." },
  { id: "visitor-1804-2", unitId: "unit-18-04", occurredAt: "2026-09-10T16:51:00+08:00", visitorLabel: "Visitor 2", purpose: "Not stated", note: "Signed in for unit 18-04." },
  { id: "visitor-1804-3", unitId: "unit-18-04", occurredAt: "2026-09-12T13:07:00+08:00", visitorLabel: "Visitor 3", purpose: "Not stated", note: "Signed in with rolling luggage." },
  { id: "visitor-1202-1", unitId: "unit-12-02", occurredAt: "2026-09-08T10:48:00+08:00", visitorLabel: "Family visitor", purpose: "Family visit", note: "Signed in for a daytime visit." },
];

export const securityReports: SecurityReport[] = [
  { id: "security-1804-1", unitId: "unit-18-04", occurredAt: "2026-09-10T17:10:00+08:00", observation: "Staff observed a visitor with luggage at the lift lobby. No rule breach was observed.", status: "noted" },
  { id: "security-2107-1", unitId: "unit-21-07", occurredAt: "2026-09-07T15:00:00+08:00", observation: "Delivery vehicle waited briefly at the loading bay.", status: "noted" },
];

export const residentComplaints: ResidentComplaint[] = [
  { id: "complaint-1804-1", unitId: "unit-18-04", occurredAt: "2026-09-11T08:30:00+08:00", concern: "A nearby resident reported late-night corridor activity on two evenings.", status: "received" },
];

export function getUnitById(id: string): Unit | undefined {
  return units.find((unit) => unit.id === id);
}

export function getUnitByNumber(unitNumber: string): Unit | undefined {
  return units.find((unit) => unit.unitNumber === unitNumber);
}

export function getUnitActivity(unitId: string): { access: AccessActivity[]; visitors: VisitorActivity[] } {
  return {
    access: accessActivity.filter((activity) => activity.unitId === unitId),
    visitors: visitorActivity.filter((activity) => activity.unitId === unitId),
  };
}

export function getSecurityReports(unitId: string): SecurityReport[] {
  return securityReports.filter((report) => report.unitId === unitId);
}

export function getResidentComplaints(unitId: string): ResidentComplaint[] {
  return residentComplaints.filter((complaint) => complaint.unitId === unitId);
}
