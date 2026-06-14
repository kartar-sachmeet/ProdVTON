import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFaceTracker, type Landmark, type TrackFrame } from "./useFaceTracker";

interface Props {
  /** Builds the 3D accessory; re-invoked whenever `rebuildKey` changes. */
  buildModel: () => THREE.Object3D;
  /** Change this (e.g. a serialized options string) to swap the model live. */
  rebuildKey: string;
}

const px = (lm: Landmark, w: number, h: number) => ({ x: lm.x * w, y: lm.y * h });
const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * three.js overlay for rigid-accessory AR. An orthographic camera maps world
 * units 1:1 to video pixels (origin top-left, y down), so we position the model
 * using the same landmark-pixel math the 2D version used — but render a real 3D
 * object with PBR lighting and a depth-only occluder so temples hide behind the
 * head. Pose (roll/yaw/pitch) is estimated from landmarks.
 *
 * NOTE: offset/scale/rotation constants below are reasonable defaults but need
 * on-camera tuning — placement realism can't be verified without a live feed.
 */
export function ArStage3D({ buildModel, rebuildKey }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const anchorRef = useRef<THREE.Group | null>(null);
  const occluderRef = useRef<THREE.Mesh | null>(null);
  const buildModelRef = useRef(buildModel);
  buildModelRef.current = buildModel;

  // Set up the three.js scene once.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, 1, 0, 1, -2000, 2000);
    camera.position.z = 1000;

    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(0.2, -0.5, 1);
    scene.add(key);

    const anchor = new THREE.Group();
    scene.add(anchor); // model added/replaced by the rebuild effect below

    // Depth-only occluder approximating the head: writes depth, not color, so
    // model geometry behind it (temples) is hidden.
    const occluder = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 24),
      new THREE.MeshBasicMaterial({ colorWrite: false }),
    );
    scene.add(occluder);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    anchorRef.current = anchor;
    occluderRef.current = occluder;

    return () => {
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap the accessory model when options change, without restarting the camera.
  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    anchor.clear();
    anchor.add(buildModelRef.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rebuildKey]);

  const onFrame = (frame: TrackFrame) => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const anchor = anchorRef.current;
    const occluder = occluderRef.current;
    if (!renderer || !scene || !camera || !anchor || !occluder) return;

    const { w, h, landmarks } = frame;
    if (renderer.domElement.width !== w || renderer.domElement.height !== h) {
      renderer.setSize(w, h, false);
      camera.right = w;
      camera.bottom = h;
      camera.updateProjectionMatrix();
    }

    const rEye = mid(px(landmarks[33], w, h), px(landmarks[133], w, h));
    const lEye = mid(px(landmarks[263], w, h), px(landmarks[362], w, h));
    const eyeMid = mid(rEye, lEye);
    const nose = px(landmarks[1], w, h);
    const forehead = px(landmarks[10], w, h);
    const chin = px(landmarks[152], w, h);
    const iod = dist(rEye, lEye);
    const faceH = dist(forehead, chin) || iod * 2;

    const roll = Math.atan2(lEye.y - rEye.y, lEye.x - rEye.x);
    const yaw = clamp((nose.x - eyeMid.x) / (iod * 0.5), -1, 1) * 0.6;
    const pitch = clamp((nose.y - eyeMid.y) / faceH - 0.18, -0.6, 0.6);

    anchor.position.set(eyeMid.x, eyeMid.y, 0);
    anchor.scale.setScalar(iod);
    // y-down ortho → flip roll/pitch signs so the model follows the head.
    anchor.rotation.set(-pitch, yaw, -roll);

    occluder.position.set(eyeMid.x, eyeMid.y + faceH * 0.05, -iod * 0.9);
    occluder.scale.set(iod * 1.1, faceH * 0.62, iod * 1.1);

    renderer.render(scene, camera);
  };

  const { status, error } = useFaceTracker(videoRef, onFrame);

  return (
    <div className="ar-frame">
      <video ref={videoRef} className="ar-video" playsInline muted aria-label="camera" />
      <canvas ref={canvasRef} className="ar-canvas" />
      {status === "loading" && <div className="ar-overlay-msg">Loading camera & face model…</div>}
      {status === "error" && <div className="ar-overlay-msg error">{error}</div>}
    </div>
  );
}
