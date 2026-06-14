/**
 * Sends a product photo to the image-to-3D ingestion worker and returns a blob
 * object URL for the generated GLB (load it with GLTFLoader). Caller revokes it.
 */
export async function ingestTo3D(image: File): Promise<string> {
  const form = new FormData();
  form.append("image", image);
  const res = await fetch("/api/ingest-3d", { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `3D ingestion failed (${res.status}).`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
