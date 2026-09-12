# StayWatch Synthetic Demo Dataset

This dataset is entirely fictional and is intended only for demos, prototyping, testing and hackathons.

Files:
- property_and_units.json — fictional condo + 24 units
- access_events.csv — resident / visitor access-card events
- visitor_registrations.csv — visitor registrations
- web_findings.json — simulated Exa/web-investigation results
- expected_cases.json — ground-truth cases for demo/testing
- unit_features.csv — pre-aggregated features for dashboards / scoring

Designed demo cases:
1. A-03-01 — rapid guest turnover + social listing support
2. A-07-02 — strongest web-listing match
3. A-05-02 — repeated late-night short stays
4. B-06-02 — possible overcrowding
5. B-04-01 — ambiguous repeated weekend visitors
6. B-03-02 — normal baseline example

Suggested demo flow:
Detect -> rank units by behavioural anomalies
Investigate -> inspect synthetic web_findings.json
Explain -> produce evidence-based case summary
Human review -> operator decides whether to escalate

Important: Risk score should never be treated as proof of wrongdoing. It is a triage signal for human review.
