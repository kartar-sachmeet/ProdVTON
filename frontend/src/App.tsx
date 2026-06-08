import { useState } from "react";
import "./App.css";
import { requestTryOn } from "./api";
import { GarmentInput } from "./components/GarmentInput";
import { GenerateButton } from "./components/GenerateButton";
import { PersonUploader } from "./components/PersonUploader";
import { ResultView } from "./components/ResultView";
import { SessionGallery } from "./components/SessionGallery";
import type { GarmentInputMode, TryOnResult } from "./types";

export default function App() {
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
        { id: crypto.randomUUID(), resultUrl: url, createdAt: Date.now() },
        ...prev,
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app">
      <h1>ProdVton — Virtual Try-On</h1>
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
    </main>
  );
}
