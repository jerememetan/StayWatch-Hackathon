# Mock building data and tool integration

Use the supplied `staywatch_demo_dataset/` files and a reproducible import script to produce a committed JSON mock database. This keeps the MVP runnable without a database service. All occupants, credentials, visitors, and the building are fictional. The supplied simulated web findings are never represented as live Exa evidence.

1. Import the supplied 24 units, 2,898 access events and 48 visitor registrations. The user selected A-03-01 as the main demo. Derive signal scores from raw records, never expected-case labels or prewritten scores. Preserve registration validity as authorization, not observed stay duration. Security reports and complaints were not supplied and must be marked as missing sources.
2. Preserve existing data helpers for the dashboard. Add paginated activity queries with whole-window summaries and baseline comparison. Validate unit isolation, IDs, dates, counts, and pagination.
3. Wire actual OpenAI function calls to the query helpers. Keep tool outputs valid JSON, include query parameters and results in the timeline, require internal evidence before accepting a case report, and allow an evidence-driven public search. Return a clear failure if a live run cannot finish; never silently replace it with a canned live report.
4. Verify the live A-03-01 path with the configured services, then document dataset import, scenarios, environment setup, and test results. Keep environment files ignored by Git.
