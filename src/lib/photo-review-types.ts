export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const photoObjectLabels = {
  bed_frame: "Bed frames",
  mattress: "Mattresses",
  bunk_bed_frame: "Bunk bed frames",
  sofa: "Sofas",
  room_divider: "Room dividers",
  doorway: "Doorways",
  storage_cabinet: "Storage cabinets",
} as const;

export const photoLayoutLabels = {
  partial_room_view: "Only part of the room is visible.",
  objects_near_doorway: "Objects appear near a doorway; clearance needs an on-site check.",
  temporary_partition_visible: "A freestanding or temporary divider appears visible.",
  multiple_sleeping_surfaces_visible: "Several possible sleeping surfaces are visible; their use is unknown.",
} as const;

export const photoLimitationLabels = {
  blur: "Blur limits visible detail.",
  low_light: "Low light limits visible detail.",
  occlusion: "Objects are partly hidden.",
  cropped_view: "The photo does not show the whole room.",
  perspective: "The camera angle can distort spacing and counts.",
  not_room: "The image does not show an interior room suitable for this review.",
  cannot_assess: "There is not enough visible detail for a useful review.",
} as const;

export type PhotoAssessment = {
  view: "room" | "not_room" | "unclear";
  quality: "clear" | "limited" | "unusable";
  objects: Array<{ kind: keyof typeof photoObjectLabels; visibleCount: number; certainty: "clear" | "uncertain" }>;
  layoutFeatures: Array<keyof typeof photoLayoutLabels>;
  limitations: Array<keyof typeof photoLimitationLabels>;
};

export type PhotoReviewResult = {
  unitId: string;
  reviewedAt: string;
  assessment: PhotoAssessment;
};

function hasExactKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
}

function isChoice(value: unknown, choices: readonly string[]): value is string {
  return typeof value === "string" && choices.includes(value);
}

function isChoiceList(value: unknown, choices: string[]): value is string[] {
  return Array.isArray(value) && value.length <= choices.length && new Set(value).size === value.length &&
    value.every((item) => isChoice(item, choices));
}

// Only finite, display-owned observations are accepted. Model prose cannot become
// a claim about a person, their identity, their tenancy, or legal status.
export function isPhotoAssessment(value: unknown): value is PhotoAssessment {
  if (!hasExactKeys(value, ["view", "quality", "objects", "layoutFeatures", "limitations"])) return false;
  if (!isChoice(value.view, ["room", "not_room", "unclear"]) || !isChoice(value.quality, ["clear", "limited", "unusable"])) return false;
  if (!Array.isArray(value.objects) || value.objects.length > Object.keys(photoObjectLabels).length) return false;
  const kinds = new Set<string>();
  for (const item of value.objects) {
    if (!hasExactKeys(item, ["kind", "visibleCount", "certainty"]) || !isChoice(item.kind, Object.keys(photoObjectLabels)) ||
      !Number.isSafeInteger(item.visibleCount) || Number(item.visibleCount) < 1 || Number(item.visibleCount) > 20 ||
      !isChoice(item.certainty, ["clear", "uncertain"]) || kinds.has(item.kind)) return false;
    kinds.add(item.kind);
  }
  if (!isChoiceList(value.layoutFeatures, Object.keys(photoLayoutLabels)) || !isChoiceList(value.limitations, Object.keys(photoLimitationLabels))) return false;
  if ((value.view !== "room" || value.quality === "unusable") && (value.objects.length > 0 || value.layoutFeatures.length > 0)) return false;
  return value.limitations.length > 0;
}

export function isPhotoReviewResult(value: unknown): value is PhotoReviewResult {
  return hasExactKeys(value, ["unitId", "reviewedAt", "assessment"]) && typeof value.unitId === "string" &&
    typeof value.reviewedAt === "string" && !Number.isNaN(Date.parse(value.reviewedAt)) && isPhotoAssessment(value.assessment);
}
