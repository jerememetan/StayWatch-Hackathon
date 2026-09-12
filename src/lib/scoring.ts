import type { RiskLevel, Unit } from "./types";

function levelFor(score: number): RiskLevel {
  if (score >= 70) return "high";
  if (score >= 35) return "medium";
  return "low";
}

export function scoreUnit(unit: Unit): Unit {
  const riskScore = Math.min(
    100,
    unit.signals.reduce((total, signal) => total + signal.points, 0),
  );

  return {
    ...unit,
    riskScore,
    riskLevel: levelFor(riskScore),
  };
}

export function scoreUnits(sourceUnits: Unit[]): Unit[] {
  return sourceUnits.map(scoreUnit).sort((left, right) => right.riskScore - left.riskScore);
}
