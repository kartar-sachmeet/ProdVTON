import { useCallback, useEffect, useRef, useState } from "react";
import { useLucyRealtime } from "../hooks/useLucyRealtime";
import { resolveGarmentUrl } from "../lib/garment";
import type { GarmentInputMode } from "../types";
import { CameraFeed } from "./CameraFeed";
import { GarmentInput } from "./GarmentInput";

/** Real-time webcam virtual try-on powered by Decart Lucy2 VTON over WebRTC. */
export function LiveTryOn() {
  const [garmentMode, setGarmentMode] = useState<GarmentInputMode>("upload");
  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const [garmentUrl, setGarmentUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const outputRef = useRef<HTMLVideoElement>(null);
  const getOutputVideo = useCallback(() => outputRef.current, []);
  const lucy = useLucyRealtime(getOutputVideo);

  // Tear down the (billed) realtime session if the user navigates away.
  const stopRef = useRef(lucy.stop);
  stopRef.current = lucy.stop;
  useEffect(() => () => stopRef.current(), []);

  const isStreaming = lucy.status === "connecting" || lucy.status === "live";
  const hasGarment =
    garmentMode === "upload" ? garmentFile !== null : garmentUrl.trim() !== "";
  const hasInstruction = hasGarment || prompt.trim() !== "";
  const canStart = stream !== null && hasInstruction && !isStreaming && !preparing;

  async function handleStart() {
    if (!stream) return;
    setLocalError(null);
    setPreparing(true);
    try {
      const referenceUrl = await resolveGarmentUrl(garmentMode, garmentFile, garmentUrl);
      lucy.start(stream, { prompt, reference_image_url: referenceUrl });
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Failed to prepare the garment.");
    } finally {
      setPreparing(false);
    }
  }

  const error = localError ?? lucy.error;

  return (
    <div className="live">
      <p className="subtitle">
        Try clothes on live over your webcam. Powered by Decart Lucy2 VTON.
      </p>

      <div className="live-grid">
        <div className="live-col">
          <CameraFeed onStream={setStream} />
          <GarmentInput
            mode={garmentMode}
            onModeChange={setGarmentMode}
            file={garmentFile}
            onFileChange={setGarmentFile}
            url={garmentUrl}
            onUrlChange={setGarmentUrl}
          />
          <div className="field">
            <label className="field-label" htmlFor="live-prompt">
              Prompt (optional)
            </label>
            <input
              id="live-prompt"
              type="text"
              placeholder="e.g. oversized casual fit, rolled sleeves"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <div className="live-controls">
            {!isStreaming ? (
              <button type="button" onClick={handleStart} disabled={!canStart}>
                {preparing ? "Preparing…" : "Start live try-on"}
              </button>
            ) : (
              <>
                <button type="button" onClick={lucy.stop}>
                  Stop
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    lucy.update({ prompt, reference_image_url: undefined })
                  }
                  title="Apply the current prompt without changing the garment"
                >
                  Update prompt
                </button>
              </>
            )}
          </div>

          {isStreaming && (
            <p className="cost-note">
              ● {lucy.status === "live" ? "Live" : "Connecting…"} — billed at $0.02/sec while streaming.
            </p>
          )}
          {error && <p className="error">{error}</p>}
        </div>

        <div className="live-col">
          <span className="field-label">Result</span>
          <video
            ref={outputRef}
            className="output-video"
            autoPlay
            playsInline
            muted
            aria-label="transformed output"
          />
          {!isStreaming && <p className="hint">The transformed feed appears here.</p>}
        </div>
      </div>
    </div>
  );
}
