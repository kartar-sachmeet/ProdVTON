import type { LoadedImage } from "../ar/loadImage";
import type { FaceDrawFn, FrameDims, Landmark } from "../ar/useArFace";

export type EarringStyle = "studs" | "drops" | "hoops";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface JewelleryOptions {
  earrings: { on: boolean; style: EarringStyle };
  necklace: { on: boolean };
  metal: RGB;
  /** Uploaded earring photo, hung from each lobe instead of the procedural earring. */
  earringImage?: LoadedImage | null;
  earringImageScale: number;
  /** Uploaded necklace photo, draped below the chin instead of the procedural necklace. */
  necklaceImage?: LoadedImage | null;
  necklaceImageScale: number;
}

// Ear-level face-oval points, jaw corners, chin, and forehead top (for scale).
const R_EAR = 234;
const L_EAR = 454;
const R_JAW = 172;
const L_JAW = 397;
const CHIN = 152;
const FOREHEAD = 10;

type Pt = { x: number; y: number };
const px = (lm: Landmark, d: FrameDims): Pt => ({ x: lm.x * d.w, y: lm.y * d.h });
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const rgb = ({ r, g, b }: RGB) => `rgb(${r},${g},${b})`;

function sheen(ctx: CanvasRenderingContext2D, c: Pt, r: number) {
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(c.x - r * 0.3, c.y - r * 0.3, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function gem(ctx: CanvasRenderingContext2D, c: Pt, r: number, metal: RGB) {
  ctx.fillStyle = rgb(metal);
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fill();
  sheen(ctx, c, r);
}

function earring(ctx: CanvasRenderingContext2D, lobe: Pt, scale: number, style: EarringStyle, metal: RGB) {
  const studR = scale * 0.018;
  if (style === "studs") {
    gem(ctx, lobe, studR, metal);
    return;
  }
  if (style === "hoops") {
    const r = scale * 0.05;
    ctx.strokeStyle = rgb(metal);
    ctx.lineWidth = Math.max(2, scale * 0.012);
    ctx.beginPath();
    ctx.arc(lobe.x, lobe.y + r, r, 0, Math.PI * 2);
    ctx.stroke();
    gem(ctx, lobe, studR * 0.8, metal);
    return;
  }
  // drops: stud + chain + teardrop gem
  gem(ctx, lobe, studR, metal);
  const dropLen = scale * 0.09;
  const tip = { x: lobe.x, y: lobe.y + dropLen };
  ctx.strokeStyle = rgb(metal);
  ctx.lineWidth = Math.max(1.5, scale * 0.008);
  ctx.beginPath();
  ctx.moveTo(lobe.x, lobe.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  gem(ctx, { x: tip.x, y: tip.y + studR }, studR * 1.4, metal);
}

function necklace(ctx: CanvasRenderingContext2D, rJaw: Pt, lJaw: Pt, chin: Pt, scale: number, metal: RGB) {
  // Quadratic arc draped below the chin; control point pulled well down.
  const ctrl = { x: chin.x, y: chin.y + scale * 0.55 };
  ctx.strokeStyle = rgb(metal);
  ctx.lineWidth = Math.max(2.5, scale * 0.018);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(rJaw.x, rJaw.y);
  ctx.quadraticCurveTo(ctrl.x, ctrl.y, lJaw.x, lJaw.y);
  ctx.stroke();
  // Pendant at the curve's midpoint (t = 0.5).
  const mid = {
    x: 0.25 * rJaw.x + 0.5 * ctrl.x + 0.25 * lJaw.x,
    y: 0.25 * rJaw.y + 0.5 * ctrl.y + 0.25 * lJaw.y,
  };
  gem(ctx, mid, scale * 0.03, metal);
}

/** Draw an uploaded earring photo hanging from a lobe (top-center anchored). */
function earringImg(ctx: CanvasRenderingContext2D, lobe: Pt, li: LoadedImage, h: number, mirror: boolean) {
  const w = h * (li.w / li.h);
  ctx.save();
  ctx.translate(lobe.x, lobe.y);
  if (mirror) ctx.scale(-1, 1);
  ctx.drawImage(li.src, -w / 2, 0, w, h);
  ctx.restore();
}

export function makeJewelleryDraw(opts: JewelleryOptions): FaceDrawFn {
  return (ctx, faces, dims) => {
    for (const face of faces) {
      const rEar = px(face[R_EAR], dims);
      const lEar = px(face[L_EAR], dims);
      const chin = px(face[CHIN], dims);
      const forehead = px(face[FOREHEAD], dims);
      const faceH = dist(forehead, chin);
      const faceW = dist(rEar, lEar);
      const scale = faceH; // vertical face size drives procedural sizing

      if (opts.earrings.on) {
        const drop = faceH * 0.06;
        const rLobe = { x: rEar.x, y: rEar.y + drop };
        const lLobe = { x: lEar.x, y: lEar.y + drop };
        if (opts.earringImage) {
          const h = faceH * 0.16 * opts.earringImageScale;
          earringImg(ctx, rLobe, opts.earringImage, h, false);
          earringImg(ctx, lLobe, opts.earringImage, h, true); // mirror the pair
        } else {
          earring(ctx, rLobe, scale, opts.earrings.style, opts.metal);
          earring(ctx, lLobe, scale, opts.earrings.style, opts.metal);
        }
      }

      if (opts.necklace.on) {
        if (opts.necklaceImage) {
          const w = faceW * 1.5 * opts.necklaceImageScale;
          const h = w * (opts.necklaceImage.h / opts.necklaceImage.w);
          ctx.drawImage(opts.necklaceImage.src, chin.x - w / 2, chin.y + faceH * 0.08, w, h);
        } else {
          necklace(ctx, px(face[R_JAW], dims), px(face[L_JAW], dims), chin, scale, opts.metal);
        }
      }
    }
  };
}
