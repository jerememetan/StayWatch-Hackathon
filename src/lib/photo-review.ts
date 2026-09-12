import OpenAI from "openai";
import sharp from "sharp";
import { getUnitById } from "@/lib/data";
import {
  isPhotoAssessment, MAX_PHOTO_BYTES, PHOTO_MIME_TYPES, photoLayoutLabels, photoLimitationLabels, photoObjectLabels,
  type PhotoReviewResult,
} from "@/lib/photo-review-types";

export class PhotoReviewError extends Error {
  constructor(message: string, public readonly status: number) { super(message); this.name = "PhotoReviewError"; }
}

const maxPixels = 20_000_000;
const imageFormats: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
const enumArray = (values: string[]) => ({ type: "array", items: { type: "string", enum: values }, maxItems: values.length });
const assessmentSchema = {
  type: "object", additionalProperties: false,
  properties: {
    view: { type: "string", enum: ["exterior", "not_exterior", "unclear"] },
    quality: { type: "string", enum: ["clear", "limited", "unusable"] },
    objects: {
      type: "array", maxItems: Object.keys(photoObjectLabels).length,
      items: {
        type: "object", additionalProperties: false,
        properties: {
          kind: { type: "string", enum: Object.keys(photoObjectLabels) },
          visibleCount: { type: "integer", minimum: 1, maximum: 20 },
          certainty: { type: "string", enum: ["clear", "uncertain"] },
        },
        required: ["kind", "visibleCount", "certainty"],
      },
    },
    layoutFeatures: enumArray(Object.keys(photoLayoutLabels)),
    limitations: { ...enumArray(Object.keys(photoLimitationLabels)), minItems: 1 },
  },
  required: ["view", "quality", "objects", "layoutFeatures", "limitations"],
};

const instructions = `Review a single CCTV still from outside a condominium or HDB block: driveway, drop-off bay, lobby approach, or common entrance.
Return only the requested structured observations. Do not identify, describe, count, classify, compare, or track people or faces.
Never infer identity, nationality, ethnicity, immigration status, tenancy status, permission to occupy, wrongdoing, or legal compliance.
Never read, transcribe, or report license plates, unit numbers, names, QR codes, documents, or other text in the frame.
Objects cannot establish occupancy, who lives in a unit, a rental arrangement, or a breach. No person, resident record, or other still is available for matching.
List only the allowed scene objects visibly supported by the still. visibleCount is an approximate count of objects, never people.
Use each object kind at most once. A rolling suitcase is rolling_luggage, not also suitcase. Stacked bags are a separate pile, not a sum of other bag kinds. Categories must never be added into a total of travellers or stays.
Use uncertain when an object or count is ambiguous. Do not guess hidden objects. Limit each count to 20; omit a kind if a meaningful count cannot be made.
Layout features are tentative observations, not occupancy or safety determinations. Add only features directly visible.
Every result must include relevant limitations; perspective and cropped_view apply whenever spacing or the entire entrance or driveway cannot be verified.
For an interior room, unclear view, or unusable image return no objects and no layoutFeatures, with not_exterior or cannot_assess as appropriate.
Do not use tools, external searches, or any other information.`;

export async function preparePhoto(bytes: Buffer, mime: string): Promise<Buffer> {
  if (!PHOTO_MIME_TYPES.some((type) => type === mime)) throw new PhotoReviewError("Choose a JPEG, PNG, or WebP photo.", 415);
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) throw new PhotoReviewError("Choose a photo smaller than 5 MB.", 413);
  try {
    const image = sharp(bytes, { limitInputPixels: maxPixels, failOn: "warning", animated: true });
    const metadata = await image.metadata();
    if (metadata.format !== imageFormats[mime] || !metadata.width || !metadata.height ||
      metadata.width < 64 || metadata.height < 64 || metadata.width * metadata.height > maxPixels || (metadata.pages ?? 1) > 1) {
      throw new Error("Unsupported image dimensions, content type, or animation");
    }
    // Decode all pixels, honor orientation, downsize and strip metadata before the
    // provider sees the photo. No file or original metadata is written to disk.
    return await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" }).jpeg({ quality: 85 }).toBuffer();
  } catch {
    throw new PhotoReviewError("This photo could not be read. Use a still JPEG, PNG, or WebP between 64 pixels and 20 megapixels.", 422);
  }
}

export async function reviewPhoto(unitId: string, bytes: Buffer, mime: string, signal?: AbortSignal): Promise<PhotoReviewResult> {
  if (!getUnitById(unitId)) throw new PhotoReviewError("Unit not found.", 404);
  if (!process.env.OPENAI_API_KEY?.trim()) throw new PhotoReviewError("CCTV review is not configured. Ask your administrator to enable OpenAI, then try again.", 503);
  const photo = await preparePhoto(bytes, mime);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 25000, maxRetries: 0 });
  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
      instructions, store: false, max_output_tokens: 1400,
      input: [{ role: "user", content: [
        { type: "input_text", text: "Review the visible outdoor scene objects in this CCTV still, using only the allowed observations." },
        { type: "input_image", image_url: `data:image/jpeg;base64,${photo.toString("base64")}`, detail: "high" },
      ] }],
      text: { format: { type: "json_schema", name: "cctv_still_observations", strict: true, schema: assessmentSchema } },
    }, { signal });
    if (response.status !== "completed") throw new Error("Incomplete photo review");
    const assessment: unknown = JSON.parse(response.output_text);
    if (!isPhotoAssessment(assessment)) throw new Error("Invalid photo observations");
    return { unitId, reviewedAt: new Date().toISOString(), assessment };
  } catch {
    throw new PhotoReviewError("CCTV review could not complete. Try a clearer entrance or driveway still, or retry shortly.", 502);
  }
}
