"use client";

import { useEffect, useState } from "react";
import type { InvestigationResponse } from "@/lib/types";
import { CaseReport } from "@/components/case-report";

type InvestigationResult = InvestigationResponse & { mode?: "live" | "demo" };

const toolLabels: Record<string, string> = {
  get_unit_activity: "Reviewing access and visitor records",
  get_security_reports: "Reviewing security observations",
  get_resident_complaints: "Reviewing resident feedback",
  search_web: "Searching public web leads",
  create_case_report: "Preparing case report",
};

export function InvestigationPanel({ unitId }: { unitId: string }) {
  const [result, setResult] = useState<InvestigationResult | null>(null);
  const [visibleEventCount, setVisibleEventCount] = useState(0);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!result || visibleEventCount >= result.timeline.length) return;
    const timer = window.setTimeout(() => setVisibleEventCount((count) => count + 1), 650);
    return () => window.clearTimeout(timer);
  }, [result, visibleEventCount]);

  async function startInvestigation() {
    setIsInvestigating(true);
    setError(null);
    setResult(null);
    setVisibleEventCount(0);
    try {
      const response = await fetch("/api/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId }),
      });
      const payload = await response.json() as InvestigationResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "StayWatch could not complete this investigation.");
      setResult(payload);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "StayWatch could not complete this investigation.");
    } finally {
      setIsInvestigating(false);
    }
  }

  const visibleTimeline = result?.timeline.slice(0, visibleEventCount) ?? [];
  const replaying = Boolean(result && visibleEventCount < result.timeline.length);

  return (
    <div className="investigation-panel">
      <button className="investigate-button" type="button" onClick={startInvestigation} disabled={isInvestigating}>
        {isInvestigating ? "Investigating…" : result ? "Run investigation again" : "Start investigation"}
      </button>

      {isInvestigating && <p className="investigation-status" role="status"><span className="status-dot" />StayWatch is gathering records and preparing an evidence-led review.</p>}

      {error && (
        <div className="investigation-error" role="alert">
          <strong>Investigation unavailable.</strong> {error} Check the service configuration and try again.
        </div>
      )}

      {result && (
        <div className="investigation-result">
          <div className="timeline-heading">
            <div><span className="eyebrow">Investigation timeline</span><h3>{replaying ? "Replaying completed steps" : "Completed investigation steps"}</h3></div>
            <span className="mode-note">{result.mode === "live" ? "Live AI · mock records" : "Offline demo"}</span>
          </div>
          {result.mode === "demo" && <p className="config-note">OpenAI is not enabled for this run. This is a local review of the mock records; no live services were called.</p>}
          <ol className="investigation-timeline" aria-live="polite">
            {visibleTimeline.map((event) => (
              <li className="timeline-event" key={event.id}>
                <span className="timeline-marker" aria-label={event.status}>{event.status === "complete" ? "✓" : "!"}</span>
                <div>
                  <strong>{toolLabels[event.tool] ?? event.label}</strong><p>{event.detail}</p>
                  {event.output !== undefined && (
                    <details className="tool-evidence">
                      <summary>Inspect query and returned evidence</summary>
                      <pre>{JSON.stringify({ tool: event.tool, input: event.input ?? {}, output: event.output }, null, 2)}</pre>
                    </details>
                  )}
                </div>
              </li>
            ))}
            {replaying && <li className="timeline-event timeline-pending"><span className="timeline-marker">…</span><span>Revealing the next completed tool call…</span></li>}
          </ol>
          {!replaying && <CaseReport report={result.report} />}
        </div>
      )}
    </div>
  );
}
