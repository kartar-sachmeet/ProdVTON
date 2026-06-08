interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
}

export function PersonUploader({ file, onChange }: Props) {
  return (
    <div className="field">
      <label className="field-label">Person photo</label>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file && <img className="preview" src={URL.createObjectURL(file)} alt="person preview" />}
    </div>
  );
}
