import { NextResponse } from "next/server";
import { investigateUnit } from "@/lib/investigation";

export const maxDuration = 180;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please provide a JSON request body with unitId." }, { status: 400 });
  }

  if (body === null || typeof body !== "object" || Array.isArray(body) || !("unitId" in body) || typeof body.unitId !== "string" || !body.unitId.trim()) {
    return NextResponse.json({ error: "unitId is required." }, { status: 400 });
  }

  try {
    return NextResponse.json(await investigateUnit(body.unitId.trim()));
  } catch (error) {
    if (error instanceof Error && error.message === "Unit not found") {
      return NextResponse.json({ error: "Unit not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "The investigation could not complete. Check the service configuration and retry." }, { status: 500 });
  }
}
