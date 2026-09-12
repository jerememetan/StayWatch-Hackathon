"use client";

import { useEffect, useRef, useState } from "react";
import { CaseReport } from "@/components/case-report";
import { createReportDownload, parseInvestigationResult, type ReportSnapshot } from "@/lib/report-export";
import styles from "./investigation.module.css";

const toolLabels: Record<string, string> = {
  get_unit_activity: "Access and visitor records",
  get_security_reports: "Security observations",
  get_resident_complaints: "Resident feedback",
  search_web: "Public web leads",
  create_case_report: "Case report preparation",
};

const statusLabels = { complete: "Complete", unavailable: "Unavailable", error: "Error" };

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Singapore",
  }).format(new Date(value));
}

type InvestigationPanelProps = { unitId: string; liveEnabled?: boolean };

export function InvestigationPanel({ unitId, liveEnabled = false }: InvestigationPanelProps) {
  return <InvestigationWorkspace key={unitId} unitId={unitId} liveEnabled={liveEnabled} />;
}

function InvestigationWorkspace({ unitId, liveEnabled }: InvestigationPanelProps) {
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  async function startInvestigation() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setIsInvestigating(true);
    setError(null);
    try {
      const response = await fetch("/api/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId }),
        signal: controller.signal,
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "The investigation could not complete. Please try again.";
        throw new Error(message);
      }
      const result = parseInvestigationResult(payload);
      if (!controller.signal.aborted) {
        setSnapshot({
          unitId,
          completedAt: result.timeline.at(-1)?.occurredAt ?? new Date().toISOString(),
          result,
        });
      }
    } catch (caughtError) {
      if (!controller.signal.aborted) {
        setError(caughtError instanceof SyntaxError
          ? "The service returned an unreadable response. Please try again."
          : caughtError instanceof Error ? caughtError.message : "The investigation could not complete. Please try again.");
      }
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setIsInvestigating(false);
      }
    }
  }

  function downloadReport(format: "markdown" | "json") {
    if (!snapshot) return;
    const file = createReportDownload(snapshot, format);
    const url = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
    const link = document.createElement("a");
    link.href = url;
    link.download = file.filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const previousResult = Boolean(snapshot && (isInvestigating || error));
  const result = snapshot?.result;
  const completedChecks = result?.timeline.filter((event) => event.status === "complete").length ?? 0;
  const unavailableChecks = result?.timeline.filter((event) => event.status === "unavailable").length ?? 0;
  const errorChecks = result?.timeline.filter((event) => event.status === "error").length ?? 0;

  return (
    <section className={styles.panel} id="investigation-panel" aria-labelledby="investigation-title">
      <div className={styles.launch}>
        <div className={styles.intro}>
          <div className={styles.titleRow}>
            <h2 id="investigation-title">Investigate this unit</h2>
            <span className={styles.mode}>{liveEnabled ? "Live AI · sample records" : "Offline demo"}</span>
          </div>
          <p className={styles.description}>
            {liveEnabled
              ? "Review the sample records with AI and prepare an evidence-led report. Public web search may be used when relevant and available."
              : "Generate a local report from the sample records. AI reasoning and live public web search are unavailable in this mode."}
          </p>
        </div>
        <button className={styles.primaryButton} type="button" onClick={startInvestigation} disabled={isInvestigating}>
          {isInvestigating ? "Investigation in progress" : error ? "Try investigation again" : snapshot ? "Run investigation again" : "Start investigation"}
          {!isInvestigating && <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M5 12h14M13 6l6 6-6 6" /></svg>}
        </button>
      </div>

      <div role="status" aria-live="polite" aria-atomic="true">
        {isInvestigating && (
          <p className={styles.waiting}>
            <span className={styles.spinner} aria-hidden="true" />
            <span>{liveEnabled
              ? "Waiting for the investigation response. This can take a few minutes; source checks appear once the run finishes."
              : "Preparing your report from the local sample records."}</span>
          </p>
        )}
        {!isInvestigating && snapshot && !error && <p className={styles.completion}>Report ready. Review the evidence and uncertainty below.</p>}
      </div>

      {error && (
        <div className={styles.errorNotice} role="alert">
          <strong>This investigation did not finish.</strong>
          <p>{error}</p>
          {snapshot && <p>Your previous successful report is preserved below.</p>}
        </div>
      )}

      {snapshot && result && (
        <div className={styles.result}>
          <div className={`${styles.resultMeta} ${previousResult ? styles.previousResult : ""}`}>
            <div>
              <strong>{previousResult ? "Previous successful report" : "Completed report"}</strong>
              <p>
                <time dateTime={snapshot.completedAt}>{formatTime(snapshot.completedAt)} SGT</time>
                <span className={styles.metaSeparator} aria-hidden="true"> / </span>
                {result.mode === "live" ? "Live AI · sample records" : "Offline demo · local records"}
              </p>
            </div>
            <div className={styles.exportActions} aria-label="Download this report">
              <button type="button" className={styles.secondaryButton} onClick={() => downloadReport("markdown")}>Download Markdown</button>
              <button type="button" className={styles.secondaryButton} onClick={() => downloadReport("json")}>Download JSON</button>
            </div>
          </div>

          <CaseReport report={result.report} />

          <details className={styles.sourceChecks}>
            <summary className={styles.sourceChecksSummary}>
              <span>Inspect source checks</span>
              <span className={styles.checkCounts}>
                {completedChecks} complete
                {unavailableChecks > 0 && ` · ${unavailableChecks} unavailable`}
                {errorChecks > 0 && ` · ${errorChecks} with errors`}
              </span>
            </summary>
            <p className={styles.checkExplanation}>The actual queries and responses from this completed run. An unavailable source is missing evidence.</p>
            <ol className={styles.timeline}>
              {result.timeline.map((event) => (
                <li className={styles.timelineEvent} key={event.id}>
                  <div className={styles.eventHeading}>
                    <h4>{toolLabels[event.tool] ?? event.label}</h4>
                    <span className={`${styles.eventStatus} ${styles[event.status]}`}>{statusLabels[event.status]}</span>
                  </div>
                  <p className={styles.eventDetail}>{event.detail}</p>
                  <time className={styles.eventTime} dateTime={event.occurredAt}>{formatTime(event.occurredAt)} SGT</time>
                  <details className={styles.toolEvidence}>
                    <summary>View query and returned evidence</summary>
                    <pre tabIndex={0} aria-label={`${toolLabels[event.tool] ?? event.label} query and evidence`}>
                      {JSON.stringify({ tool: event.tool, input: event.input ?? {}, output: event.output ?? null }, null, 2)}
                    </pre>
                  </details>
                </li>
              ))}
              {result.timeline.length === 0 && <li className={styles.eventDetail}>No source-check details were returned for this report.</li>}
            </ol>
          </details>
        </div>
      )}
    </section>
  );
}
