# StayWatch handover

Updated: 12 September 2026 (Singapore).
Status: implementation paused at the user's request to conserve tokens. Do not assume final verification is complete.

## Start here

Continue in **C:\Users\jerem\Documents\Github\StayWatch-Hackathon**.
This is the user's StayWatch Hackathon repository, not the original projectless Codex directory.

The latest user decision is: **use A-03-01 from the supplied dataset as the main demo**, replacing the original #18-04. Its internal ID is **UNIT-003**.

The immediate request was to connect a mock database so the AI can perform real tool calls. That implementation is in the working tree. The next agent should review the latest small safety fix and run final checks, not rebuild the app or generate a replacement dataset.

All changes are uncommitted. Preserve the existing user work, supplied dataset, and local environment file. No commit or push was requested. The development server started by the previous agent was stopped for this handover. No further live API calls are needed just to resume.

## Product and scope

StayWatch is a property-management investigation dashboard for potential short-stay occupancy indicators. It is not an immigration, identity, criminality, or deportation assessment tool.

Required framing: **potential indicators → supporting evidence → uncertainty → human review**. Never accuse residents, infer immigration status, make enforcement decisions, or automatically report anyone.

Keep one Next.js + TypeScript + Tailwind app. No database server, authentication, real property integrations, CCTV, facial recognition, image matching, or multi-agent runtime framework. Development subagents were used, but the application has one bounded investigation loop.

The user felt the earlier version was a ChatGPT wrapper. The current improvement is actual per-unit record querying, deterministic data-derived scores, comparisons, and inspectable tool inputs/outputs—not an added chat interface.

## Run

From the repository:

```bash
npm install
npm run dev
```

Open http://localhost:3000, select A-03-01, then Start investigation.
Direct unit URL: http://localhost:3000/units/UNIT-003.

The user has already configured OPENAI_API_KEY and EXA_API_KEY in the local .env file. Do not print, copy, commit, or overwrite their values. Both .env and .env.local are now ignored; .env.example remains trackable.

Default model: gpt-4.1-mini. Optional override: OPENAI_MODEL.
Restart the server after changing environment values.
Without an OpenAI key, the app runs an explicitly labeled offline review without external calls.

## Mock database: implemented

