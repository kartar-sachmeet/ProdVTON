import { useEffect, useRef, useState } from "react";

interface Props {
  /** Receives a still frame captured from the webcam as a PNG File. */
  onCapture: (file: File) => void;
}

/** Live webcam preview with a shutter button that grabs a still frame. */
export function CameraCapture({ onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: { width: 1280, height: 720, facingMode: "user" }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
        setReady(true);
      })
      .catch((e: DOMException) => {
        if (cancelled) return;
        setError(
          e.name === "NotAllowedError"
            ? "Camera permission denied. Allow access and reload."
            : e.name === "NotFoundError"
              ? "No camera found on this device."
              : `Could not start camera: ${e.message}`,
        );
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Draw the true (unmirrored) frame — the preview is mirrored only for UX.
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) onCapture(new File([blob], `capture-${Date.now()}.png`, { type: "image/png" }));
    }, "image/png");
  }

  if (error) return <p className="error">{error}</p>;

  return (
    <div className="capture">
      <video ref={videoRef} className="capture-video" autoPlay playsInline muted aria-label="camera" />
      <button type="button" className="ar-style-btn" onClick={capture} disabled={!ready}>
        {ready ? "📸 Capture photo" : "Starting camera…"}
      </button>
    </div>
  );
}
