import { useEffect, useState } from "react";

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
}

export function PersonUploader({ file, onChange }: Props) {
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
      <label className="field-label" htmlFor="person-input">
        Person photo
      </label>
      <input
        id="person-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {preview && <img className="preview" src={preview} alt="person preview" />}
    </div>
  );
}
