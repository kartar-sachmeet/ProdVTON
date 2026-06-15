import { useState } from "react";
import { ArStage3D } from "../ar3d/ArStage3D";
import { ingestTo3D } from "../ar3d/ingest3d";

/**
 * Eyewear try-on. Upload a product photo → the image-to-3D ingestion worker
 * (TRELLIS on RunPod) reconstructs a GLB → it's posed live on your head in
 * three.js (PBR + head pose + occluder). No fake built-in frames.
 */
export function Eyewear3DTryOn() {
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
        Real-time 3D eyewear — upload a glasses product photo and the ingestion worker reconstructs
        a 3D model (TRELLIS), then three.js poses it on your head live with PBR + occlusion.
        Requires the image-to-3D RunPod endpoint configured in the backend.
      </p>
      <div className="ar-layout">
        <ArStage3D
          glbUrl={glbUrl}
          rebuildKey={glbUrl ?? "none"}
          placeholder="Upload a glasses product photo to generate a 3D try-on."
        />
        <div className="ar-controls">
          <div className="ar-control-group">
            <span className="ar-toggle">Glasses product photo</span>
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
