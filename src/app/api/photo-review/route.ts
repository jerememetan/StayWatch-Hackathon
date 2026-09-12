import { NextResponse } from "next/server";
import { PhotoReviewError, reviewPhoto } from "@/lib/photo-review";
import { MAX_PHOTO_BYTES } from "@/lib/photo-review-types";

export const runtime = "nodejs";
export const maxDuration = 30;
const maxRequestBytes = MAX_PHOTO_BYTES + 64 * 1024;
const noStore = { "Cache-Control": "no-store" };

async function boundedFormData(request: Request): Promise<FormData> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data;")) throw new PhotoReviewError("Choose a photo to upload.", 400);
  if (Number(request.headers.get("content-length")) > maxRequestBytes) throw new PhotoReviewError("Choose a photo smaller than 5 MB.", 413);
  if (!request.body) throw new PhotoReviewError("Choose a photo to upload.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxRequestBytes) {
        await reader.cancel();
        throw new PhotoReviewError("Choose a photo smaller than 5 MB.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return await new Response(bytes, { headers: { "Content-Type": contentType } }).formData(); }
  catch { throw new PhotoReviewError("The upload could not be read. Choose the photo again.", 400); }
}

export async function POST(request: Request) {
  try {
    const form = await boundedFormData(request);
    if (Array.from(form.keys()).some((key) => !["unitId", "photo"].includes(key)) || form.getAll("unitId").length !== 1 || form.getAll("photo").length !== 1) {
      throw new PhotoReviewError("Provide one unit and one photo.", 400);
    }
    const unitId = form.get("unitId");
    const photo = form.get("photo");
    if (typeof unitId !== "string" || !unitId.trim() || unitId.length > 80 || !photo || typeof photo === "string") {
      throw new PhotoReviewError("Provide a valid unit and choose one photo.", 400);
    }
    if (!photo.size || photo.size > MAX_PHOTO_BYTES) throw new PhotoReviewError("Choose a photo smaller than 5 MB.", 413);
    const result = await reviewPhoto(unitId.trim(), Buffer.from(await photo.arrayBuffer()), photo.type, request.signal);
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    if (error instanceof PhotoReviewError) return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore });
    return NextResponse.json({ error: "The photo could not be reviewed. Choose it again and retry." }, { status: 500, headers: noStore });
  }
}
