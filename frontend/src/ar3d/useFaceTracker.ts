import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { useEffect, useRef, useState, type RefObject } from "react";

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface TrackFrame {
  landmarks: Landmark[];
  /** 4x4 column-major facial transformation matrix (head pose), or null. */
  matrix: number[] | null;
  w: number;
  h: number;
}

export type TrackerStatus = "loading" | "ready" | "error";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/**
 * Webcam + MediaPipe FaceLandmarker with head-pose output. Calls `onFrame` every
 * animation frame with the latest landmarks and 4x4 transform. The consumer
 * (e.g. a three.js stage) does its own rendering inside the callback.
 */
export function useFaceTracker(
  videoRef: RefObject<HTMLVideoElement | null>,
  onFrame: (frame: TrackFrame, video: HTMLVideoElement) => void,
) {
  const [status, setStatus] = useState<TrackerStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

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
          outputFacialTransformationMatrixes: true,
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
      if (!cancelled && landmarker && video && video.readyState >= 2) {
        const result = landmarker.detectForVideo(video, performance.now());
        if (result.faceLandmarks.length > 0) {
          onFrameRef.current(
            {
              landmarks: result.faceLandmarks[0] as Landmark[],
              matrix: result.facialTransformationMatrixes?.[0]?.data
                ? Array.from(result.facialTransformationMatrixes[0].data)
                : null,
              w: video.videoWidth,
              h: video.videoHeight,
            },
            video,
          );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, error };
}
