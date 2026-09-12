# StayWatch

StayWatch is a safety-first hackathon MVP for helping property managers review **potential** short-stay occupancy indicators. It combines synthetic building records with an optional OpenAI + Exa investigation, and always presents evidence as context for human review—not a conclusion about any resident or visitor.

## Demo path

1. Open the dashboard.
2. Select **#A-03-01** from the potential-indicator review queue.
3. Select **Start investigation**.
4. Watch the completed tool timeline replay. Expand a step to inspect its query and the actual returned records, then review the case report's potential indicators, supporting evidence, uncertainty, and recommended human review.

## Mock database

The supplied `staywatch_demo_dataset/` is preserved as the source. Its operational records are imported into `data/mock-building.json`: **24 units, 2,898 access events, and 48 visitor registrations**, covering August 2026. The app reads that file directly; no database server or account is required.

After editing the source property, access, or visitor files, regenerate the app database and restart the development server:

```bash
npm run data:import
```

The agent queries one unit at a time through `get_unit_activity` (period and offset, with 20 records per table per page), `get_security_reports`, and `get_resident_complaints`. Activity results include complete period totals and a recent/baseline comparison. Scores are calculated from the operational records.

Try **A-03-01** for changing visitor credentials, **A-07-02** for another visitor-activity case, and **B-03-02** for an ordinary comparison unit. The dataset's `expected_cases.json`, preset labels/scores in `unit_features.csv`, and `demo_profile` fields are excluded from the agent's evidence and scoring.

The supplied dataset has no security reports or resident complaints. Those tools explicitly return a missing-source result. Visitor registration start/end times describe authorization, not confirmed arrival/departure or a measured stay. The supplied `web_findings.json` is simulated and is not used as live search evidence.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Optional live investigation

Set both values in `.env` or `.env.local` (both are ignored by Git). `.env.example` documents the available settings. Restart the development server after changing keys.

```bash
OPENAI_API_KEY=your_key
EXA_API_KEY=your_key
```

With `OPENAI_API_KEY`, `POST /api/investigate` runs real OpenAI Responses function calls against the mock database. `EXA_API_KEY` enables live web searches when the agent decides a search is useful. `OPENAI_MODEL` optionally overrides the default `gpt-4.1-mini`.

Without an OpenAI key, the app runs an explicitly labeled offline review with no external service calls. A missing or unavailable Exa service is retained as an evidence gap; it is never replaced with simulated listings. Live results cannot identify a match to a fictional property.

The server limits investigations to 12 model rounds and two web searches. It accepts a report only after the three internal sources have been queried. An unfinished live run returns an error instead of a canned success.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Tests mock the external services and do not spend API credits. A real investigation from the app uses your configured services and their normal API usage.

## Guardrails

- Signals and public-web results are potential indicators, not proof.
- The product does not accuse residents, make enforcement decisions, or submit reports.
- Every case report explicitly includes uncertainty and recommends human review.
