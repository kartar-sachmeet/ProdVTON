import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { useFaceTracker, type Landmark, type TrackFrame } from "./useFaceTracker";

export type JewelleryMode = "earrings" | "necklace";

interface Props {
  glbUrl?: string | null;
  mode: JewelleryMode;
  placeholder?: string;
}

const px = (lm: Landmark, w: number, h: number) => ({ x: lm.x * w, y: lm.y * h });
const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Center an object at origin and scale its bounding box to `targetHeight`. */
function normalizeToHeight(obj: THREE.Object3D, targetHeight: number) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = size.y > 0 ? targetHeight / size.y : 1;
  obj.scale.multiplyScalar(scale);
  obj.position.sub(center.multiplyScalar(scale));
}

/**
 * Jewellery AR stage. Loads the ingested GLB and poses it on the face: earrings
 * as a mirrored pair hung from the earlobe landmarks, or a necklace draped below
 * the chin. (Necklace anchoring is chin-based; true neck/shoulder draping wants
 * MediaPipe Pose — a follow-up.) Placement constants need on-camera tuning.
 */
export function JewelleryStage({ glbUrl, mode, placeholder }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const groupsRef = useRef<THREE.Group[]>([]);
  const occluderRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, 1, 0, 1, -2000, 2000);
    camera.position.z = 1000;
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(0.2, -0.5, 1);
    scene.add(key);
    const occluder = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), new THREE.MeshBasicMaterial({ colorWrite: false }));
    scene.add(occluder);
    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    occluderRef.current = occluder;
    return () => renderer.dispose();
  }, []);

  // (Re)build the model instances when the GLB or mode changes.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    let cancelled = false;
    groupsRef.current.forEach((g) => scene.remove(g));
    groupsRef.current = [];
    if (!glbUrl) return;

    new GLTFLoader().load(glbUrl, (gltf) => {
      if (cancelled) return;
      const count = mode === "earrings" ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const clone = gltf.scene.clone(true);
        normalizeToHeight(clone, 1); // unit height; group scale sizes it at runtime
        const g = new THREE.Group();
        g.add(clone);
        scene.add(g);
        groupsRef.current.push(g);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [glbUrl, mode]);

  const onFrame = (frame: TrackFrame) => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const occluder = occluderRef.current;
    const groups = groupsRef.current;
    if (!renderer || !scene || !camera || !occluder) return;

    const { w, h, landmarks } = frame;
    if (renderer.domElement.width !== w || renderer.domElement.height !== h) {
      renderer.setSize(w, h, false);
      camera.right = w;
      camera.bottom = h;
      camera.updateProjectionMatrix();
    }

    const rEye = mid(px(landmarks[33], w, h), px(landmarks[133], w, h));
    const lEye = mid(px(landmarks[263], w, h), px(landmarks[362], w, h));
    const rEar = px(landmarks[234], w, h);
    const lEar = px(landmarks[454], w, h);
    const chin = px(landmarks[152], w, h);
    const forehead = px(landmarks[10], w, h);
    const faceH = dist(forehead, chin) || dist(rEye, lEye) * 2;
    const faceW = dist(rEar, lEar);
    const roll = Math.atan2(lEye.y - rEye.y, lEye.x - rEye.x);

    if (mode === "earrings" && groups.length === 2) {
      const drop = faceH * 0.06;
      const earH = faceH * 0.14;
      const place = (g: THREE.Group, ear: { x: number; y: number }, flip: number) => {
        g.position.set(ear.x, ear.y + drop + earH / 2, 0);
        g.scale.set(flip * earH, earH, earH); // negative x mirrors the left earring
        g.rotation.z = -roll;
      };
      place(groups[0], rEar, 1);
      place(groups[1], lEar, -1);
    } else if (mode === "necklace" && groups.length === 1) {
      const g = groups[0];
      g.position.set(chin.x, chin.y + faceH * 0.22, 0);
      g.scale.setScalar(faceW * 0.6);
      g.rotation.z = -roll;
    }

    occluder.position.set(mid(rEye, lEye).x, mid(rEye, lEye).y + faceH * 0.05, -faceW);
    occluder.scale.set(faceW * 0.55, faceH * 0.62, faceW * 0.55);
    renderer.render(scene, camera);
  };

  const { status, error } = useFaceTracker(videoRef, onFrame);

  return (
    <div className="ar-frame">
      <video ref={videoRef} className="ar-video" playsInline muted aria-label="camera" />
      <canvas ref={canvasRef} className="ar-canvas" />
      {status === "loading" && <div className="ar-overlay-msg">Loading camera & face model…</div>}
      {status === "error" && <div className="ar-overlay-msg error">{error}</div>}
      {status === "ready" && !glbUrl && placeholder && <div className="ar-overlay-msg">{placeholder}</div>}
    </div>
  );
}
