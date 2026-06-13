import type { FaceDrawFn, FrameDims, Landmark } from "../ar/useArFace";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface MakeupOptions {
  lipstick: { on: boolean; color: RGB };
  eyeshadow: { on: boolean; color: RGB };
  blush: { on: boolean; color: RGB };
}

// Canonical MediaPipe FaceLandmarker (468/478) index loops.
const LIPS_OUTER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
const LIPS_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
const RIGHT_EYE_UPPER = [33, 246, 161, 160, 159, 158, 157, 173, 133];
const LEFT_EYE_UPPER = [263, 466, 388, 387, 386, 385, 384, 398, 362];
const RIGHT_CHEEK = [50, 205, 116];
const LEFT_CHEEK = [280, 425, 345];
const RIGHT_EYE_OUTER = 33;
const LEFT_EYE_OUTER = 263;

const px = (lm: Landmark, d: FrameDims) => ({ x: lm.x * d.w, y: lm.y * d.h });
const rgba = ({ r, g, b }: RGB, a: number) => `rgba(${r},${g},${b},${a})`;

function ringPath(face: Landmark[], idx: number[], d: FrameDims): Path2D {
  const p = new Path2D();
  idx.forEach((i, n) => {
    const { x, y } = px(face[i], d);
    if (n === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  });
  p.closePath();
  return p;
}

function centroid(face: Landmark[], idx: number[], d: FrameDims) {
  let x = 0;
  let y = 0;
  for (const i of idx) {
    const p = px(face[i], d);
    x += p.x;
    y += p.y;
  }
  return { x: x / idx.length, y: y / idx.length };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function paintLips(ctx: CanvasRenderingContext2D, face: Landmark[], d: FrameDims, color: RGB) {
  // Outer ring filled, inner ring punched out via even-odd so teeth stay clean.
  const path = ringPath(face, LIPS_OUTER, d);
  path.addPath(ringPath(face, LIPS_INNER, d));
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = rgba(color, 0.65);
  ctx.fill(path, "evenodd");
  ctx.restore();
}

function paintEyeshadow(ctx: CanvasRenderingContext2D, face: Landmark[], d: FrameDims, upper: number[], color: RGB) {
  const lid = upper.map((i) => px(face[i], d));
  const eyeW = dist(lid[0], lid[lid.length - 1]);
  const lift = eyeW * 0.5; // pull the upper edge toward the brow
  const path = new Path2D();
  lid.forEach((p, n) => (n === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y)));
  for (let n = lid.length - 1; n >= 0; n--) path.lineTo(lid[n].x, lid[n].y - lift);
  path.closePath();
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.55;
  ctx.shadowColor = rgba(color, 0.6);
  ctx.shadowBlur = eyeW * 0.35;
  ctx.fillStyle = rgba(color, 0.6);
  ctx.fill(path);
  ctx.restore();
}

function paintBlush(ctx: CanvasRenderingContext2D, face: Landmark[], d: FrameDims, cheek: number[], faceW: number, color: RGB) {
  const c = centroid(face, cheek, d);
  const r = faceW * 0.13;
  const g = ctx.createRadialGradient(c.x, c.y, r * 0.1, c.x, c.y, r);
  g.addColorStop(0, rgba(color, 0.5));
  g.addColorStop(1, rgba(color, 0));
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Build a per-frame renderer bound to the current makeup options. */
export function makeMakeupDraw(opts: MakeupOptions): FaceDrawFn {
  return (ctx, faces, dims) => {
    for (const face of faces) {
      const faceW = dist(px(face[RIGHT_EYE_OUTER], dims), px(face[LEFT_EYE_OUTER], dims)) * 2.2;
      if (opts.blush.on) {
        paintBlush(ctx, face, dims, RIGHT_CHEEK, faceW, opts.blush.color);
        paintBlush(ctx, face, dims, LEFT_CHEEK, faceW, opts.blush.color);
      }
      if (opts.eyeshadow.on) {
        paintEyeshadow(ctx, face, dims, RIGHT_EYE_UPPER, opts.eyeshadow.color);
        paintEyeshadow(ctx, face, dims, LEFT_EYE_UPPER, opts.eyeshadow.color);
      }
      if (opts.lipstick.on) {
        paintLips(ctx, face, dims, opts.lipstick.color);
      }
    }
  };
}
