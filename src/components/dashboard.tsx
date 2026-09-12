"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Unit } from "@/lib/types";
import styles from "./dashboard.module.css";

type DashboardProps = {
  units: Unit[];
  buildingName: string;
  observationWindow: { start: string; end: string };
  recordCount: number;
  liveEnabled: boolean;
};
type Queue = "all" | "review" | "routine";

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h16m-6-6 6 6-6 6"} /></svg>;
}

export function Dashboard({ units, buildingName, observationWindow, recordCount, liveEnabled }: DashboardProps) {
  const [query, setQuery] = useState("");
  const [queue, setQueue] = useState<Queue>("all");
  const [block, setBlock] = useState("all");
  const [sort, setSort] = useState("priority");
  const featured = units.find((unit) => unit.unitNumber === "A-03-01");
  const comparison = units.find((unit) => unit.unitNumber === "B-03-02");
  const highCount = units.filter((unit) => unit.riskLevel === "high").length;
  const mediumCount = units.filter((unit) => unit.riskLevel === "medium").length;
  const reviewCount = highCount + mediumCount;
  const blocks = [...new Set(units.map((unit) => unit.unitNumber.split("-")[0]))].sort();
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase().replace(/^#/, "");
    return units.filter((unit) => {
      const matchesQuery = unit.unitNumber.toLowerCase().includes(term);
      const matchesQueue = queue === "all" || (queue === "review" ? unit.riskLevel !== "low" : unit.riskLevel === "low");
      return matchesQuery && matchesQueue && (block === "all" || unit.unitNumber.split("-")[0] === block);
    }).sort((a, b) => sort === "unit" ? a.unitNumber.localeCompare(b.unitNumber) : b.riskScore - a.riskScore || a.unitNumber.localeCompare(b.unitNumber));
  }, [units, query, queue, block, sort]);
  const month = new Intl.DateTimeFormat("en-SG", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${observationWindow.start}T00:00:00Z`));
  const dateRange = `${Number(observationWindow.start.slice(-2))}–${Number(observationWindow.end.slice(-2))} ${month}`;
  const hasFilters = query !== "" || block !== "all" || queue !== "all";
  function resetFilters() { setQuery(""); setQueue("all"); setBlock("all"); }

  return (
    <main className={`page ${styles.workspace}`} id="main-content">
      <header className={styles.header}>
        <Link className="brand" href="/" aria-label="StayWatch dashboard"><span className="brand-mark">S</span>StayWatch</Link>
        <div className={styles.property}><span>{buildingName}</span><span>Synthetic property · Singapore</span></div>
        <span className={styles.mode}><span aria-hidden="true" />{liveEnabled ? "Live AI available" : "Offline demo"}</span>
      </header>
      <section className={styles.intro} aria-labelledby="dashboard-title">
        <div>
          <h1 id="dashboard-title">Property review</h1>
          <p>Find the pattern. Check the evidence.<br className={styles.desktopBreak} /> Decide what needs a closer look.</p>
          <div className={styles.period}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 2v6m8-6v6"/></svg>{dateRange}<span>Observation window</span></div>
        </div>
        {featured && <div className={styles.featured}>
          <div className={styles.featuredTop}><span>Suggested first review</span><span className={styles.priorityHigh}>High priority</span></div>
          <div className={styles.featuredMain}><h2>Unit {featured.unitNumber}</h2><strong>{featured.riskScore}<span>/100</span></strong></div>
          <p>{featured.signals.length} recorded patterns across the month, including repeated short visitor authorizations.</p>
          <Link href={`/units/${featured.id}`} className={styles.primaryLink}>Review this unit<Arrow /></Link>
        </div>}
      </section>
      <div className={styles.summary} aria-label="Building review metrics">
        <div><strong>{units.length}</strong><span>Units in this property</span></div>
        <div><strong>{reviewCount}<small>/{units.length}</small></strong><span>With review indicators <small>{highCount} high · {mediumCount} medium</small></span></div>
        <div><strong>{recordCount.toLocaleString("en-SG")}</strong><span>Access & visitor records</span></div>
        <div className={styles.sourceStatus}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7l8-4Z"/><path d="M12 8v5m0 3v1"/></svg><span>Two source gaps<small>Security reports & resident feedback</small></span></div>
      </div>
      <section className={styles.queue} id="review-queue" aria-labelledby="queue-heading">
        <div className={styles.sectionHeading}><div><h2 id="queue-heading">Unit review queue</h2><p>Priority reflects recorded patterns, not a finding about a resident.</p></div>{comparison && <Link className={styles.comparisonLink} href={`/units/${comparison.id}`}>View a routine example<Arrow diagonal /></Link>}</div>
        <div className={styles.toolbar}>
          <div className={styles.queueFilters} role="group" aria-label="Filter review queue">
            {([{ value: "all", label: "All units", count: units.length }, { value: "review", label: "With indicators", count: reviewCount }, { value: "routine", label: "Routine", count: units.length - reviewCount }] as const).map((item) => <button type="button" key={item.value} aria-pressed={queue === item.value} onClick={() => setQueue(item.value)}>{item.label}<span>{item.count}</span></button>)}
          </div>
          <div className={styles.searchRow}>
            <div className={styles.search}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg><label className="sr-only" htmlFor="unit-search">Search units</label><input id="unit-search" type="search" placeholder="Search unit, e.g. A-03" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" /></div>
            <label className={styles.selectLabel}><span className="sr-only">Block</span><select aria-label="Block" value={block} onChange={(event) => setBlock(event.target.value)}><option value="all">All blocks</option>{blocks.map((value) => <option key={value} value={value}>Block {value}</option>)}</select></label>
            <label className={styles.selectLabel}><span className="sr-only">Sort units</span><select aria-label="Sort units" value={sort} onChange={(event) => setSort(event.target.value)}><option value="priority">Highest priority</option><option value="unit">Unit number</option></select></label>
          </div>
        </div>
        <div className={styles.resultCount}><span role="status">Showing {filtered.length} of {units.length} units</span>{hasFilters && <button type="button" onClick={resetFilters}>Clear filters</button>}</div>
        {filtered.length ? <div className={styles.tableWrap}><table className={styles.table}>
          <thead><tr><th scope="col">Unit</th><th scope="col">Review priority</th><th scope="col" className={styles.indicatorColumn}>Leading indicator</th><th scope="col">Score</th><th scope="col" className={styles.openColumn}><span className="sr-only">Open unit</span></th></tr></thead>
          <tbody>{filtered.map((unit) => <tr key={unit.id} className={unit.id === featured?.id ? styles.featuredRow : undefined}>
            <td><Link href={`/units/${unit.id}`} className={styles.unitLink}>{unit.unitNumber}<span>Floor {unit.floor} · {unit.bedrooms} bed</span></Link></td>
            <td><span className={`${styles.priority} ${styles[unit.riskLevel]}`}><span aria-hidden="true" />{unit.riskLevel === "low" ? "Routine" : unit.riskLevel === "high" ? "High" : "Medium"}</span></td>
            <td className={styles.indicatorColumn}><span className={styles.indicator}>{unit.signals[0]?.title ?? "No scored patterns in supplied records"}</span>{unit.signals.length > 1 && <span className={styles.moreSignals}>+{unit.signals.length - 1} more</span>}</td>
            <td><div className={styles.scoreCell}><strong>{unit.riskScore}<span>/100</span></strong><div className={styles.scoreTrack} aria-hidden="true"><span className={styles[unit.riskLevel]} style={{ width: `${unit.riskScore}%` }} /></div></div></td>
            <td className={styles.openColumn}><Link href={`/units/${unit.id}`} aria-label={`Review unit ${unit.unitNumber}`} className={styles.rowAction}><Arrow /></Link></td>
          </tr>)}</tbody>
        </table></div> : <div className={styles.empty}><h3>No units match these filters</h3><p>Try a different unit number or include more blocks and priorities.</p><button type="button" onClick={resetFilters}>Show all units</button></div>}
        <footer className={styles.footer}><span>Fictional property. Synthetic records. Human review required.</span><span>Scores do not establish tenancy status.</span></footer>
      </section>
    </main>
  );
}
