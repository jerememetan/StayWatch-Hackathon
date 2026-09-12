import type { CaseReport as CaseReportData } from "@/lib/types";
import styles from "./investigation.module.css";

type CaseReportProps = { report: CaseReportData };

function EvidenceSection({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  return (
    <section className={styles.evidenceSection} aria-labelledby={`report-${title.replaceAll(" ", "-").toLowerCase()}`}>
      <h3 id={`report-${title.replaceAll(" ", "-").toLowerCase()}`}>{title}</h3>
      {items.length > 0 ? <ul>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p>{emptyText}</p>}
    </section>
  );
}

export function CaseReport({ report }: CaseReportProps) {
  return (
    <article className={styles.report} aria-labelledby="case-report-title">
      <div className={styles.reportHeading}>
        <h2 id="case-report-title">Case report <span>Unit {report.unitNumber}</span></h2>
        <span className={`pill ${report.confidence}`}>{report.confidence} confidence</span>
      </div>
      <p className={styles.disposition}>{report.disposition}</p>
      <p className={styles.reportSummary}>{report.summary}</p>
      <div className={styles.evidenceGrid}>
        <div>
          <EvidenceSection title="Potential indicators" items={report.potentialIndicators} emptyText="No potential indicators were identified in this report." />
          <EvidenceSection title="Supporting evidence" items={report.supportingEvidence} emptyText="No supporting evidence was returned." />
        </div>
        <EvidenceSection title="Uncertainty" items={report.uncertainty} emptyText="No uncertainty notes were returned. Human verification remains necessary." />
      </div>
      {Boolean(report.webSources?.length) && (
        <section className={styles.publicSources} aria-labelledby="report-public-sources">
          <h3 id="report-public-sources">Public sources retrieved</h3>
          <p className={styles.sourceNote}>Public results are unverified leads. They do not establish a match to this fictional property.</p>
          <ul>{report.webSources?.map((source) => (
            <li key={source.id}>
              <a className={styles.sourceLink} href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<span className={styles.srOnly}> (opens in a new tab)</span></a>
              <span className={styles.sourceId}>Source {source.id}</span>
              {source.excerpt && <p>{source.excerpt}</p>}
            </li>
          ))}</ul>
        </section>
      )}
      <section className={styles.review} aria-labelledby="report-human-review">
        <h3 id="report-human-review">Recommended human review</h3>
        <p>{report.recommendedHumanReview}</p>
      </section>
    </article>
  );
}
