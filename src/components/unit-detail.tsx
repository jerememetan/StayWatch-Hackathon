import Link from "next/link";
import { InvestigationPanel } from "@/components/investigation-panel";
import { PhotoReviewPanel } from "@/components/photo-review-panel";
import { mockDatabase } from "@/lib/data";
import type { ActivityComparison, DateWindow } from "@/lib/mock-types";
import type { ResidentComplaint, SecurityReport, Unit } from "@/lib/types";
import styles from "./unit-detail.module.css";

type DetailProps = {
  unit: Unit;
  comparison: ActivityComparison;
  securityReports: SecurityReport[];
  complaints: ResidentComplaint[];
  liveEnabled: boolean;
};

const dateFormatter = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", timeZone: "UTC" });

function windowLabel(window: DateWindow) {
  return `${dateFormatter.format(new Date(window.start))}–${dateFormatter.format(new Date(window.end))}`;
}

function ComparisonRow({ label, baseline, recent }: { label: string; baseline: number; recent: number }) {
  const maximum = Math.max(baseline, recent, 1);
  const difference = recent - baseline;
  return (
    <div className={styles.comparisonRow}>
      <div className={styles.comparisonLabel}>
        <h3>{label}</h3>
        <span>{difference === 0 ? "No change" : `${Math.abs(difference)} ${difference > 0 ? "more" : "fewer"} in recent window`}</span>
      </div>
      <div className={styles.barRows}>
        <div className={styles.barRow}>
          <span>Baseline</span>
          <div className={styles.barTrack} aria-hidden="true"><span className={styles.baselineBar} style={{ width: `${(baseline / maximum) * 100}%` }} /></div>
          <strong>{baseline}</strong>
        </div>
        <div className={styles.barRow}>
          <span>Recent</span>
          <div className={styles.barTrack} aria-hidden="true"><span className={styles.recentBar} style={{ width: `${(recent / maximum) * 100}%` }} /></div>
          <strong>{recent}</strong>
        </div>
      </div>
    </div>
  );
}

