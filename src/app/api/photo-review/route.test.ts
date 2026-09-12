import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { PhotoReviewError } from "@/lib/photo-review";
import { MAX_PHOTO_BYTES } from "@/lib/photo-review-types";

const review = vi.hoisted(() => vi.fn());
vi.mock("@/lib/photo-review", () => ({
  reviewPhoto: review,
  PhotoReviewError: class extends Error { constructor(message: string, public status: number) { super(message); } },
}));
beforeEach(() => { review.mockReset(); });

function form() {
  const body = new FormData();
  body.set("unitId", " UNIT-003 ");
  body.set("photo", new Blob(["mock image bytes"], { type: "image/png" }), "room.png");
  return body;
}
function request(body: FormData) { return new Request("http://localhost/api/photo-review", { method: "POST", body }); }

describe("photo review route", () => {
  it("accepts a single upload and prevents caching", async () => {
    review.mockResolvedValue({ unitId: "UNIT-003", assessment: { objects: [] } });
    const response = await POST(request(form()));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(review).toHaveBeenCalledWith("UNIT-003", Buffer.from("mock image bytes"), "image/png", expect.any(AbortSignal));
  });

  it("rejects image URLs and JSON requests", async () => {
    const body = form(); body.set("photo", "https://example.com/room.png");
    expect((await POST(request(body))).status).toBe(400);
    const json = new Request("http://localhost/api/photo-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photo: "https://example.com/room.png" }) });
    expect((await POST(json)).status).toBe(400);
    expect(review).not.toHaveBeenCalled();
  });

  it("rejects duplicate uploads and arbitrary extra context", async () => {
    const duplicate = form(); duplicate.append("photo", new Blob(["other"]), "other.png");
    const extra = form(); extra.set("instructions", "identify the person");
    expect((await POST(request(duplicate))).status).toBe(400);
    expect((await POST(request(extra))).status).toBe(400);
    expect(review).not.toHaveBeenCalled();
  });

  it("limits uploaded file size before the review service", async () => {
    const body = form(); body.set("photo", new Blob([new Uint8Array(MAX_PHOTO_BYTES + 1)], { type: "image/png" }), "large.png");
    expect((await POST(request(body))).status).toBe(413);
    expect(review).not.toHaveBeenCalled();
  });

  it("bounds the entire body even without a declared content length", async () => {
    const bytes = new Uint8Array(MAX_PHOTO_BYTES + 70 * 1024);
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(bytes); controller.close(); },
    });
    const upload = new Request("http://localhost/api/photo-review", {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data; boundary=test" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    expect(upload.headers.has("content-length")).toBe(false);
    expect((await POST(upload)).status).toBe(413);
    expect(review).not.toHaveBeenCalled();
  });

  it("preserves actionable service errors, including missing configuration", async () => {
    review.mockRejectedValue(new PhotoReviewError("Photo review is not configured.", 503));
    const response = await POST(request(form()));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/not configured/);
  });

  it("does not expose unexpected diagnostics", async () => {
    review.mockRejectedValue(new Error("sk-secret photo-bytes"));
    const response = await POST(request(form()));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toMatch(/sk-secret|photo-bytes/);
  });
});
