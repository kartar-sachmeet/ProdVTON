interface Props {
  resultUrl: string;
}

export function ResultView({ resultUrl }: Props) {
  return (
    <div className="result">
      <img className="result-image" src={resultUrl} alt="try-on result" />
      <a className="download" href={resultUrl} download target="_blank" rel="noreferrer">
        Download
      </a>
    </div>
  );
}
