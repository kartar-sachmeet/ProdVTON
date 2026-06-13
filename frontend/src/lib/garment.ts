import type { GarmentInputMode } from "../types";
import { ensureFalConfigured } from "./fal";

/**
 * Resolves the garment input into a public image URL usable as Lucy's
 * `reference_image_url`. Uploaded files go to fal storage (via our proxy);
 * pasted URLs are used directly. Returns undefined when no garment is set
 * (prompt-only sessions are valid).
 */
export async function resolveGarmentUrl(
  mode: GarmentInputMode,
  file: File | null,
  url: string,
): Promise<string | undefined> {
  if (mode === "url") {
    const trimmed = url.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  if (!file) return undefined;
  const fal = ensureFalConfigured();
  return fal.storage.upload(file);
}
