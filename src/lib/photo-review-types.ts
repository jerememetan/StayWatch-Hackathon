export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const photoObjectLabels = {
  rolling_luggage: "Rolling luggage",
  suitcase: "Suitcases",
  travel_bag: "Travel bags",
  luggage_trolley: "Luggage trolleys",
  taxi_or_rideshare: "Taxi or ride-hailing vehicles",
  vehicle_at_dropoff: "Vehicles at the drop-off",
  stacked_bags: "Stacked bags",
} as const;

export const photoLayoutLabels = {
  entrance_or_lobby_view: "The frame shows a building entrance or lobby approach.",
  dropoff_bay_visible: "A drop-off bay or driveway is visible.",
  luggage_near_entrance: "Bags appear near an entrance; purpose needs an on-site check.",
  night_scene: "The frame appears to be a night or low-light exterior scene.",
} as const;

export const photoLimitationLabels = {
  blur: "Blur limits visible detail.",
  low_light: "Low light limits visible detail.",
  occlusion: "Objects are partly hidden.",
  cropped_view: "The still does not show the whole entrance or driveway.",
  perspective: "The camera angle can distort spacing and counts.",
  glare_or_weather: "Glare, rain, or weather limits visible detail.",
  not_exterior: "The image does not show an outdoor building entrance, driveway, or common area suitable for this review.",
  cannot_assess: "There is not enough visible detail for a useful review.",
} as const;

export type PhotoAssessment = {
  view: "exterior" | "not_exterior" | "unclear";
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
  if (!isChoice(value.view, ["exterior", "not_exterior", "unclear"]) || !isChoice(value.quality, ["clear", "limited", "unusable"])) return false;
  if (!Array.isArray(value.objects) || value.objects.length > Object.keys(photoObjectLabels).length) return false;
  const kinds = new Set<string>();
  for (const item of value.objects) {
    if (!hasExactKeys(item, ["kind", "visibleCount", "certainty"]) || !isChoice(item.kind, Object.keys(photoObjectLabels)) ||
      !Number.isSafeInteger(item.visibleCount) || Number(item.visibleCount) < 1 || Number(item.visibleCount) > 20 ||
      !isChoice(item.certainty, ["clear", "uncertain"]) || kinds.has(item.kind)) return false;
    kinds.add(item.kind);
  }
  if (!isChoiceList(value.layoutFeatures, Object.keys(photoLayoutLabels)) || !isChoiceList(value.limitations, Object.keys(photoLimitationLabels))) return false;
  if ((value.view !== "exterior" || value.quality === "unusable") && (value.objects.length > 0 || value.layoutFeatures.length > 0)) return false;
  return value.limitations.length > 0;
}

export function isPhotoReviewResult(value: unknown): value is PhotoReviewResult {
  return hasExactKeys(value, ["unitId", "reviewedAt", "assessment"]) && typeof value.unitId === "string" &&
    typeof value.reviewedAt === "string" && !Number.isNaN(Date.parse(value.reviewedAt)) && isPhotoAssessment(value.assessment);
}