export function UnitDetail({ unit, comparison, securityReports, complaints, liveEnabled }: DetailProps) {
  const { all, baseline, recent } = comparison;
  const availability = mockDatabase.metadata.availability;
  const sources = [
    {
      title: "Access activity", available: true, count: all.accessCount,
      detail: `${all.grantedCount} granted and ${all.deniedCount} denied attempts. Credentials do not identify who used them or their purpose.`,
    },
    {
      title: "Visitor registrations", available: true, count: all.visitorCount,
      detail: "Counts registrations starting in the observation window. Authorization dates do not establish arrival, departure or length of stay.",
    },
    {
      title: "Security observations", available: availability.securityReports.available, count: securityReports.length,
      detail: availability.securityReports.available
        ? (securityReports[0]?.observation ?? "No security observations are recorded for this unit in the supplied source.")
        : availability.securityReports.reason,
    },
    {
      title: "Resident feedback", available: availability.residentComplaints.available, count: complaints.length,
      detail: availability.residentComplaints.available
        ? (complaints[0] ? `${complaints[0].concern} This account has not been independently verified.` : "No resident feedback is recorded for this unit in the supplied source.")
        : availability.residentComplaints.reason,
    },
  ];

  return (
    <main className={`page ${styles.workspace}`}>
      <header className="topbar">
        <Link className="brand" href="/"><span className="brand-mark">S</span> StayWatch</Link>
        <span className={styles.buildingName}>{mockDatabase.metadata.building.name}</span>
      </header>
      <Link href="/" className={styles.back}>
        <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none"><path d="m8 5-5 5 5 5M3 10h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Back to review queue
      </Link>

      <section className={styles.title} aria-labelledby="unit-title">
        <div>
          <h1 id="unit-title">Unit {unit.unitNumber}</h1>
          <p className={styles.unitMeta}>Floor {unit.floor}<span aria-hidden="true">·</span>{unit.bedrooms} {unit.bedrooms === 1 ? "bedroom" : "bedrooms"}<span aria-hidden="true">·</span>Synthetic records</p>
        </div>
        <div className={styles.priority}>
          <span className={`pill ${unit.riskLevel}`}>{unit.riskLevel} review priority</span>
          <p><strong>{unit.riskScore}</strong><span> / 100 points</span></p>
          <a href="#score-breakdown">View score breakdown</a>
        </div>
      </section>

      <div className={styles.contextNote} role="note">
        <p><strong>A starting point for human review.</strong> These records show potential indicators, not a conclusion about a resident or visitor. The score is a rule-based review priority, not a probability of a violation.</p>
        <div className={styles.quickActions}>
          <a href="#investigation-panel">Prepare case report <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none"><path d="M10 3v14m-5-5 5 5 5-5" stroke="currentColor" strokeWidth="1.5" /></svg></a>
          <a href="#photo-review-panel">Review CCTV still <svg aria-hidden="true" viewBox="0 0 20 20" width="16" height="16" fill="none"><path d="M10 3v14m-5-5 5 5 5-5" stroke="currentColor" strokeWidth="1.5" /></svg></a>
        </div>
      </div>

      <div className={styles.contextGrid}>
        <section aria-labelledby="activity-heading" className={styles.activitySection}>
          <div className={styles.sectionHeading}>
            <h2 id="activity-heading">Activity overview</h2>
            <p>{windowLabel(all.window)} {all.window.start.slice(0, 4)} · whole month</p>
          </div>
          <dl className={styles.monthStats}>
            <div><dt>Access attempts</dt><dd>{all.accessCount}</dd></div>
            <div><dt>Registrations</dt><dd>{all.visitorCount}</dd></div>
            <div><dt>Visitor credentials</dt><dd>{all.uniqueVisitorCredentials}</dd></div>
            <div><dt>24–72h authorizations</dt><dd>{all.shortAuthorizationCount}</dd></div>
          </dl>
          <div className={styles.comparisonHeading}>
            <h3>How the activity changed</h3>
            <p>Baseline: {windowLabel(baseline.window)}<br />Recent: {windowLabel(recent.window)}</p>
          </div>
          <ComparisonRow label="Access attempts" baseline={baseline.accessCount} recent={recent.accessCount} />
          <ComparisonRow label="Visitor registrations" baseline={baseline.visitorCount} recent={recent.visitorCount} />
          <p className={styles.methodNote}>Two equal 15-day windows. August 1 is excluded from this comparison and included in the whole-month score. Registrations and credentials are not counts of verified people.</p>
        </section>

        <section className={styles.scoreSection} aria-labelledby="score-breakdown">
          <div className={styles.sectionHeading}>
            <h2 id="score-breakdown">Why this score</h2>
            <p>Rules applied to the whole observation month.</p>
          </div>
          {unit.signals.length ? (
            <ul className={styles.signalList}>
              {unit.signals.map((signal) => (
                <li key={signal.id}>
                  <div><h3>{signal.title}</h3><p>{signal.detail}</p></div>
                  <span className={styles.points}>+{signal.points}<span>points</span></span>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.emptySignals}><h3>No scoring rules triggered</h3><p>The supplied activity does not meet the current rule thresholds. Missing evidence still requires care.</p></div>
          )}
          <div className={styles.scoreTotal}><span>Review priority total <small>capped at 100</small></span><strong>{unit.riskScore}<span> / 100</span></strong></div>
          <p className={styles.methodNote}>Low: 0–34 · Medium: 35–69 · High: 70–100. A higher score prioritizes review; it does not establish illegal occupancy.</p>
        </section>
      </div>

      <section className={styles.sourcesSection} aria-labelledby="sources-heading">
        <div className={styles.sectionHeading}>
          <h2 id="sources-heading">Sources and evidence gaps</h2>
          <p>Unavailable sources cannot be treated as evidence that no concerns occurred.</p>
        </div>
        <div className={styles.sourceList}>
          {sources.map((source) => (
            <article className={styles.sourceRow} key={source.title}>
              <h3>{source.title}</h3>
              <span className={`${styles.sourceState} ${source.available ? styles.available : styles.unavailable}`}>{source.available ? `${source.count} ${source.count === 1 ? "record" : "records"}` : "Unavailable"}</span>
              <p>{source.detail}</p>
            </article>
          ))}
        </div>
        <details className={styles.limitations}>
          <summary>Read dataset limitations</summary>
          <ul>{comparison.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
        </details>
      </section>

      <div className={styles.investigation}>
        <InvestigationPanel key={unit.id} unitId={unit.id} liveEnabled={liveEnabled} />
      </div>

      <div className={styles.photoReview}><PhotoReviewPanel key={unit.id} unitId={unit.id} enabled={liveEnabled} /></div>
    </main>
  );
}
