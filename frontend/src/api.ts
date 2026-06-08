export interface TryOnRequest {
  person: File;
  garmentFile: File | null;
  garmentUrl: string | null;
}

export async function requestTryOn(req: TryOnRequest): Promise<string> {
  const form = new FormData();
  form.append("person", req.person);
  if (req.garmentFile) form.append("garment", req.garmentFile);
  if (req.garmentUrl) form.append("garment_url", req.garmentUrl);

  const response = await fetch("/api/tryon", { method: "POST", body: form });
  if (!response.ok) {
    let detail = "Generation failed. Please try again.";
    try {
      const body = await response.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* keep default */
    }
    throw new Error(detail);
  }
  const data = (await response.json()) as { result_url: string };
  return data.result_url;
}
