import type { TryOnResult } from "../types";

interface Props {
  results: TryOnResult[];
}

export function SessionGallery({ results }: Props) {
  if (results.length === 0) return null;
  return (
    <div className="gallery">
      <h2>This session</h2>
      <div className="gallery-grid">
        {results.map((r) => (
          <a key={r.id} href={r.resultUrl} target="_blank" rel="noreferrer">
            <img src={r.resultUrl} alt="previous result" />
          </a>
        ))}
      </div>
    </div>
  );
}
