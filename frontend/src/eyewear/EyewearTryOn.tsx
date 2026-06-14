import { useMemo, useState } from "react";
import { ArStage } from "../ar/ArStage";
import { OverlayUploader } from "../ar/OverlayUploader";
import { useOverlayImage } from "../ar/useOverlayImage";
import { makeEyewearDraw, type EyewearOptions, type FrameStyle, type RGB } from "./eyewearDraw";

const STYLES: { id: FrameStyle; label: string }[] = [
  { id: "round", label: "Round" },
  { id: "square", label: "Square" },
  { id: "aviator", label: "Aviator" },
];

const COLORS: { name: string; color: RGB }[] = [
  { name: "Black", color: { r: 25, g: 25, b: 28 } },
  { name: "Tortoise", color: { r: 120, g: 75, b: 35 } },
  { name: "Gold", color: { r: 200, g: 165, b: 70 } },
  { name: "Silver", color: { r: 180, g: 185, b: 195 } },
  { name: "Red", color: { r: 190, g: 45, b: 45 } },
];

const swatchStyle = ({ r, g, b }: RGB) => ({ backgroundColor: `rgb(${r},${g},${b})` });

export function EyewearTryOn() {
  const [opts, setOpts] = useState<Omit<EyewearOptions, "image" | "imageScale">>({
    style: "round",
    color: COLORS[0].color,
    tinted: false,
  });
  const glasses = useOverlayImage();

  const draw = useMemo(
    () => makeEyewearDraw({ ...opts, image: glasses.image, imageScale: glasses.scale }),
    [opts, glasses.image, glasses.scale],
  );
  const usingPhoto = glasses.image !== null;

  return (
    <div className="ar-page">
      <p className="subtitle">
        Real-time eyewear try-on — MediaPipe face mesh positions the frames by your eye landmarks,
        scaled and rotated to your head. Upload your own glasses photo, or use a built-in shape.
        Browser-only, no server.
      </p>
      <div className="ar-layout">
        <ArStage draw={draw} />
        <div className="ar-controls">
          <OverlayUploader label="Glasses" inputId="eyewear-upload" state={glasses} />

          {usingPhoto && <span className="hint">Built-in frames are paused while your photo is in use.</span>}

          <div className="ar-control-group" style={usingPhoto ? { opacity: 0.4 } : undefined}>
            <span className="ar-toggle">Frame shape</span>
            <div className="swatches">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`ar-style-btn${opts.style === s.id ? " active" : ""}`}
                  onClick={() => setOpts((o) => ({ ...o, style: s.id }))}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ar-control-group">
            <span className="ar-toggle">Frame color</span>
            <div className="swatches">
              {COLORS.map((c) => {
                const active =
                  opts.color.r === c.color.r && opts.color.g === c.color.g && opts.color.b === c.color.b;
                return (
                  <button
                    key={c.name}
                    type="button"
                    title={c.name}
                    aria-label={`Frame ${c.name}`}
                    className={`swatch${active ? " active" : ""}`}
                    style={swatchStyle(c.color)}
                    onClick={() => setOpts((o) => ({ ...o, color: c.color }))}
                  />
                );
              })}
            </div>
          </div>

          <label className="ar-toggle">
            <input
              type="checkbox"
              checked={opts.tinted}
              onChange={() => setOpts((o) => ({ ...o, tinted: !o.tinted }))}
            />
            Sunglasses tint
          </label>
        </div>
      </div>
    </div>
  );
}
