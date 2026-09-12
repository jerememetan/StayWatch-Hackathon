import { notFound } from "next/navigation";
import { UnitDetail } from "@/components/unit-detail";
import { getResidentComplaints, getSecurityReports, getUnitActivity, getUnitById } from "@/lib/data";
import { scoreUnit } from "@/lib/scoring";

export default async function UnitPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  const unit = getUnitById(unitId);
  if (!unit) notFound();
  const activity = getUnitActivity(unitId);
  return <UnitDetail unit={scoreUnit(unit)} activity={activity.access} visitors={activity.visitors} securityReports={getSecurityReports(unitId)} complaints={getResidentComplaints(unitId)} />;
}
