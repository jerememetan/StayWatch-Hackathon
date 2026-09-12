import { mkdir, readFile, writeFile } from "node:fs/promises";

// Only these operational source files are imported. Demo answers, precomputed
// risk labels and simulated web findings are deliberately excluded.
const source = new URL("../staywatch_demo_dataset/", import.meta.url);
const output = new URL("../data/mock-building.json", import.meta.url);
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index++; }
      else quoted = !quoted;
    } else if (!quoted && (char === "," || char === "\n")) {
      row.push(field.replace(/\r$/, "")); field = "";
      if (char === "\n") { rows.push(row); row = []; }
    } else field += char;
  }
  if (quoted) throw new Error("Unterminated CSV quote");
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const headers = rows.shift();
  if (!headers) throw new Error("CSV is empty");
  return rows.filter((cells) => cells.some(Boolean)).map((cells) => {
    if (cells.length !== headers.length) throw new Error("CSV column count mismatch");
    return Object.fromEntries(headers.map((header, index) => [header, cells[index]]));
  });
}
const property = JSON.parse(await readFile(new URL("property_and_units.json", source), "utf8"));
const accessRows = parseCsv(await readFile(new URL("access_events.csv", source), "utf8"));
const visitorRows = parseCsv(await readFile(new URL("visitor_registrations.csv", source), "utf8"));
const units = property.units.map((unit) => ({
  id: unit.unit_id, unitNumber: unit.unit_number, floor: unit.floor, bedrooms: unit.bedrooms,
  block: unit.block, registeredOccupants: unit.registered_occupants, tenancyType: unit.tenancy_type,
  residentLabel: "Registered household (synthetic)",
}));
const unitIds = new Map(units.map((unit) => [unit.unitNumber, unit.id]));
function unitId(number) {
  const id = unitIds.get(number);
  if (!id) throw new Error(`Unknown unit ${number}`);
  return id;
}
function timestamp(value) {
  if (!/^2026-08-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error(`Invalid timestamp ${value}`);
  return value;
}
const accessActivity = accessRows.map((row) => {
  if (!["entry", "exit"].includes(row.direction) || !["granted", "denied"].includes(row.result)) throw new Error("Invalid access event");
  return {
    id: row.event_id, unitId: unitId(row.unit_number), occurredAt: timestamp(row.timestamp), direction: row.direction,
    credentialId: row.credential_id, credentialLabel: row.credential_id, holderType: row.holder_type,
    accessPoint: row.access_point, result: row.result,
    note: `Synthetic ${row.holder_type} access event: ${row.result}. Credential use does not identify a person or establish visit purpose.`,
  };
});
const visitorActivity = visitorRows.map((row) => {
  const validFrom = timestamp(row.valid_from), validUntil = timestamp(row.valid_until);
  if (Date.parse(validUntil) < Date.parse(validFrom)) throw new Error("Invalid authorization window");
  if (!["True", "False"].includes(row.host_declared)) throw new Error("Invalid host-declared flag");
  const contexts = { family_visit: "family", friend_visit: "social", delivery_support: "delivery" };
  return {
    id: row.visitor_id, visitorId: row.visitor_id, unitId: unitId(row.unit_number),
    occurredAt: validFrom, timestampMeaning: "authorization-start", validFrom, validUntil,
    visitorLabel: row.visitor_alias, purpose: row.declared_purpose,
    hostDeclared: row.host_declared === "True", registrationChannel: row.registration_channel,
    context: contexts[row.declared_purpose] ?? "unspecified", contextStatus: "self-reported",
    note: "Synthetic registration. These dates describe permission to visit, not confirmed arrival, departure or stay duration. No credential-to-visitor mapping was supplied.",
  };
});
for (const records of [units, accessActivity, visitorActivity]) {
  if (new Set(records.map((record) => record.id)).size !== records.length) throw new Error("Duplicate record IDs");
}
for (const records of [accessActivity, visitorActivity]) records.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
const database = {
  metadata: {
    schemaVersion: 1, synthetic: true,
    label: "User-supplied synthetic StayWatch dataset. Property, units, credentials and visitors are fictional.",
    asOf: "2026-09-01T00:00:00+08:00",
    building: { name: property.property.name, district: "Marina Bay area (fictional property)", country: "Singapore" },
    observationWindow: { start: "2026-08-01", end: "2026-08-31" },
    baselineWindow: { start: "2026-08-02", end: "2026-08-16" },
    recentWindow: { start: "2026-08-17", end: "2026-08-31" },
    sourceFiles: ["property_and_units.json", "access_events.csv", "visitor_registrations.csv"],
    availability: {
      securityReports: { available: false, reason: "No security-report source was supplied in the dataset." },
      residentComplaints: { available: false, reason: "No resident-complaint source was supplied in the dataset." },
    },
    limitations: [
      "All records are synthetic. The fictional property cannot be verified against a real public listing.",
      "August 1 remains in the observation window but is excluded from two equal 15-day comparison windows (August 2–16 and August 17–31).",
      "Visitor validity dates are authorization windows, not confirmed arrival, departure or occupancy duration.",
      "Visitor registration IDs are not linked to access credentials in the source; do not infer a person-to-credential match.",
      "Visitor aliases are labels, not verified distinct identities. Purpose and host declarations are self-reported.",
      "Access logs may have incomplete or unmatched entry/exit sequences; credential use does not prove continuous occupancy or visit purpose.",
      "Security reports and resident complaints were not supplied. Empty tables mean unavailable evidence, not proof of no concerns.",
      "Demo profiles, expected cases, precomputed unit features and simulated web findings are excluded from operational evidence and scoring.",
    ],
  },
  units, accessActivity, visitorActivity, securityReports: [], residentComplaints: [],
};
const serialized = `${JSON.stringify(database, null, 2)}\n`;
if (process.argv.includes("--check")) {
  // Git may check out this text file with CRLF on Windows. Compare the same
  // serialized content without treating checkout line endings as data changes.
  const existing = (await readFile(output, "utf8")).replace(/\r\n/g, "\n");
  if (existing !== serialized) throw new Error("Imported mock database differs from the source. Run npm run data:import.");
  console.log("Imported mock database matches the supplied source exactly.");
} else {
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(output, serialized, "utf8");
  console.log(`Imported ${units.length} units, ${accessActivity.length} access events and ${visitorActivity.length} visitor authorizations. Security reports and complaints: not supplied.`);
}
