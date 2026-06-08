import { useEffect, useState } from "react";
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
  const [filePreview, setFilePreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setFilePreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setFilePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className="field">
      <label className="field-label" htmlFor="garment-input">
        Garment
      </label>
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
            id="garment-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
          {filePreview && <img className="preview" src={filePreview} alt="garment preview" />}
        </>
      ) : (
        <>
          <input
            id="garment-input"
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
