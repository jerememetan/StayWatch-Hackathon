import { NextResponse } from "next/server";
import { investigateUnit } from "@/lib/investigation";

export async function POST(request: Request) {
  let body: { unitId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please provide a JSON request body with unitId." }, { status: 400 });
  }

  if (typeof body.unitId !== "string" || !body.unitId.trim()) {
    return NextResponse.json({ error: "unitId is required." }, { status: 400 });
  }

  try {
    return NextResponse.json(await investigateUnit(body.unitId.trim()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start investigation.";
    return NextResponse.json({ error: message }, { status: message === "Unit not found" ? 404 : 500 });
  }
}
