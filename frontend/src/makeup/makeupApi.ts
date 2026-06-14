/** Calls the high-fidelity generative makeup transfer endpoint (Stable-Makeup via RunPod). */
export async function requestMakeupTransfer(args: {
  source: File;
  reference: File;
  intensity: number;
}): Promise<string> {
  const form = new FormData();
  form.append("source", args.source);
  form.append("reference", args.reference);
  form.append("intensity", String(args.intensity));

  const res = await fetch("/api/makeup", { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Makeup transfer failed (${res.status}).`);
  }
  return (await res.json()).result_url as string;
}
