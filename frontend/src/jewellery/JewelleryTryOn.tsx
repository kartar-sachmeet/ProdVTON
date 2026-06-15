import { useState } from "react";
import { ingestTo3D } from "../ar3d/ingest3d";
import { JewelleryStage, type JewelleryMode } from "../ar3d/JewelleryStage";

const MODES: { id: JewelleryMode; label: string }[] = [
  { id: "earrings", label: "Earrings" },
  { id: "necklace", label: "Necklace" },
];

/**
 * Jewellery try-on. Upload a product photo → image-to-3D ingestion (TRELLIS) →
 * the GLB is posed live: earrings as a mirrored pair on the earlobes, or a
 * necklace draped below the chin. Requires the image-to-3D RunPod endpoint.
 */
export function JewelleryTryOn() {
  const [mode, setMode] = useState<JewelleryMode>("earrings");
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ingest(file: File) {
    setIngesting(true);
    setError(null);
    try {
      const url = await ingestTo3D(file);
      setGlbUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "3D ingestion failed.");
    } finally {
      setIngesting(false);
    }
  }

  return (
    <div className="ar-page">
      <p className="subtitle">
        Real-time 3D jewellery — upload an earring or necklace product photo; the ingestion worker
        (TRELLIS) reconstructs a 3D model, then it's posed live on your earlobes / neck. Requires
        the image-to-3D RunPod endpoint. (Necklace draping is chin-based; full neck/shoulder
        tracking via MediaPipe Pose is a follow-up.)
      </p>
      <div className="ar-layout">
        <JewelleryStage
          glbUrl={glbUrl}
          mode={mode}
          placeholder="Upload a jewellery product photo to generate a 3D try-on."
        />
        <div className="ar-controls">
          <div className="ar-control-group">
            <span className="ar-toggle">Type</span>
            <div className="swatches">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`ar-style-btn${mode === m.id ? " active" : ""}`}
                  onClick={() => setMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="ar-control-group">
            <span className="ar-toggle">Product photo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && ingest(e.target.files[0])}
            />
            {ingesting && <span className="hint">Reconstructing 3D model… (GPU, ~30–60s)</span>}
            {glbUrl && !ingesting && <span className="hint">Showing your generated 3D model.</span>}
            {glbUrl && (
              <button type="button" className="ar-style-btn" onClick={() => setGlbUrl(null)}>
                Clear
              </button>
            )}
            {error && <span className="error">{error}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
