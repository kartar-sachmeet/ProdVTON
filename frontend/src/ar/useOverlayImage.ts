import { useEffect, useState } from "react";
import { prepareOverlayImage, type LoadedImage } from "./loadImage";

/** Manages an uploaded overlay image: re-processes when the file or white-knockout toggle changes. */
export function useOverlayImage() {
  const [file, setFile] = useState<File | null>(null);
  const [removeWhite, setRemoveWhite] = useState(true);
  const [scale, setScale] = useState(1);
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setImage(null);
      setError(null);
      return;
    }
    let cancelled = false;
    prepareOverlayImage(file, removeWhite)
      .then((li) => !cancelled && (setImage(li), setError(null)))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load image."));
    return () => {
      cancelled = true;
    };
  }, [file, removeWhite]);

  return { file, setFile, removeWhite, setRemoveWhite, scale, setScale, image, error };
}

export type OverlayImageState = ReturnType<typeof useOverlayImage>;
