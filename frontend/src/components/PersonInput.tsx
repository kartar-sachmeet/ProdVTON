import { useEffect, useState } from "react";
import { CameraCapture } from "./CameraCapture";

type Mode = "upload" | "camera";

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
}

/** Person photo input: upload a file or capture one from the webcam. */
export function PersonInput({ file, onChange }: Props) {
  const [mode, setMode] = useState<Mode>("upload");
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="field">
      <span className="field-label">Person photo</span>
      <div className="toggle">
        <button type="button" className={mode === "upload" ? "active" : ""} onClick={() => setMode("upload")}>
          Upload
        </button>
        <button type="button" className={mode === "camera" ? "active" : ""} onClick={() => setMode("camera")}>
          Use camera
        </button>
      </div>

      {mode === "upload" ? (
        <input
          id="person-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      ) : (
        <CameraCapture onCapture={onChange} />
      )}

      {preview && <img className="preview" src={preview} alt="person preview" />}
    </div>
  );
}
