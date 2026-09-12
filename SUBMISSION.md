# StayWatch

StayWatch helps property managers review potential short-stay occupancy patterns in residential buildings. It brings building records into one review queue, explains why a unit was flagged, and prepares an evidence-based case report for a person to assess. A priority score is a prompt to investigate, not a finding about a resident.

## Who it is for

Property managers and MCST teams often have to piece together access activity, visitor registrations, observations, and public listings. StayWatch puts those checks in the property dashboard where the manager already sees the unit and its history. The manager decides whether any follow-up is appropriate.

## What we built

- A Next.js dashboard that ranks 24 fictional units using scores calculated from synthetic access and visitor records.
- Unit pages that show the records behind each score and compare recent activity with an equal-length baseline.
- An investigation workflow that checks available building sources, optionally searches the public web, and produces a report with supporting evidence, uncertainty, and suggested human review. The tool inputs and results are inspectable, and reports can be downloaded as Markdown or JSON.
- A separate, optional room-photo review that describes visible furniture and layout without changing the unit score.

With an OpenAI API key, the investigation uses OpenAI Responses function calls to choose and run its source checks. Exa is used for live public-web search only when configured and useful to the investigation. Without an OpenAI key, the app clearly labels its deterministic, local-record report as an offline demo.

## Demo

1. Run `npm install` and `npm run dev`, then open `http://localhost:3000`.
2. Open **A-03-01** from the review queue and inspect its score and source records.
3. Select **Start investigation**, read the case report, and expand **Inspect source checks** to see the evidence trail.

The supplied building and records are fictional. Security reports and resident complaints are unavailable in this dataset, so the report treats them as evidence gaps. Public search results cannot establish a match to a fictional unit. StayWatch does not accuse residents or make an enforcement decision.

## Links and submission checks

- Repository: [StayWatch-Hackathon](https://github.com/jerememetan/StayWatch-Hackathon)
