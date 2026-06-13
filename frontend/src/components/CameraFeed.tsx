import { useEffect, useRef, useState } from "react";

interface Props {
  /** Called with the live camera stream once available, or null on teardown. */
  onStream: (stream: MediaStream | null) => void;
}

/** Requests webcam access and shows a local preview. Lifts the stream to the parent. */
export function CameraFeed({ onStream }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: { width: 720, height: 1280 }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
        setReady(true);
        onStream(s);
      })
      .catch((e: DOMException) => {
        if (cancelled) return;
        const message =
          e.name === "NotAllowedError"
            ? "Camera permission denied. Allow access and reload."
            : e.name === "NotFoundError"
              ? "No camera found on this device."
              : `Could not start camera: ${e.message}`;
        setError(message);
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      onStream(null);
    };
    // onStream is stable (useCallback in parent); run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="field">
      <span className="field-label">Your camera</span>
      {error ? (
        <p className="error">{error}</p>
      ) : (
        <video
          ref={videoRef}
          className="camera-preview"
          autoPlay
          playsInline
          muted
          aria-label="camera preview"
        />
      )}
      {!ready && !error && <p className="hint">Requesting camera…</p>}
    </div>
  );
}
