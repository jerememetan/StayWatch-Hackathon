import { Dashboard } from "@/components/dashboard";
import { scoreUnits } from "@/lib/scoring";
import { getMockDataStats, mockDatabase, units } from "@/lib/data";

export const dynamic = "force-dynamic";

export default function Home() {
  const stats = getMockDataStats();
  return <Dashboard units={scoreUnits(units)} buildingName={mockDatabase.metadata.building.name} observationWindow={stats.observationWindow} recordCount={stats.accessEvents + stats.visitorRegistrations} liveEnabled={Boolean(process.env.OPENAI_API_KEY)} />;
}
