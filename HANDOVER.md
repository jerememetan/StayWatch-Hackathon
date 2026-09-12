# StayWatch handover

Updated: 12 September 2026 (Singapore).
Status: app improvements and local verification completed on 12 September 2026. Import check, 80 tests, typecheck, lint, production build, and desktop/mobile browser checks passed. No live services were called in this session.

## Start here

Continue in **E:\Projects\StayWatch-Hackathon**, the current user's project checkout. The earlier machine's `C:\Users\jerem\Documents\Github\StayWatch-Hackathon` path is historical.

The latest user decision is: **use A-03-01 from the supplied dataset as the main demo**, replacing the original #18-04. Its internal ID is **UNIT-003**.

The mock database and real AI tool-call implementation are present. Recent work adds queue controls, score/comparison explanations, a full-width report workspace with downloads, and separate entrance CCTV-still review. Computer vision describes visible outdoor scene objects only; it does not determine whether tenants are unauthorized or infer legal status.

This checkout was clean at commit `e69cc79` when resumed; the prior implementation is already committed. The current verification fixes and documentation updates are uncommitted. Preserve the supplied dataset and any local environment files. No commit or push was requested. The verified production app was started at http://localhost:3000 for the walkthrough; check whether it is still running before starting another server.

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

The previous machine had OPENAI_API_KEY and EXA_API_KEY configured. This checkout has no `.env` or `.env.local`; its browser investigation returned the explicitly labeled offline mode. Configure keys locally for a live demo if desired. Do not print, copy, commit, or overwrite existing key values. Both .env and .env.local are ignored; .env.example remains trackable.

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

Reports contain unitNumber, disposition, summary, potentialIndicators, supportingEvidence, uncertainty, recommendedHumanReview, confidence, and optional retrieved webSources. Missing-source and synthetic-context caveats are retained. Check the actual TypeScript schema before changing field names.

## Missing-source guard: verified with a follow-up correction

A real run correctly acknowledged missing security/complaint records in uncertainty but also incorrectly wrote “no security incidents” and “no resident complaints” in supporting evidence.

The API subagent added a targeted guard in investigation.ts to reject unsupported absence claims when the relevant source is unavailable. create_case_report returns an actionable error so the model can revise its draft. Explicit missing-data wording such as “No security reports are available” remains accepted. A prompt sentence reinforces this distinction.

Final review found that this guard also rejected accurate caveats, including the tool's own “not proof that no incidents occurred” wording. The follow-up fix removes specific missing-data and uncertainty spans before checking remaining assertions. It accepts coordinated missing-source wording and “No conclusion ... can be drawn” while still rejecting separate unsupported claims in the same sentence.

The investigation suite now has **20 passing tests**, including the original rejection/revision coverage, seven acceptance/mixed-claim regression cases, and the improved offline report's whole-month/comparison explanation. The full suite, typecheck, lint, and production build passed.

This guard is a targeted heuristic, not comprehensive semantic proof of every model statement. Rejected drafts remain visible in the actual tool trace as error events; the accepted report must not contain the rejected assertions.

## UI: implemented and improved

- Dashboard uses the supplied property, 24 units, actual date window, and 2,946 combined source records.
- A-03-01 is featured; B-03-02 is linked as a routine comparison.
- Queue supports unit search, block filtering, indicator/routine filters, priority/unit sorting, and empty-state recovery.
- Unit details show whole-month counts, equal-window comparisons, score points/thresholds, and unavailable sources.
- Reports use the full content width, appear immediately, and retain actual source checks behind an expandable disclosure.
- Markdown and JSON exports include timestamps, mode, citations, uncertainty, and source checks; downloads remain local.
- Failed retries preserve the previous successful report with its completion time.
- Report displays real public source links when retrieved.
- Live AI with mock records and offline mode are labeled distinctly before starting and on results.
- Offline reports now explain the same whole-month score rationale and actual declines as the unit page.

Files: src/components/dashboard.tsx, unit-detail.tsx, investigation-panel.tsx, case-report.tsx, their CSS modules, src/lib/report-export.ts, and src/app/globals.css.

## Entrance CCTV review

