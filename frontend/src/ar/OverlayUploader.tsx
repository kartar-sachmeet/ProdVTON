import type { OverlayImageState } from "./useOverlayImage";

interface Props {
  label: string;
  inputId: string;
  state: OverlayImageState;
}

/** Upload control for an accessory overlay image: file picker, white-knockout, size slider. */
export function OverlayUploader({ label, inputId, state }: Props) {
  const { file, setFile, removeWhite, setRemoveWhite, scale, setScale, image, error } = state;

  return (
    <div className="ar-control-group">
      <label className="ar-toggle" htmlFor={inputId}>
        {label} image
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {file && (
        <>
          <label className="ar-toggle">
            <input
              type="checkbox"
              checked={removeWhite}
              onChange={() => setRemoveWhite(!removeWhite)}
            />
            Remove white background
          </label>
          <label className="ar-slider">
            Size
            <input
              type="range"
              min={0.4}
              max={2.5}
              step={0.05}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
            />
          </label>
          <button type="button" className="ar-style-btn" onClick={() => setFile(null)}>
            Clear {label.toLowerCase()}
          </button>
        </>
      )}
      {image && <span className="hint">Using your uploaded {label.toLowerCase()}.</span>}
      {error && <span className="error">{error}</span>}
    </div>
  );
}
