import Link from "next/link";
import type { Unit } from "@/lib/types";

type DashboardProps = { units: Unit[] };
type UnitView = Unit & {
  unitNumber: string;
  residentLabel: string;
  floor: number;
  bedrooms: number;
  riskScore: number;
  riskLevel: "high" | "medium" | "low";
  signals: { id: string }[];
};

function asView(unit: Unit): UnitView {
  return unit as UnitView;
}

export function Dashboard({ units }: DashboardProps) {
  const reviewed = units.map(asView);
  const highCount = reviewed.filter((unit) => unit.riskLevel === "high").length;
  const featured = reviewed.find((unit) => unit.unitNumber === "18-04");

  return (
    <main className="page">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="StayWatch dashboard">
          <span className="brand-mark">S</span> StayWatch
        </Link>
        <span className="muted"><span className="status-dot" />Building 01 · live demo data</span>
      </header>

      <div className="safety" role="note">
        <span className="safety-icon">✦</span>
        <span><strong>Potential indicators, not conclusions.</strong> StayWatch surfaces patterns for a property manager to assess. It does not identify wrongdoing, make accusations, or send reports.</span>
      </div>

      <section className="hero" aria-labelledby="dashboard-title">
        <div>
          <span className="eyebrow">Property operations / review queue</span>
          <h1 id="dashboard-title">See where human attention may be useful.</h1>
          <p className="hero-copy">A calm, evidence-led view of synthetic building activity. Begin with the units carrying the strongest combination of signals, then investigate context before making any decision.</p>
        </div>
        <div className="mini-status">Updated for demo<br />12 Sep 2026, 09:15</div>
      </section>

      <section className="metrics" aria-label="Building review metrics">
        <div className="metric"><span className="metric-label">Units monitored</span><span className="metric-value">{reviewed.length}</span><span className="metric-note">Synthetic activity feed</span></div>
        <div className="metric"><span className="metric-label">Review queue</span><span className="metric-value">{highCount}</span><span className="metric-note">Potential-indicator reviews</span></div>
        <div className="metric"><span className="metric-label">Signals assessed</span><span className="metric-value">4</span><span className="metric-note">Access, visitors, reports, feedback</span></div>
        <div className="metric"><span className="metric-label">Action authority</span><span className="metric-value">Human</span><span className="metric-note">Review required every time</span></div>
      </section>

      <section aria-labelledby="queue-heading">
        <div className="section-head">
          <div><span className="eyebrow">Prioritized view</span><h2 id="queue-heading">Potential-indicator review queue</h2><p className="section-copy">Scores summarize signals; they are not findings.</p></div>
          {featured && <Link href={`/units/${featured.id}`} className="eyebrow">Open #18-04 →</Link>}
        </div>
        <div className="table">
          <div className="row table-head"><span>Unit</span><span>Review level</span><span>Signals observed</span><span>Score</span><span aria-label="Open" /></div>
          {reviewed.map((unit) => (
            <Link href={`/units/${unit.id}`} className={`row ${unit.unitNumber === "18-04" ? "feature-row" : ""}`} key={unit.id}>
              <span><span className="unit-name">#{unit.unitNumber}</span><span className="unit-sub">Floor {unit.floor} · {unit.bedrooms}-bedroom</span></span>
              <span className={`pill ${unit.riskLevel}`}>{unit.riskLevel} review</span>
              <span className="muted">{unit.signals.length} signal{unit.signals.length === 1 ? "" : "s"} in context</span>
              <span className="score">{unit.riskScore}<span className="muted">/100</span></span>
              <span className="arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
