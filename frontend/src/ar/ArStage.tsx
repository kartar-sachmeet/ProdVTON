import { useRef } from "react";
import { useArFace, type FaceDrawFn } from "./useArFace";

interface Props {
  draw: FaceDrawFn;
}

/** Mirrored webcam + overlay canvas running a face-AR renderer. */
export function ArStage({ draw }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { status, error } = useArFace(videoRef, canvasRef, draw);

  return (
    <div className="ar-stage">
      <div className="ar-frame">
        <video ref={videoRef} className="ar-video" playsInline muted aria-label="camera" />
        <canvas ref={canvasRef} className="ar-canvas" />
        {status === "loading" && <div className="ar-overlay-msg">Loading camera & face model…</div>}
        {status === "error" && <div className="ar-overlay-msg error">{error}</div>}
      </div>
    </div>
  );
}
