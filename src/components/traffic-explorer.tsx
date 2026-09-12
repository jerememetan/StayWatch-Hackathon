"use client";

import { useMemo, useState } from "react";

type ExplorerUnit = { id: string; unitNumber: string; floor: number; registeredOccupants: number };
type AccessRecord = { unitId: string; occurredAt: string; result: "granted" | "denied" };
type VisitorRecord = { unitId: string; occurredAt: string; visitorLabel: string; visitorId: string };

type Props = { units: ExplorerUnit[]; access: AccessRecord[]; visitors: VisitorRecord[] };

const WINDOWS = [7, 14, 30] as const;
type WindowDays = (typeof WINDOWS)[number];

function dateKey(date: Date) { return date.toISOString().slice(0, 10); }
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function displayDate(key: string) { const [, month, day] = key.split("-"); return `${MONTHS[Number(month) - 1]} ${Number(day)}`; }

export function TrafficExplorer({ units, access, visitors }: Props) {
  const [days, setDays] = useState<WindowDays>(14);
  const [selectedId, setSelectedId] = useState("UNIT-003");
  const lastDay = "2026-08-31";
  const selected = units.find((unit) => unit.id === selectedId) ?? units[0];

  const data = useMemo(() => {
    const end = new Date(`${lastDay}T00:00:00Z`);
    const start = new Date(end); start.setUTCDate(end.getUTCDate() - days + 1);
    const keys = Array.from({ length: days }, (_, index) => {
      const date = new Date(start); date.setUTCDate(start.getUTCDate() + index); return dateKey(date);
    });
    const allowed = access.filter((event) => event.result === "granted" && event.occurredAt.slice(0, 10) >= keys[0]);
    const totals = new Map(units.map((unit) => [unit.id, 0]));
    const byUnit = new Map(units.map((unit) => [unit.id, keys.map(() => 0)]));
    allowed.forEach((event) => {
      const index = keys.indexOf(event.occurredAt.slice(0, 10));
      if (index >= 0) { totals.set(event.unitId, (totals.get(event.unitId) ?? 0) + 1); byUnit.get(event.unitId)?.splice(index, 1, (byUnit.get(event.unitId)?.[index] ?? 0) + 1); }
    });
    const ranked = [...units].map((unit) => ({ unit, total: totals.get(unit.id) ?? 0, series: byUnit.get(unit.id) ?? [] })).sort((a, b) => b.total - a.total);
    return { keys, ranked, series: byUnit.get(selected.id) ?? [], visitorAliases: [...new Set(visitors.filter((visitor) => visitor.unitId === selected.id && visitor.occurredAt.slice(0, 10) >= keys[0]).map((visitor) => visitor.visitorLabel))].slice(0, 6) };
  }, [access, days, selected.id, units, visitors]);

  const baseline = data.series.length ? data.series.reduce((total, value) => total + value, 0) / data.series.length : 0;
  const peak = Math.max(...data.series, 1);
  const totalVisits = data.series.reduce((total, value) => total + value, 0);
  const chartPoints = data.series.map((value, index) => `${30 + index * (340 / Math.max(data.series.length - 1, 1))},${130 - (value / peak) * 104}`).join(" ");

  return (
    <section className="traffic-explorer" aria-labelledby="traffic-heading">
      <div className="section-head traffic-heading">
        <div><span className="eyebrow">Traffic patterns / template</span><h2 id="traffic-heading">Find changes worth a closer look</h2><p className="section-copy">Counts are granted access events, not confirmed visits or a finding about any person.</p></div>
        <div className="window-tabs" aria-label="Traffic time window">{WINDOWS.map((window) => <button key={window} type="button" onClick={() => setDays(window)} className={days === window ? "active" : ""} aria-pressed={days === window}>{window} days</button>)}</div>
      </div>
      <div className="traffic-layout">
        <div className="traffic-rank" aria-label="Units ranked by granted access activity">
          <div className="traffic-column-head"><span>Unit</span><span>Granted events</span></div>
          {data.ranked.slice(0, 8).map(({ unit, total }) => <button type="button" className={`traffic-unit ${unit.id === selected.id ? "selected" : ""}`} key={unit.id} onClick={() => setSelectedId(unit.id)}>
            <span><strong>#{unit.unitNumber}</strong><small>{unit.registeredOccupants} registered occupant{unit.registeredOccupants === 1 ? "" : "s"}</small></span>
            <span className="traffic-bar" aria-hidden="true"><i style={{ width: `${Math.max(7, (total / Math.max(data.ranked[0]?.total ?? 1, 1)) * 100)}%` }} /></span><b>{total}</b>
          </button>)}
        </div>
        <div className="traffic-detail">
          <div className="traffic-detail-head"><div><span className="eyebrow">Selected unit</span><h3>#{selected.unitNumber} activity trend</h3></div><span className="traffic-total">{totalVisits}<small>granted events</small></span></div>
          <svg viewBox="0 0 400 170" role="img" aria-label={`Daily granted access events for unit ${selected.unitNumber}`} className="traffic-chart">
            <line x1="30" x2="370" y1="130" y2="130" className="chart-axis" /><line x1="30" x2="370" y1={130 - (baseline / peak) * 104} y2={130 - (baseline / peak) * 104} className="chart-baseline" />
            <polyline points={chartPoints} className="chart-line" />{data.series.map((value, index) => <circle key={index} cx={30 + index * (340 / Math.max(data.series.length - 1, 1))} cy={130 - (value / peak) * 104} r="3.5" className="chart-point"><title>{displayDate(data.keys[index])}: {value} granted events</title></circle>)}
            <text x="30" y="153">{displayDate(data.keys[0])}</text><text x="370" y="153" textAnchor="end">{displayDate(data.keys[data.keys.length - 1])}</text><text x="367" y={126 - (baseline / peak) * 104} textAnchor="end" className="baseline-label">daily average {baseline.toFixed(1)}</text>
          </svg>
          <p className="chart-caption">Look for sustained departures from the unit’s own usual pattern, then review the underlying records.</p>
        </div>
      </div>
      <div className="connection-panel">
        <div><span className="eyebrow">Record connections</span><h3>Related activity, without inferred identity matches</h3></div>
        <div className="connection-map" aria-label={`Visitor-registration aliases associated with unit ${selected.unitNumber}`}><span className="graph-unit">#{selected.unitNumber}</span><span className="graph-line" />{data.visitorAliases.length ? data.visitorAliases.map((alias) => <span className="graph-record" key={alias}>{alias}</span>) : <span className="graph-empty">No visitor registrations in this window</span>}</div>
        <p>Registration aliases are connected to their declared unit only. They are not matched to credentials or treated as verified people.</p>
      </div>
    </section>
  );
}
