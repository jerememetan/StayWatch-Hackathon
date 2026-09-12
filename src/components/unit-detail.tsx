import Link from "next/link";
import { InvestigationPanel } from "@/components/investigation-panel";
import type { AccessActivity, ResidentComplaint, SecurityReport, Unit, VisitorActivity } from "@/lib/types";
import { mockDatabase } from "@/lib/data";

type DetailProps = { unit: Unit; activity: AccessActivity[]; visitors: VisitorActivity[]; securityReports: SecurityReport[]; complaints: ResidentComplaint[] };

export function UnitDetail({ unit, activity, visitors, securityReports, complaints }: DetailProps) {
  const record = unit;
  const entries = [
    { icon: "↗", title: "Access activity", detail: activity.length ? `${activity.length} access events in the supplied window, including ${activity.filter((item) => item.direction === "entry").length} entry attempts. Access records do not establish who used a credential or why.` : "No access activity supplied for this review." },
    { icon: "◎", title: "Visitor records", detail: visitors.length ? `${visitors.length} relevant visitor records. ${visitors[0].note} Entries are context, not proof of purpose.` : "No visitor records supplied for this review." },
    { icon: "!", title: "Security observations", detail: securityReports.length ? `${securityReports.length} security observation. ${securityReports[0].observation}` : "This dataset does not supply security observations. The investigation will retain this evidence gap." },
    { icon: "◌", title: "Resident feedback", detail: complaints.length ? `${complaints.length} resident feedback record. ${complaints[0].concern} This account has not been independently verified.` : "This dataset does not supply resident complaints. This does not establish that no complaints occurred." },
  ];
  return (
    <main className="page">
      <header className="topbar"><Link className="brand" href="/"><span className="brand-mark">S</span> StayWatch</Link><span className="muted">{mockDatabase.metadata.building.name} · unit review</span></header>
      <Link href="/" className="back">← Back to review queue</Link>
      <section className="detail-title" aria-labelledby="unit-title">
        <div><span className="eyebrow">Potential-indicator review / synthetic records</span><h1 id="unit-title">Unit #{record.unitNumber}</h1><p className="hero-copy">Internal activity has been grouped for context. The information below is not a conclusion about a resident or visitor.</p></div>
        <div><span className={`pill ${record.riskLevel}`}>{record.riskLevel} review</span><div className="score" style={{ marginTop: 8, textAlign: "right" }}>{record.riskScore}<span className="muted"> / 100</span></div></div>
      </section>
      <div className="safety" role="note" style={{ marginTop: 24, marginBottom: 0 }}><span className="safety-icon">✦</span><span><strong>Review with care.</strong> These are potential indicators and supporting records only. A property manager should assess uncertainty and context before any follow-up.</span></div>
      <section className="detail-grid">
        <div><div className="section-head"><div><span className="eyebrow">Internal context</span><h2>Signals available for review</h2><p className="section-copy">Synthetic data sources are separated to make the evidence traceable.</p></div></div><div className="evidence-list">{entries.map((entry) => <article className="evidence" key={entry.title}><span className="evidence-icon">{entry.icon}</span><div><h3>{entry.title}</h3><p>{entry.detail}</p></div></article>)}</div></div>
        <aside className="review-panel" aria-label="Investigation action"><span className="eyebrow">Next step</span><h2>Ask StayWatch to investigate</h2><p>It will correlate these internal records with public web results, state uncertainty clearly, and prepare a case report for human review.</p><div id="investigation-panel"><InvestigationPanel unitId={record.id} /></div><p className="source-note">No automatic reporting or enforcement action is available in this workflow.</p></aside>
      </section>
    </main>
  );
}