- Separate expandable unit-page panel, reachable through **Review CCTV still**.
- `POST /api/photo-review` accepts one JPEG, PNG, or WebP still up to 5 MB. It bounds request size, validates actual image pixels, rejects animations/unsafe dimensions, and strips metadata in memory before provider transmission.
- One stateless OpenAI Responses request with no retries and structured output. `OPENAI_VISION_MODEL` defaults to `gpt-4.1-mini`.
- Output is limited to fixed outdoor scene/layout/limitation categories and bounded counts (luggage, drop-off vehicles, entrance context). It cannot make identity, occupancy, tenancy, immigration, or legal claims, and it does not perform facial recognition or plate reading.
- Stills are never saved. The review never changes a score or enters an investigation report automatically. Without a configured key, local preview works but analysis is disabled and the API returns 503.
- Photo-review validation/mocked tests cover the CCTV still schema. No live image was sent in this checkout.

## Verification completed in the current checkout

- Importer `--check`: passed. A fresh Windows checkout initially failed because Git converted the generated JSON from LF to CRLF. The check now normalizes physical line endings before comparing serialized content. The source dataset and generated data are unchanged. Regression coverage checks LF, CRLF, and rejection of an altered access event.
- Full suite: **80 tests passed** (9 data, 2 scoring, 20 investigation, 10 investigation route, 21 photo review, 7 photo route, 11 report export/response validation).
- Typecheck and ESLint: passed.
- Production build: passed with Next.js 15.5.25 from the committed lockfile, with no dev server running. Tailwind emitted a non-fatal warning about its absent content configuration; the current UI uses its existing handwritten CSS and rendered correctly.
- Production-server browser walkthrough: dashboard displayed 24 units and 2,946 records; dashboard → A-03-01 → Start investigation returned HTTP 200 in offline mode; all five timeline steps and the case report appeared; expanded evidence contained UNIT-003.
- Screenshots inspected at desktop and phone widths. No page errors or horizontal overflow at 1440px, 390px, or 320px. At the narrowest width some table unit labels wrap, with content remaining readable.
- `git diff --check`: passed.
- Dependencies were initially absent and were installed using `npm ci` from the existing lockfile. The bundled Node runtime had no standalone npm command, so bundled pnpm invoked npm 10.9.3 for installation. Package manifests and lockfile were unchanged.
- Tests and the temporary browser profile needed scoped access outside the Windows sandbox. The in-app browser tool could not initialize, so the walkthrough used a fresh headless Chrome context through bundled Playwright.
- No external service calls or API credits were used in this session.

## Historical live-service evidence from the previous machine

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

Those live runs predate both guard corrections. Current mocked tests cover report rejection and revision; the production browser walkthrough covers offline rendering. A live run with the latest guard has not been performed.

Tests mock external services and should not consume API credits.

## Next steps / repeatable checks

The requested local verification is complete. For a demo, open A-03-01 and start an investigation. This checkout currently uses offline mode; live AI requires locally configured keys and a server restart. A live verification run is optional and consumes the configured services' normal usage.

After further code changes, the repeatable checks are:
   ```bash
   node scripts/import-mock-data.mjs --check
   npm test
   npm run typecheck
   npm run lint
   npm run build
   git diff --check
   ```
Run build with the dev server stopped to avoid shared .next output conflicts. Reload old browser tabs before rechecking reports. Do not commit or push unless asked.

## Environment / repository notes

- Windows PowerShell was used.
- The current repository is inside the writable workspace. Some Windows temporary-directory operations still require scoped sandbox escalation.
- Vitest may fail before collecting tests when sandbox access to Windows temporary directories is blocked; rerun with the appropriate permission instead of treating this as an application failure.
- Dependencies are now installed in this checkout.
- eslint.config.mjs now uses Next/TypeScript rules and ignores generated next-env.d.ts.
- package.json includes data:import and typecheck scripts.
- README.md and .env.example contain current run instructions.
- docs/mock-data-plan.md reflects the supplied dataset. The older docs/superpowers/plans/2026-09-12-staywatch-mvp.md is historical and may still reference #18-04.
- The generated data, importer, tests/types/schema, supplied dataset, and this handover are tracked. Current uncommitted changes are the importer line-ending fix, the guard correction, their regressions, and documentation updates.
- Do not commit .env, .env.local, node_modules, or .next.
