import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { accessActivity, getMockDataStats, getResidentComplaints, getSecurityReports, getUnitActivity, getUnitActivityPage, getUnitById, getUnitByNumber, mockDatabase, units, visitorActivity } from "./data";
import { scoreUnit } from "./scoring";
import type { ActivityPeriod } from "./mock-types";

describe("imported synthetic mock database", () => {
  it("preserves all supplied operational rows and original unit identifiers", () => {
    expect(getMockDataStats()).toMatchObject({ units: 24, accessEvents: 2898, visitorRegistrations: 48, synthetic: true });
    expect(getUnitByNumber("A-03-01")?.id).toBe("UNIT-003");
    expect(getUnitByNumber("18-04")).toBeUndefined();
    expect(mockDatabase.units[0]).toMatchObject({ block: "A", registeredOccupants: 1, tenancyType: "owner_occupied" });
    const rows = [...units, ...accessActivity, ...visitorActivity];
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    const unitIds = new Set(units.map((unit) => unit.id));
    for (const row of [...accessActivity, ...visitorActivity]) {
      expect(unitIds.has(row.unitId)).toBe(true);
      expect(Number.isFinite(Date.parse(row.occurredAt))).toBe(true);
      expect(row.occurredAt.slice(0, 10) >= "2026-08-01").toBe(true);
      expect(row.occurredAt.slice(0, 10) <= "2026-08-31").toBe(true);
    }
  });

  it("recreates the committed database exactly from the unmodified source", () => {
    const result = execFileSync(process.execPath, ["scripts/import-mock-data.mjs", "--check"], { cwd: process.cwd(), encoding: "utf8" });
    expect(result).toContain("matches the supplied source exactly");
  });

  it("ignores checkout line endings while still rejecting changed imported records", () => {
    const fixture = mkdtempSync(join(tmpdir(), "staywatch-import-"));
    try {
      for (const directory of ["scripts", "data", "staywatch_demo_dataset"]) mkdirSync(join(fixture, directory));
      copyFileSync("scripts/import-mock-data.mjs", join(fixture, "scripts/import-mock-data.mjs"));
      for (const file of mockDatabase.metadata.sourceFiles) {
        copyFileSync(join("staywatch_demo_dataset", file), join(fixture, "staywatch_demo_dataset", file));
      }
      const databasePath = join(fixture, "data/mock-building.json");
      const database = readFileSync("data/mock-building.json", "utf8").replace(/\r\n/g, "\n");
      const check = () => execFileSync(process.execPath, ["scripts/import-mock-data.mjs", "--check"], { cwd: fixture, encoding: "utf8", stdio: "pipe" });
      for (const newline of ["\n", "\r\n"]) {
        writeFileSync(databasePath, database.replace(/\n/g, newline));
        expect(check()).toContain("matches the supplied source exactly");
      }
      const changed = JSON.parse(database);
      changed.accessActivity[0].direction = changed.accessActivity[0].direction === "entry" ? "exit" : "entry";
      writeFileSync(databasePath, `${JSON.stringify(changed, null, 2)}\n`);
      expect(check).toThrow("Imported mock database differs from the source");
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("does not turn authorization dates into measured visits or map credentials to people", () => {
    for (const visitor of visitorActivity) {
      expect(visitor.timestampMeaning).toBe("authorization-start");
      expect(visitor.occurredAt).toBe(visitor.validFrom);
      expect(Date.parse(visitor.validUntil)).toBeGreaterThanOrEqual(Date.parse(visitor.validFrom));
      expect(visitor).not.toHaveProperty("departedAt");
      expect(visitor).not.toHaveProperty("credentialId");
    }
    for (const event of accessActivity) expect(event).not.toHaveProperty("visitorId");
    expect(getUnitActivityPage("UNIT-003").comparison.all.overnightVisitors).toBeNull();
  });

  it("excludes preset case labels and fake web evidence from operational inputs", () => {
    expect(mockDatabase.metadata.sourceFiles).toEqual(["property_and_units.json", "access_events.csv", "visitor_registrations.csv"]);
    for (const unit of mockDatabase.units) {
      expect(unit).not.toHaveProperty("demo_profile");
      expect(unit).not.toHaveProperty("risk_score");
      expect(unit).not.toHaveProperty("signals");
    }
    expect(mockDatabase).not.toHaveProperty("webFindings");
    expect(mockDatabase).not.toHaveProperty("expectedCases");
    expect(mockDatabase.metadata.availability.securityReports.available).toBe(false);
    expect(mockDatabase.metadata.availability.residentComplaints.available).toBe(false);
    expect(getSecurityReports("UNIT-003")).toEqual([]);
    expect(getResidentComplaints("UNIT-003")).toEqual([]);
  });

  it("compares equal 15-day windows using the full records independently of pagination", () => {
    const first = getUnitActivityPage("UNIT-003", { limit: 1 });
    const last = getUnitActivityPage("UNIT-003", { offset: 40, limit: 1 });
    expect(first.comparison).toEqual(last.comparison);
    for (const summary of [first.comparison.baseline, first.comparison.recent]) {
      expect((Date.parse(summary.window.end) - Date.parse(summary.window.start)) / 86_400_000 + 1).toBe(15);
      const actual = getUnitActivity("UNIT-003").access.filter((row) => row.occurredAt.slice(0, 10) >= summary.window.start && row.occurredAt.slice(0, 10) <= summary.window.end);
      expect(summary.accessCount).toBe(actual.length);
      expect(summary.grantedCount + summary.deniedCount).toBe(summary.accessCount);
      expect(summary.entryCount + summary.exitCount).toBe(summary.grantedCount);
    }
    expect(first.comparison.all.accessCount).toBe(getUnitActivity("UNIT-003").access.length);
    expect(first.comparison.all.uniqueVisitorCredentials).toBe(10);
    expect(first.comparison.all.shortAuthorizationCount).toBe(10);
    expect(first.comparison.recent.visitorCount).toBeLessThan(first.comparison.baseline.visitorCount);
    expect(first.comparison.changes.visitorCount).toBe(first.comparison.recent.visitorCount - first.comparison.baseline.visitorCount);
  });

  it("paginates both tables completely without duplicates or cross-unit leakage", () => {
    const accessIds: string[] = [], visitorIds: string[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page = getUnitActivityPage("UNIT-003", { period: "all", offset, limit: 7 });
      expect(page.access.length).toBeLessThanOrEqual(7);
      expect(page.visitors.length).toBeLessThanOrEqual(7);
      expect([...page.access, ...page.visitors].every((row) => row.unitId === "UNIT-003")).toBe(true);
      accessIds.push(...page.access.map((row) => row.id));
      visitorIds.push(...page.visitors.map((row) => row.id));
      offset = page.nextOffset;
    }
    expect(accessIds.sort()).toEqual(getUnitActivity("UNIT-003").access.map((row) => row.id).sort());
    expect(visitorIds.sort()).toEqual(getUnitActivity("UNIT-003").visitors.map((row) => row.id).sort());
    expect(new Set(accessIds).size).toBe(accessIds.length);
    const exhausted = getUnitActivityPage("UNIT-003", { offset: 100_000 });
    expect(exhausted.access).toEqual([]);
    expect(exhausted.visitors).toEqual([]);
    expect(exhausted.nextOffset).toBeNull();
  });

  it("bounds and validates data queries", () => {
    expect(getUnitActivityPage("UNIT-003").limit).toBe(20);
    expect(getUnitActivityPage("UNIT-003", { limit: 999 }).limit).toBe(50);
    expect(() => getUnitActivityPage("missing")).toThrow("Unknown unit");
    expect(() => getUnitActivityPage("UNIT-003", { period: "tomorrow" as ActivityPeriod })).toThrow("period");
    for (const offset of [-1, 0.5, NaN, Infinity]) expect(() => getUnitActivityPage("UNIT-003", { offset })).toThrow("Offset");
    for (const limit of [0, -1, 1.5, NaN]) expect(() => getUnitActivityPage("UNIT-003", { limit })).toThrow("Limit");
  });

  it("derives review indicators from recorded patterns while keeping the ordinary unit low", () => {
    const main = scoreUnit(getUnitById("UNIT-003")!);
    const other = scoreUnit(getUnitByNumber("A-07-02")!);
    const ordinary = scoreUnit(getUnitByNumber("B-03-02")!);
    expect(main.riskScore).toBeGreaterThanOrEqual(70);
    expect(main.signals.map((signal) => signal.id)).toEqual(expect.arrayContaining(["multiple-visitor-credentials", "repeated-short-authorizations", "consecutive-authorizations"]));
    expect(getUnitActivityPage(other.id).comparison.all.uniqueVisitorCredentials).toBeGreaterThanOrEqual(6);
    expect(other.riskScore).toBeGreaterThan(ordinary.riskScore);
    expect(ordinary.riskLevel).toBe("low");
    expect(units.flatMap((unit) => unit.signals).every((signal) => !["security", "complaint"].includes(signal.category))).toBe(true);
  });
});