The source directory is **staywatch_demo_dataset/**, supplied by the user and preserved unchanged.

Imported operational data:

- 24 fictional units.
- 2,898 access events.
- 48 visitor registrations.
- Observation window: 1–31 August 2026.
- Fictional property: Harbour Crest Residences.
- No supplied security reports or resident complaints.

The generated, file-backed database is **data/mock-building.json**. It is approximately 1.3 MB and requires no database service.

```bash
npm run data:import
node scripts/import-mock-data.mjs --check
```

The importer reads only property_and_units.json, access_events.csv, and visitor_registrations.csv. It deliberately excludes:

- expected_cases.json (prewritten answers).
- unit_features.csv (preset scores/labels).
- demo_profile fields.
- web_findings.json (simulated listings, not live Exa evidence).

Do not feed those excluded answers into scoring or the investigation. Do not present the supplied simulated listings as live search results.

Important semantics:

- Visitor valid_from/valid_until are authorization windows, not observed arrival/departure or confirmed stay lengths.
- There is no credential-to-visitor mapping. Do not invent one.
- Registration counts do not prove the number of distinct people.
- Missing security/complaint sources mean unknown, not zero incidents or complaints.
- Recent and baseline windows are equal 15-day periods: Aug 17–31 and Aug 2–16. Aug 1 remains in the whole-month summary but is excluded from this comparison.

## Data interfaces

src/lib/mock-types.ts defines the file schema.
src/lib/data.ts provides:

- mockDatabase and its source availability/limitations metadata.
- units; getUnitById(id); getUnitByNumber(number).
- getUnitActivity(unitId): all unit records, used for UI counts.
- getSecurityReports(unitId); getResidentComplaints(unitId).
- getMockDataStats().
- getUnitActivityPage(unitId, { period, offset, limit }).

period is recent, baseline, or all. Page size defaults to 20 and is capped at 50. The AI tool exposes period and offset and uses 20 records per table. Access and visitor tables page independently using the same offset. Results are newest first.

Page output contains access, visitors, totals, nextOffset, query/window information, and comparison summaries for baseline/recent/all. It includes limitations to distinguish samples, authorizations, credentials, and people. Invalid inputs and unknown units are rejected.

Scores are derived from raw operational records, not supplied expected labels. Existing scoring sums signal weights, caps at 100, and uses 70/35 as high/medium thresholds.

Whole-month signal weights:

- At least 6 distinct visitor credentials: 30 points.
- At least 6 authorization windows of 24–72 hours: 25 points.
- At least 4 successive windows separated by 0–24 hours: 20 points.
- At least 4 late-night entries and 4 visitor credentials: 15 points.

Current examples: A-03-01 scores 90, A-07-02 scores 70, A-05-02 and B-04-01 score 45. B-03-02 is a routine comparison unit. These scores are review priorities, not probabilities of wrongdoing.

A-03-01 has 128 access events, 69 entries, 59 exits, 12 credentials (10 visitor credentials), 10 registrations, and 8 late-night entries across the month.

Crucial demo nuance: recent registrations decline from 7 to 3; recent access events decline from 64 to 60. Do not tell a fabricated story about a recent surge. The dashboard flags the recurring whole-month pattern. The initial investigation prompt now includes its calculated dashboard reasons and asks the model to assess them against both whole-month and comparison summaries. The newest page alone contains resident credentials and must not be generalized to the full month.

## Investigation: implemented

Key files:

- src/lib/investigation.ts — tool execution and bounded Responses loop.
- src/lib/investigation-schema.ts — strict function schemas and runtime report validation.
- src/app/api/investigate/route.ts — POST endpoint and sanitized errors.
- src/lib/types.ts — UI/report/timeline contracts.

Request:

```json
{ "unitId": "UNIT-003" }
```

Tools:

1. get_unit_activity
2. get_security_reports
3. get_resident_complaints
4. search_web
5. create_case_report

The loop preserves complete Responses output history, including reasoning items, and supplies complete JSON function_call_output values rather than truncated JSON. It uses store:false and serial tool calls. Limits: 12 model rounds, 2 web searches, approximately 150 seconds total, 30 seconds per model request, no automatic SDK retries. The API route allows 180 seconds.

All three internal sources must be checked before accepting a report, including sources marked unavailable. Tool arguments are validated and bound to the selected unit. A valid report ends the loop immediately. A failed/incomplete live run returns an error; it is not silently replaced with a canned success.

Exa search is conditional on the model finding it useful, not forced. Queries must use broad public descriptions and omit internal identifiers. Search returns actual HTTP(S) source URLs/excerpts with IDs, with bounded result counts and a timeout. Missing/failing Exa remains an evidence gap. No simulated listing is substituted.

Reports contain summary, potentialIndicators, supportingEvidence, uncertainty, recommendedNextSteps, confidence, and optional retrieved webSources. Missing-source and synthetic-context caveats are retained. Check the actual TypeScript schema before changing field names.

## Latest fix: landed, needs final integrated verification

A real run correctly acknowledged missing security/complaint records in uncertainty but also incorrectly wrote “no security incidents” and “no resident complaints” in supporting evidence.

The API subagent added a targeted guard in investigation.ts to reject unsupported absence claims when the relevant source is unavailable. create_case_report returns an actionable error so the model can revise its draft. Explicit missing-data wording such as “No security reports are available” remains accepted. A prompt sentence reinforces this distinction.

Regression cases cover the false claims in summary, potential indicators, and supporting evidence, followed by a corrected report. The subagent reported **12 investigation tests passing** after a red/green cycle. The orchestrator inspected the changes but has not rerun the full suite, lint, typecheck, or build after this final patch.

This guard is a targeted heuristic, not comprehensive semantic proof of every model statement. Rejected drafts remain visible in the actual tool trace as error events; the accepted report must not contain the rejected assertions.

## UI: implemented

- Dashboard uses the supplied property, 24 units, actual date window, and 2,946 combined source records.
- A-03-01 is the featured demo.
- Unit details display actual access/visitor counts and explicitly unavailable sources.
- Timeline replays completed real tool events after the request returns; it is not live streaming.
- Expandable steps expose query parameters and returned evidence JSON.
- Timeline distinguishes complete, unavailable, and error results.
- Report displays real public source links when retrieved.
- Live AI with mock records and offline mode are labeled distinctly.

Files: src/components/dashboard.tsx, unit-detail.tsx, investigation-panel.tsx, case-report.tsx, and src/app/globals.css.

## Verification evidence before pause

Completed by the orchestrator before the final absence-claim guard:

- Full suite: 29 tests passed (8 data, 2 scoring, 9 investigation, 10 route).
- Typecheck passed.
- Real ESLint/Next/TypeScript lint passed; the old ineffective lint configuration was replaced.
- Importer --check was verified reproducible by the data subagent.
- Three real A-03-01 investigations returned HTTP 200 and completed with tool calls.
- Browser dashboard/unit navigation and expandable tool evidence were inspected successfully.
- OpenAI credentials/model access were verified without exposing secrets.
- Exa credentials were verified with one separate real broad search.

The observed model runs chose NOT to search Exa. Do not claim those reports used live web evidence. Exa connectivity was tested separately.

After the latest patch, only the subagent's targeted 12-test investigation run is confirmed. A current full-suite total has not been verified.

**Production build has not been run for this set of changes.** Final screenshot/responsive review is also outstanding. Do not rely on any prior build claim from the original MVP.

Tests mock external services and should not consume API credits.

## Next agent checklist

1. Read this file and inspect the current diff. Preserve user work and local keys.
2. Review the latest missing-source absence-claim guard and its regression tests.
3. Run the final checks:
   ```bash
   node scripts/import-mock-data.mjs --check
   npm test
   npm run typecheck
   npm run lint
   npm run build
   git diff --check
   ```
4. Run build with the dev server stopped to avoid shared .next output conflicts.
5. Start the app and verify dashboard → A-03-01 → timeline/report presentation. If using an already-open browser tab, reload it: its previous report predates the guard and may contain the invalid statements.
6. Fix only genuine integration failures. Do not expand scope. A further paid live investigation is optional, not necessary merely to rerun tests.
7. Update this handover/README with actual verification results and provide a concise demo handoff. Do not commit or push unless asked.

## Environment / repository notes

- Windows PowerShell was used.
- The real repository is outside the prior Codex writable roots. Some commands required a scoped sandbox escalation to this exact project; if access fails, handle permission normally rather than editing the abandoned projectless copy.
- Vitest/esbuild startup may fail under the old restrictive sandbox; the same checks passed with scoped project access.
- No dependency installation was necessary in the latest work; node_modules already existed.
- eslint.config.mjs now uses Next/TypeScript rules and ignores generated next-env.d.ts.
- package.json includes data:import and typecheck scripts.
- README.md and .env.example contain current run instructions.
- docs/mock-data-plan.md reflects the supplied dataset. The older docs/superpowers/plans/2026-09-12-staywatch-mvp.md is historical and may still reference #18-04.
- The generated data/, importer scripts/, new tests/types/schema, supplied staywatch_demo_dataset/, and this handover may be untracked. Include the required data/source files when the user later asks to commit.
- Do not commit .env, .env.local, node_modules, or .next.
