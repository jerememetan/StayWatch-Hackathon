# StayWatch

StayWatch is a safety-first hackathon MVP for helping property managers review **potential** short-stay occupancy indicators. It combines synthetic building records with an optional OpenAI + Exa investigation, and always presents evidence as context for human review—not a conclusion about any resident or visitor.

## Demo path

1. Open the dashboard.
2. Select **A-03-01** or use **Review this unit**. Search, block filters, and indicator/routine filters help navigate the full queue.
3. Select **Start investigation**.
4. Read the completed report immediately. Open **Inspect source checks** to inspect actual queries and responses, or download Markdown/JSON for handoff.

Unit pages explain score contributions and compare baseline with recent activity. Live/offline mode is visible before an investigation starts. If a repeat investigation fails, the previous successful report remains visible with its completion time.

## Mock database

The supplied `staywatch_demo_dataset/` is preserved as the source. Its operational records are imported into `data/mock-building.json`: **24 units, 2,898 access events, and 48 visitor registrations**, covering August 2026. The app reads that file directly; no database server or account is required.

After editing the source property, access, or visitor files, regenerate the app database and restart the development server:

```bash
npm run data:import
```

The agent queries one unit at a time through `get_unit_activity` (period and offset, with 20 records per table per page), `get_security_reports`, and `get_resident_complaints`. Activity results include complete period totals and a recent/baseline comparison. Scores are calculated from the operational records.

Try **A-03-01** for changing visitor credentials, **A-07-02** for another visitor-activity case, and **B-03-02** for an ordinary comparison unit. The dataset's `expected_cases.json`, preset labels/scores in `unit_features.csv`, and `demo_profile` fields are excluded from the agent's evidence and scoring.

A-03-01's score reflects a recurring whole-month pattern. Recent registrations decline from 7 to 3 and access events from 64 to 60 across equal 15-day windows; the demo should not describe a recent surge.

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
node scripts/import-mock-data.mjs --check
npm test
npm run typecheck
npm run lint
npm run build
```

Tests mock the external services and do not spend API credits. A real investigation from the app uses your configured services and their normal API usage.

Verified on 12 September 2026: the importer check, all 80 tests, typecheck, lint, production build, and browser checks at 1440, 900, 390, and 320 pixels passed. Checks cover filtering/search, report downloads, evidence expansion, failed retries, and local CCTV-still preview/removal. The current checkout has no local service keys configured; new vision calls were verified with mocked responses only. See [HANDOVER.md](HANDOVER.md) for details.

## Entrance CCTV review

Open a unit, choose **Review CCTV still**, and expand **Entrance CCTV review**. Select a JPEG, PNG, or WebP snapshot up to 5 MB to preview it locally. **Analyze still** requires `OPENAI_API_KEY`; `OPENAI_VISION_MODEL` optionally overrides its default `gpt-4.1-mini` model.

The feature describes visible outdoor scene objects—luggage, drop-off vehicles, and similar items—with approximate counts and uncertainty. It is a still-frame review of a condominium or HDB entrance, driveway, or common area. It cannot determine who lives in a unit, tenancy authorization, immigration status, or wrongdoing, and it does not perform facial recognition or read plates. It never changes the unit score or automatically enters an investigation report.

Selecting a still does not send it anywhere. Clicking **Analyze still** sends a decoded, resized copy with image metadata removed to OpenAI. StayWatch does not save the image; provider data policies apply. Use outdoor entrance or driveway stills without faces, plates, or personal documents. A missing key disables analysis; no simulated vision result is substituted.

## Guardrails

- Signals and public-web results are potential indicators, not proof.
- The product does not accuse residents, make enforcement decisions, or submit reports.
- Every case report explicitly includes uncertainty and recommends human review.
