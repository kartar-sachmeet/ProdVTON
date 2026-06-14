import { useCallback, useState } from "react";
import { ArStage3D } from "../ar3d/ArStage3D";
import { buildGlasses, type FrameStyle } from "../ar3d/glassesModel";
import { ingestTo3D } from "../ar3d/ingest3d";

const STYLES: { id: FrameStyle; label: string }[] = [
  { id: "round", label: "Round" },
  { id: "square", label: "Square" },
  { id: "aviator", label: "Aviator" },
];

const COLORS: { name: string; hex: number }[] = [
  { name: "Black", hex: 0x19191c },
  { name: "Tortoise", hex: 0x784b23 },
  { name: "Gold", hex: 0xc8a546 },
  { name: "Silver", hex: 0xb4b9c3 },
  { name: "Red", hex: 0xbe2d2d },
];

const swatchStyle = (hex: number) => ({ backgroundColor: `#${hex.toString(16).padStart(6, "0")}` });

export function Eyewear3DTryOn() {
  const [style, setStyle] = useState<FrameStyle>("round");
  const [hex, setHex] = useState(COLORS[0].hex);
  const [tinted, setTinted] = useState(false);
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);

  const buildModel = useCallback(() => buildGlasses(style, hex, tinted), [style, hex, tinted]);
  const rebuildKey = `${style}-${hex}-${tinted}`;

  async function ingest(file: File) {
    setIngesting(true);
    setIngestError(null);
    try {
      const url = await ingestTo3D(file);
      setGlbUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (e) {
      setIngestError(e instanceof Error ? e.message : "3D ingestion failed.");
    } finally {
      setIngesting(false);
    }
  }

  return (
    <div className="ar-page">
      <p className="subtitle">
        Real-time 3D eyewear — three.js renders a true 3D frame with PBR metal and a depth occluder,
        posed to your head by MediaPipe. (Placement constants need on-camera tuning.)
      </p>
      <div className="ar-layout">
        <ArStage3D buildModel={buildModel} rebuildKey={rebuildKey} glbUrl={glbUrl} />
        <div className="ar-controls">
          <div className="ar-control-group">
            <span className="ar-toggle">Your product → 3D</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && ingest(e.target.files[0])}
            />
            {ingesting && <span className="hint">Reconstructing 3D model… (GPU, ~30–60s)</span>}
            {glbUrl && (
              <button type="button" className="ar-style-btn" onClick={() => setGlbUrl(null)}>
                Back to built-in frames
              </button>
            )}
            {ingestError && <span className="error">{ingestError}</span>}
          </div>

          <div className="ar-control-group" style={glbUrl ? { opacity: 0.4 } : undefined}>
            <span className="ar-toggle">Frame shape</span>
            <div className="swatches">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`ar-style-btn${style === s.id ? " active" : ""}`}
                  onClick={() => setStyle(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="ar-control-group">
            <span className="ar-toggle">Frame color</span>
            <div className="swatches">
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  title={c.name}
                  aria-label={`Frame ${c.name}`}
                  className={`swatch${hex === c.hex ? " active" : ""}`}
                  style={swatchStyle(c.hex)}
                  onClick={() => setHex(c.hex)}
                />
              ))}
            </div>
          </div>
          <label className="ar-toggle">
            <input type="checkbox" checked={tinted} onChange={() => setTinted(!tinted)} />
            Sunglasses tint
          </label>
        </div>
      </div>
    </div>
  );
}
