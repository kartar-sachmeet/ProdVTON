import { useState } from "react";
import { requestMakeupTransfer } from "./makeupApi";

/** High-fidelity (non-real-time) makeup transfer: source face + reference look -> result. */
export function MakeupGenerative() {
  const [source, setSource] = useState<File | null>(null);
  const [reference, setReference] = useState<File | null>(null);
  const [intensity, setIntensity] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const canRun = source !== null && reference !== null && !loading;

  async function run() {
    if (!source || !reference) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await requestMakeupTransfer({ source, reference, intensity }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ar-layout">
      <div className="ar-controls">
        <div className="field">
          <label className="field-label" htmlFor="mk-source">Your face</label>
          <input id="mk-source" type="file" accept="image/*" onChange={(e) => setSource(e.target.files?.[0] ?? null)} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="mk-ref">Reference makeup look</label>
          <input id="mk-ref" type="file" accept="image/*" onChange={(e) => setReference(e.target.files?.[0] ?? null)} />
        </div>
        <label className="ar-slider">
          Intensity
          <input type="range" min={0.2} max={2} step={0.1} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} />
        </label>
        <button type="button" className="btn-primary" onClick={run} disabled={!canRun}>
          {loading ? "Generating…" : "Transfer makeup"}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
      <div className="ar-frame">
        {result ? (
          <img src={result} alt="makeup result" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : (
          <div className="ar-overlay-msg">Upload a face + a reference look, then Transfer.</div>
        )}
      </div>
    </div>
  );
}
