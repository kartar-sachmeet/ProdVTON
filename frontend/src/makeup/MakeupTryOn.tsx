import { useMemo, useState } from "react";
import { ArStage } from "../ar/ArStage";
import { MakeupGenerative } from "./MakeupGenerative";
import { makeMakeupDraw, type MakeupOptions, type RGB } from "./makeupDraw";

type MakeupMode = "live" | "generative";

interface Shade {
  name: string;
  color: RGB;
}

const LIP_SHADES: Shade[] = [
  { name: "Classic Red", color: { r: 200, g: 30, b: 45 } },
  { name: "Berry", color: { r: 150, g: 30, b: 80 } },
  { name: "Coral", color: { r: 240, g: 110, b: 95 } },
  { name: "Nude", color: { r: 190, g: 120, b: 110 } },
  { name: "Plum", color: { r: 110, g: 35, b: 75 } },
];
const EYE_SHADES: Shade[] = [
  { name: "Bronze", color: { r: 160, g: 100, b: 50 } },
  { name: "Smoky", color: { r: 70, g: 65, b: 75 } },
  { name: "Rose Gold", color: { r: 200, g: 140, b: 130 } },
  { name: "Teal", color: { r: 40, g: 130, b: 130 } },
  { name: "Purple", color: { r: 120, g: 80, b: 170 } },
];
const BLUSH_SHADES: Shade[] = [
  { name: "Peach", color: { r: 245, g: 150, b: 120 } },
  { name: "Rose", color: { r: 230, g: 110, b: 130 } },
  { name: "Coral", color: { r: 250, g: 120, b: 100 } },
];

const swatchStyle = ({ r, g, b }: RGB) => ({ backgroundColor: `rgb(${r},${g},${b})` });

export function MakeupTryOn() {
  const [mode, setMode] = useState<MakeupMode>("live");
  const [opts, setOpts] = useState<MakeupOptions>({
    lipstick: { on: true, color: LIP_SHADES[0].color },
    eyeshadow: { on: true, color: EYE_SHADES[0].color },
    blush: { on: true, color: BLUSH_SHADES[0].color },
  });

  const draw = useMemo(() => makeMakeupDraw(opts), [opts]);

  const toggle = (key: keyof MakeupOptions) =>
    setOpts((o) => ({ ...o, [key]: { ...o[key], on: !o[key].on } }));
  const setColor = (key: keyof MakeupOptions, color: RGB) =>
    setOpts((o) => ({ ...o, [key]: { ...o[key], color } }));

  const sections: { key: keyof MakeupOptions; label: string; shades: Shade[] }[] = [
    { key: "lipstick", label: "Lipstick", shades: LIP_SHADES },
    { key: "eyeshadow", label: "Eyeshadow", shades: EYE_SHADES },
    { key: "blush", label: "Blush", shades: BLUSH_SHADES },
  ];

  return (
    <div className="ar-page">
      <div className="toggle" style={{ marginBottom: "0.75rem" }}>
        <button type="button" className={mode === "live" ? "active" : ""} onClick={() => setMode("live")}>
          Live AR (real-time)
        </button>
        <button type="button" className={mode === "generative" ? "active" : ""} onClick={() => setMode("generative")}>
          High-fidelity (generative)
        </button>
      </div>

      {mode === "generative" ? (
        <>
          <p className="subtitle">
            Generative makeup transfer (Stable-Makeup via RunPod) — upload a face + a reference look.
            Higher fidelity, not real-time. Requires the makeup endpoint configured in the backend.
          </p>
          <MakeupGenerative />
        </>
      ) : (
      <>
      <p className="subtitle">
        Real-time AR makeup — MediaPipe face mesh + procedural rendering, all in your browser. No
        server, no API keys.
      </p>
      <div className="ar-layout">
        <ArStage draw={draw} />
        <div className="ar-controls">
          {sections.map(({ key, label, shades }) => (
            <div className="ar-control-group" key={key}>
              <label className="ar-toggle">
                <input type="checkbox" checked={opts[key].on} onChange={() => toggle(key)} />
                {label}
              </label>
              <div className="swatches">
                {shades.map((s) => {
                  const active =
                    opts[key].color.r === s.color.r &&
                    opts[key].color.g === s.color.g &&
                    opts[key].color.b === s.color.b;
                  return (
                    <button
                      key={s.name}
                      type="button"
                      title={s.name}
                      aria-label={`${label} ${s.name}`}
                      className={`swatch${active ? " active" : ""}`}
                      style={swatchStyle(s.color)}
                      onClick={() => setColor(key, s.color)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
