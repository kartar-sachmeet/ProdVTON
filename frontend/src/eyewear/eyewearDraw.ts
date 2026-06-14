import type { LoadedImage } from "../ar/loadImage";
import type { FaceDrawFn, FrameDims, Landmark } from "../ar/useArFace";

export type FrameStyle = "round" | "square" | "aviator";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface EyewearOptions {
  style: FrameStyle;
  color: RGB;
  tinted: boolean;
  /** When set, this uploaded glasses image is overlaid instead of the procedural frame. */
  image?: LoadedImage | null;
  imageScale: number;
}

// Eye corners (outer + inner) and ear/tragion anchors for the temples.
const R_EYE_OUTER = 33;
const R_EYE_INNER = 133;
const L_EYE_OUTER = 263;
const L_EYE_INNER = 362;
const R_EAR = 234;
const L_EAR = 454;

const px = (lm: Landmark, d: FrameDims) => ({ x: lm.x * d.w, y: lm.y * d.h });
const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const rgb = ({ r, g, b }: RGB) => `rgb(${r},${g},${b})`;

/** Draw one lens outline (centered at local origin) for the chosen style. */
function lensPath(w: number, h: number, style: FrameStyle): Path2D {
  const p = new Path2D();
  if (style === "round") {
    p.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
  } else if (style === "square") {
    const r = Math.min(w, h) * 0.35;
    p.roundRect(-w, -h, w * 2, h * 2, r);
  } else {
    // aviator: wider top, tapered teardrop bottom
    p.moveTo(-w, -h * 0.7);
    p.quadraticCurveTo(-w * 1.05, h * 0.4, 0, h);
    p.quadraticCurveTo(w * 1.05, h * 0.4, w, -h * 0.7);
    p.quadraticCurveTo(w * 0.6, -h, 0, -h);
    p.quadraticCurveTo(-w * 0.6, -h, -w, -h * 0.7);
    p.closePath();
  }
  return p;
}

export function makeEyewearDraw(opts: EyewearOptions): FaceDrawFn {
  return (ctx, faces, dims) => {
    for (const face of faces) {
      const rEye = mid(px(face[R_EYE_OUTER], dims), px(face[R_EYE_INNER], dims));
      const lEye = mid(px(face[L_EYE_OUTER], dims), px(face[L_EYE_INNER], dims));
      const center = mid(rEye, lEye);
      const iod = dist(rEye, lEye);
      const angle = Math.atan2(lEye.y - rEye.y, lEye.x - rEye.x);

      // Uploaded glasses photo: overlay centered on the eyes, scaled to face width, rotated to head roll.
      if (opts.image) {
        const w = iod * 2.25 * opts.imageScale;
        const h = w * (opts.image.h / opts.image.w);
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(angle);
        ctx.drawImage(opts.image.src, -w / 2, -h / 2, w, h);
        ctx.restore();
        continue;
      }

      const lensW = iod * 0.46;
      const lensH = iod * 0.36;
      const offset = iod * 0.52; // each lens center from the bridge
      const lineW = Math.max(2, iod * 0.05);

      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(angle);
      ctx.lineWidth = lineW;
      ctx.strokeStyle = rgb(opts.color);
      ctx.lineJoin = "round";

      for (const sign of [-1, 1]) {
        ctx.save();
        ctx.translate(sign * offset, 0);
        const path = lensPath(lensW, lensH, opts.style);
        if (opts.tinted) {
          ctx.fillStyle = "rgba(20,24,30,0.42)";
          ctx.fill(path);
        } else {
          ctx.fillStyle = "rgba(180,200,225,0.12)";
          ctx.fill(path);
        }
        ctx.stroke(path);
        ctx.restore();
      }

      // Bridge between the inner lens edges.
      ctx.beginPath();
      ctx.moveTo(-offset + lensW * 0.85, -lensH * 0.15);
      ctx.lineTo(offset - lensW * 0.85, -lensH * 0.15);
      ctx.stroke();
      ctx.restore();

      // Temples (arms) toward each ear, drawn in screen space.
      const rEar = px(face[R_EAR], dims);
      const lEar = px(face[L_EAR], dims);
      const dir = { x: Math.cos(angle), y: Math.sin(angle) };
      ctx.save();
      ctx.lineWidth = lineW;
      ctx.strokeStyle = rgb(opts.color);
      ctx.beginPath();
      ctx.moveTo(rEye.x - dir.x * lensW * 1.5, rEye.y - dir.y * lensW * 1.5);
      ctx.lineTo(rEar.x, rEar.y);
      ctx.moveTo(lEye.x + dir.x * lensW * 1.5, lEye.y + dir.y * lensW * 1.5);
      ctx.lineTo(lEar.x, lEar.y);
      ctx.stroke();
      ctx.restore();
    }
  };
}
