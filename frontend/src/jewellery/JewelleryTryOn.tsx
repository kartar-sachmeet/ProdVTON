import { useMemo, useState } from "react";
import { ArStage } from "../ar/ArStage";
import { OverlayUploader } from "../ar/OverlayUploader";
import { useOverlayImage } from "../ar/useOverlayImage";
import { makeJewelleryDraw, type EarringStyle, type JewelleryOptions, type RGB } from "./jewelleryDraw";

const EARRING_STYLES: { id: EarringStyle; label: string }[] = [
  { id: "studs", label: "Studs" },
  { id: "drops", label: "Drops" },
  { id: "hoops", label: "Hoops" },
];

const METALS: { name: string; color: RGB }[] = [
  { name: "Gold", color: { r: 212, g: 175, b: 55 } },
  { name: "Silver", color: { r: 200, g: 205, b: 215 } },
  { name: "Rose Gold", color: { r: 215, g: 150, b: 130 } },
];

const swatchStyle = ({ r, g, b }: RGB) => ({ backgroundColor: `rgb(${r},${g},${b})` });

export function JewelleryTryOn() {
  const [opts, setOpts] = useState<
    Omit<JewelleryOptions, "earringImage" | "earringImageScale" | "necklaceImage" | "necklaceImageScale">
  >({
    earrings: { on: true, style: "drops" },
    necklace: { on: true },
    metal: METALS[0].color,
  });
  const earringImg = useOverlayImage();
  const necklaceImg = useOverlayImage();

  const draw = useMemo(
    () =>
      makeJewelleryDraw({
        ...opts,
        earringImage: earringImg.image,
        earringImageScale: earringImg.scale,
        necklaceImage: necklaceImg.image,
        necklaceImageScale: necklaceImg.scale,
      }),
    [opts, earringImg.image, earringImg.scale, necklaceImg.image, necklaceImg.scale],
  );

  return (
    <div className="ar-page">
      <p className="subtitle">
        Real-time jewellery try-on — MediaPipe face mesh anchors earrings to your earlobes and
        drapes a necklace below your chin. Upload your own earring/necklace photos, or use built-in
        styles. Browser-only, no server. (Rings need hand tracking — a future add.)
      </p>
      <div className="ar-layout">
        <ArStage draw={draw} />
        <div className="ar-controls">
          <OverlayUploader label="Earring" inputId="earring-upload" state={earringImg} />
          <OverlayUploader label="Necklace" inputId="necklace-upload" state={necklaceImg} />

          <div className="ar-control-group">
            <label className="ar-toggle">
              <input
                type="checkbox"
                checked={opts.earrings.on}
                onChange={() => setOpts((o) => ({ ...o, earrings: { ...o.earrings, on: !o.earrings.on } }))}
              />
              Earrings {earringImg.image && <span className="hint">(your photo)</span>}
            </label>
            <div className="swatches">
              {EARRING_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`ar-style-btn${opts.earrings.style === s.id ? " active" : ""}`}
                  onClick={() => setOpts((o) => ({ ...o, earrings: { ...o.earrings, style: s.id } }))}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <label className="ar-toggle">
            <input
              type="checkbox"
              checked={opts.necklace.on}
              onChange={() => setOpts((o) => ({ ...o, necklace: { on: !o.necklace.on } }))}
            />
            Necklace {necklaceImg.image && <span className="hint">(your photo)</span>}
          </label>

          <div className="ar-control-group">
            <span className="ar-toggle">Metal</span>
            <div className="swatches">
              {METALS.map((m) => {
                const active =
                  opts.metal.r === m.color.r && opts.metal.g === m.color.g && opts.metal.b === m.color.b;
                return (
                  <button
                    key={m.name}
                    type="button"
                    title={m.name}
                    aria-label={`Metal ${m.name}`}
                    className={`swatch${active ? " active" : ""}`}
                    style={swatchStyle(m.color)}
                    onClick={() => setOpts((o) => ({ ...o, metal: m.color }))}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
