# StayWatch MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished single-path property-management investigation demo for potential short-stay indicators in unit #18-04.

**Architecture:** A Next.js App Router app keeps all synthetic data in typed modules. Deterministic scoring selects units for review; the browser calls one `POST /api/investigate` endpoint, which runs an OpenAI Responses API tool loop over internal data and Exa web results, returning a structured, safety-framed report plus chronological tool events.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, OpenAI SDK, Exa SDK, Vitest.

---

## Shared interfaces

- `Unit`: `{ id, unitNumber, residentLabel, floor, bedrooms, riskScore, riskLevel, signals }`.
- `InvestigationEvent`: `{ id, tool, label, detail, status: 'complete', occurredAt }`.
- `CaseReport`: `{ unitNumber, disposition, summary, potentialIndicators, supportingEvidence, uncertainty, recommendedHumanReview, confidence }`.
- `InvestigationResponse`: `{ report: CaseReport, timeline: InvestigationEvent[] }`.
- The only action is a human-visible “Investigate potential indicators” request. Reports never name, accuse, report, or recommend enforcement action against people.

### Task 1: Scaffold and synthetic evidence model

**Files:** package configuration; `src/lib/types.ts`; `src/lib/data.ts`; `src/lib/scoring.ts`; `src/lib/scoring.test.ts`; `.env.example`.

- [ ] Write a failing Vitest test proving #18-04 ranks as high potential-indicator review and a normal unit does not.
- [ ] Implement typed synthetic units, access activity, visitor activity, security reports, and resident complaints; give #18-04 plausible high-frequency but non-conclusive signals.
- [ ] Implement pure deterministic risk scoring and retrieve-by-unit helper functions.
- [ ] Run the unit tests.

### Task 2: Investigation services and API

**Files:** `src/lib/investigation.ts`; `src/lib/investigation.test.ts`; `src/app/api/investigate/route.ts`.

- [ ] Write failing tests for a structured safety-first fallback investigation response with visible events.
- [ ] Implement tool definitions: `get_unit_activity`, `get_security_reports`, `get_resident_complaints`, `search_web`, and `create_case_report`.
- [ ] Implement Exa search wrapper using `EXA_API_KEY`; omit it safely when unavailable/failing.
- [ ] Implement an OpenAI Responses API tool loop using `OPENAI_API_KEY`, capture each actual tool invocation in the timeline, and validate the final case report. Use a deterministic local report when credentials are absent so the demo remains runnable.
- [ ] Implement POST input validation and safe error responses.
- [ ] Run investigation tests and typecheck.

### Task 3: Dashboard and unit-detail experience

**Files:** `src/app/layout.tsx`; `src/app/globals.css`; `src/app/page.tsx`; `src/app/units/[unitId]/page.tsx`; `src/components/dashboard.tsx`; `src/components/unit-detail.tsx`.

- [ ] Build an editorial dark operations-dashboard layout with a clear “potential indicators, not conclusions” banner.
- [ ] Show building metrics, scored unit rows, and a strongly signposted #18-04 path.
- [ ] Build the unit detail with source-signal panels and an investigation action, responsive without external UI libraries.
- [ ] Typecheck and visually inspect a running local page if available.

### Task 4: Investigation timeline and report presentation

**Files:** `src/components/investigation-panel.tsx`; `src/components/case-report.tsx`.

- [ ] Write a failing component-level or helper test for ordered visible timeline events when practical in the scaffold.
- [ ] Build a replayed timeline that reveals events sequentially from the API’s actual returned tool calls.
- [ ] Build an explainable case report with the exact sections: potential indicators, supporting evidence, uncertainty, and recommended human review.
- [ ] Include useful loading, unavailable-configuration, and request-error states without expanding the product scope.

### Task 5: Integration, QA, and instructions

**Files:** `README.md`; all touched files as needed.

- [ ] Align all imports, response types, copy, and API shape; remove scope creep.
- [ ] Run tests, lint, and production build; resolve failures.
- [ ] Verify #18-04 dashboard → detail → investigation flow in a browser when feasible.
- [ ] Write concise setup/run instructions, including optional API keys and no-key fallback behavior.
