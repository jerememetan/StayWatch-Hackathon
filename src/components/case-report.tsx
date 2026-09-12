import type { CaseReport as CaseReportData } from "@/lib/types";

type CaseReportProps = {
  report: CaseReportData;
};

function EvidenceSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="report-section" aria-labelledby={`report-${title.replaceAll(" ", "-").toLowerCase()}`}>
      <h3 id={`report-${title.replaceAll(" ", "-").toLowerCase()}`}>{title}</h3>
      <ul>
        {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ul>
    </section>
  );
}

export function CaseReport({ report }: CaseReportProps) {
  return (
    <article className="case-report" aria-labelledby="case-report-title">
      <div className="report-heading">
        <div>
          <span className="eyebrow">Investigation output</span>
          <h2 id="case-report-title">Case report</h2>
        </div>
        <span className={`pill ${report.confidence}`}>{report.confidence} confidence</span>
      </div>
      <p className="report-disposition">{report.disposition}</p>
      <p className="report-summary">{report.summary}</p>
      <EvidenceSection title="Potential indicators" items={report.potentialIndicators} />
      <EvidenceSection title="Supporting evidence" items={report.supportingEvidence} />
      <EvidenceSection title="Uncertainty" items={report.uncertainty} />
      {Boolean(report.webSources?.length) && (
        <section className="report-section" aria-label="Public sources retrieved">
          <h3>Public sources retrieved</h3>
          <p className="source-note">Live search results are leads. They are not verified matches to this fictional property.</p>
          <ul>{report.webSources?.map((source) => (
            <li key={source.id}><a className="source-link" href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a></li>
          ))}</ul>
        </section>
      )}
      <section className="report-review" aria-labelledby="report-human-review">
        <span className="eyebrow">Recommended human review</span>
        <h3 id="report-human-review">Assess the context before any follow-up</h3>
        <p>{report.recommendedHumanReview}</p>
      </section>
    </article>
  );
}
