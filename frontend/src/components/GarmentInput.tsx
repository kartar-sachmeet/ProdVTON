import type { GarmentInputMode } from "../types";

interface Props {
  mode: GarmentInputMode;
  onModeChange: (mode: GarmentInputMode) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  url: string;
  onUrlChange: (url: string) => void;
}

export function GarmentInput({ mode, onModeChange, file, onFileChange, url, onUrlChange }: Props) {
  return (
    <div className="field">
      <label className="field-label">Garment</label>
      <div className="toggle">
        <button
          type="button"
          className={mode === "upload" ? "active" : ""}
          onClick={() => onModeChange("upload")}
        >
          Upload
        </button>
        <button
          type="button"
          className={mode === "url" ? "active" : ""}
          onClick={() => onModeChange("url")}
        >
          Paste image URL
        </button>
      </div>
      {mode === "upload" ? (
        <>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
          {file && <img className="preview" src={URL.createObjectURL(file)} alt="garment preview" />}
        </>
      ) : (
        <>
          <input
            type="url"
            placeholder="https://.../garment.jpg"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
          />
          {url && <img className="preview" src={url} alt="garment preview" />}
        </>
      )}
    </div>
  );
}
