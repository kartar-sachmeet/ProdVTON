import { useState } from "react";
import { requestTryOn } from "../api";
import type { GarmentInputMode, TryOnResult } from "../types";
import { GarmentInput } from "./GarmentInput";
import { GenerateButton } from "./GenerateButton";
import { PersonUploader } from "./PersonUploader";
import { ResultView } from "./ResultView";
import { SessionGallery } from "./SessionGallery";

/** Single-photo virtual try-on via the fal Kling Kolors model. */
export function PhotoTryOn() {
  const [person, setPerson] = useState<File | null>(null);
  const [garmentMode, setGarmentMode] = useState<GarmentInputMode>("upload");
  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const [garmentUrl, setGarmentUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [results, setResults] = useState<TryOnResult[]>([]);

  const hasGarment = garmentMode === "upload" ? garmentFile !== null : garmentUrl.trim() !== "";
  const canSubmit = person !== null && hasGarment;

  async function handleGenerate() {
    if (!person) return;
    setLoading(true);
    setError(null);
    try {
      const url = await requestTryOn({
        person,
        garmentFile: garmentMode === "upload" ? garmentFile : null,
        garmentUrl: garmentMode === "url" ? garmentUrl.trim() : null,
      });
      setCurrent(url);
      setResults((prev) => [
        { id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, resultUrl: url, createdAt: Date.now() },
        ...prev,
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="photo">
      <p className="subtitle">Upload a photo and a garment to see how it looks.</p>

      <div className="inputs">
        <PersonUploader file={person} onChange={setPerson} />
        <GarmentInput
          mode={garmentMode}
          onModeChange={setGarmentMode}
          file={garmentFile}
          onFileChange={setGarmentFile}
          url={garmentUrl}
          onUrlChange={setGarmentUrl}
        />
      </div>

      <GenerateButton disabled={!canSubmit} loading={loading} onClick={handleGenerate} />
      {error && <p className="error">{error}</p>}
      {current && <ResultView resultUrl={current} />}
      <SessionGallery results={results} />
    </div>
  );
}
