import { Dashboard } from "@/components/dashboard";
import { scoreUnits } from "@/lib/scoring";
import { units } from "@/lib/data";

export default function Home() { return <Dashboard units={scoreUnits(units)} />; }
