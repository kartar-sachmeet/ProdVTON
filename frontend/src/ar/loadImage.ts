/** A decoded overlay image plus its intrinsic dimensions, ready for drawImage. */
export interface LoadedImage {
  src: CanvasImageSource;
  w: number;
  h: number;
}

/** Decode an uploaded file into an HTMLImageElement. */
export function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load that image."));
    };
    img.src = url;
  });
}

/**
 * Knock out a near-white background to transparency. Most product photos ship
 * on a white sweep, so this makes them composite cleanly over the camera feed.
 * Feathers the alpha near the threshold to avoid hard edges.
 */
export function knockoutWhite(img: HTMLImageElement, threshold = 238): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(img, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const min = Math.min(d[i], d[i + 1], d[i + 2]);
    if (min >= threshold) {
      d[i + 3] = 0;
    } else if (min >= threshold - 18) {
      // feather the transition band
      d[i + 3] = Math.round((d[i + 3] * (threshold - min)) / 18);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** Prepare an uploaded file for overlay, optionally removing a white background. */
export async function prepareOverlayImage(file: File, removeWhite: boolean): Promise<LoadedImage> {
  const img = await fileToImage(file);
  if (removeWhite) {
    const c = knockoutWhite(img);
    return { src: c, w: c.width, h: c.height };
  }
  return { src: img, w: img.naturalWidth, h: img.naturalHeight };
}
