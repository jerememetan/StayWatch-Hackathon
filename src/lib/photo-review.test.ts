import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { preparePhoto, reviewPhoto } from "./photo-review";
import { isPhotoAssessment, MAX_PHOTO_BYTES, type PhotoAssessment } from "./photo-review-types";

const { create, clientOptions } = vi.hoisted(() => ({ create: vi.fn(), clientOptions: vi.fn() }));
vi.mock("openai", () => ({ default: vi.fn().mockImplementation((options: unknown) => { clientOptions(options); return { responses: { create } }; }) }));

const assessment: PhotoAssessment = {
  view: "room", quality: "limited",
  objects: [{ kind: "bed_frame", visibleCount: 2, certainty: "uncertain" }],
  layoutFeatures: ["partial_room_view"], limitations: ["cropped_view", "perspective"],
};

let photo: Buffer;
beforeEach(async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-key-never-sent");
  vi.stubEnv("OPENAI_VISION_MODEL", "");
  create.mockReset(); clientOptions.mockReset();
  photo = await sharp({ create: { width: 120, height: 100, channels: 3, background: "#aabbcc" } }).png().toBuffer();
});
afterEach(() => vi.unstubAllEnvs());

describe("bounded room observations", () => {
  it("accepts supported, approximate object observations", () => {
    expect(isPhotoAssessment(assessment)).toBe(true);
  });

  it.each([
    { ...assessment, conclusion: "illegal tenant" },
    { ...assessment, objects: [{ kind: "person", visibleCount: 1, certainty: "clear" }] },
    { ...assessment, objects: [{ ...assessment.objects[0], visibleCount: -1 }] },
    { ...assessment, objects: [{ ...assessment.objects[0], visibleCount: 1.5 }] },
    { ...assessment, objects: [{ ...assessment.objects[0], visibleCount: 21 }] },
    { ...assessment, objects: [...assessment.objects, ...assessment.objects] },
    { ...assessment, view: "not_room" },
    { ...assessment, quality: "unusable" },
    { ...assessment, limitations: [] },
    { ...assessment, layoutFeatures: ["unauthorized_occupancy"] },
  ])("rejects unsupported or inconsistent model output %#", (value) => {
    expect(isPhotoAssessment(value)).toBe(false);
  });
});

describe("photo preparation", () => {
  it("decodes and converts a real PNG to a metadata-free JPEG", async () => {
    const encoded = await sharp(photo).withMetadata({ orientation: 6 }).png().toBuffer();
    const result = await preparePhoto(encoded, "image/png");
    const metadata = await sharp(result).metadata();
    expect(metadata).toMatchObject({ format: "jpeg", width: 100, height: 120 });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
  });

  it("rejects disguised files and malformed bytes without calling OpenAI", async () => {
    await expect(preparePhoto(photo, "image/jpeg")).rejects.toMatchObject({ status: 422 });
    await expect(preparePhoto(Buffer.from("not an image"), "image/png")).rejects.toMatchObject({ status: 422 });
    await expect(preparePhoto(photo, "image/svg+xml")).rejects.toMatchObject({ status: 415 });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects empty, oversized, and too-small images", async () => {
    await expect(preparePhoto(Buffer.alloc(0), "image/png")).rejects.toMatchObject({ status: 413 });
    await expect(preparePhoto(Buffer.alloc(MAX_PHOTO_BYTES + 1), "image/png")).rejects.toMatchObject({ status: 413 });
    const tiny = await sharp({ create: { width: 20, height: 20, channels: 3, background: "white" } }).png().toBuffer();
    await expect(preparePhoto(tiny, "image/png")).rejects.toMatchObject({ status: 422 });
  });
});

describe("photo review service", () => {
  it("does not substitute demo observations when OpenAI is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(reviewPhoto("UNIT-003", photo, "image/png")).rejects.toMatchObject({ status: 503 });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an unknown unit without a provider call", async () => {
    await expect(reviewPhoto("missing", photo, "image/png")).rejects.toMatchObject({ status: 404 });
    expect(create).not.toHaveBeenCalled();
  });

  it("uses one stateless, time-bounded image request with no unit identifiers or tools", async () => {
    create.mockResolvedValue({ status: "completed", output_text: JSON.stringify(assessment) });
    const controller = new AbortController();
    const result = await reviewPhoto("UNIT-003", photo, "image/png", controller.signal);
    expect(result).toMatchObject({ unitId: "UNIT-003", assessment });
    expect(create).toHaveBeenCalledTimes(1);
    expect(clientOptions).toHaveBeenCalledWith({ apiKey: "test-key-never-sent", timeout: 25000, maxRetries: 0 });
    const [input, options] = create.mock.calls[0];
    expect(input).toMatchObject({ store: false, model: "gpt-4.1-mini", text: { format: { type: "json_schema", strict: true } } });
    expect(input.tools).toBeUndefined();
    expect(JSON.stringify(input)).not.toContain("UNIT-003");
    expect(input.input[0].content[1].image_url).toMatch(/^data:image\/jpeg;base64,/);
    expect(options.signal).toBe(controller.signal);
  });

  it.each([
    { status: "incomplete", output_text: JSON.stringify(assessment) },
    { status: "completed", output_text: "not json" },
    { status: "completed", output_text: JSON.stringify({ ...assessment, identity: "John" }) },
  ])("rejects incomplete or unsupported results %#", async (response) => {
    create.mockResolvedValue(response);
    await expect(reviewPhoto("UNIT-003", photo, "image/png")).rejects.toMatchObject({ status: 502 });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does not expose raw provider errors or photo data", async () => {
    create.mockRejectedValue(new Error("key=sk-secret image-data-sensitive"));
    await expect(reviewPhoto("UNIT-003", photo, "image/png")).rejects.toThrow("Photo review could not complete.");
    await expect(reviewPhoto("UNIT-003", photo, "image/png")).rejects.not.toThrow("sk-secret");
  });
});
