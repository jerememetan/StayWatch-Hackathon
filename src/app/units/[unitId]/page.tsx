import { notFound } from "next/navigation";
import { UnitDetail } from "@/components/unit-detail";
import { getResidentComplaints, getSecurityReports, getUnitActivityPage, getUnitById } from "@/lib/data";
import { scoreUnit } from "@/lib/scoring";

export default async function UnitPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  const unit = getUnitById(unitId);
  if (!unit) notFound();
  const activity = getUnitActivityPage(unitId, { period: "all" });
  return (
    <UnitDetail
      unit={scoreUnit(unit)}
      comparison={activity.comparison}
      securityReports={getSecurityReports(unitId)}
      complaints={getResidentComplaints(unitId)}
      liveEnabled={Boolean(process.env.OPENAI_API_KEY)}
    />
  );
}
