import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { useEffect, useRef, useState, type RefObject } from "react";

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface FrameDims {
  w: number;
  h: number;
}

/** Per-frame renderer: paint the effect onto `ctx` using the detected face(s). */
export type FaceDrawFn = (
  ctx: CanvasRenderingContext2D,
  faces: Landmark[][],
  dims: FrameDims,
) => void;

export type ArStatus = "loading" | "ready" | "error";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/**
 * Real-time face-AR engine shared by the makeup / eyewear / jewellery try-ons.
 *
 * Acquires the webcam, loads MediaPipe FaceLandmarker (478 landmarks), and runs
 * a requestAnimationFrame loop that resizes the overlay canvas to the video and
 * invokes `draw` with the latest landmarks each frame. Landmarks are normalized
 * [0,1]; the renderer multiplies by `dims`. The video + canvas are mirrored in
 * CSS (selfie view), so drawing math stays in plain video space.
 */
export function useArFace(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  draw: FaceDrawFn,
) {
  const [status, setStatus] = useState<ArStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  // Always render with the latest options without tearing down the camera.
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    let landmarker: FaceLandmarker | null = null;
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;

    async function init() {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
        landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
        });

        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStatus("ready");
        loop();
      } catch (e) {
        if (cancelled) return;
        const err = e as DOMException;
        setError(
          err.name === "NotAllowedError"
            ? "Camera permission denied. Allow access and reload."
            : err.name === "NotFoundError"
              ? "No camera found on this device."
              : `Failed to start AR: ${err.message ?? e}`,
        );
        setStatus("error");
      }
    }

    function loop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!cancelled && landmarker && video && canvas && video.readyState >= 2) {
        const { videoWidth: w, videoHeight: h } = video;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const result = landmarker.detectForVideo(video, performance.now());
          ctx.clearRect(0, 0, w, h);
          if (result.faceLandmarks.length > 0) {
            drawRef.current(ctx, result.faceLandmarks as Landmark[][], { w, h });
          }
        }
      }
      if (!cancelled) raf = requestAnimationFrame(loop);
    }

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      landmarker?.close();
    };
    // draw is read fresh each frame via closure; re-running on its identity
    // would tear down the camera every render. Intentionally mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, error };
}
