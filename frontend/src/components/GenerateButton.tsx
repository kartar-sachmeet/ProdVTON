interface Props {
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}

export function GenerateButton({ disabled, loading, onClick }: Props) {
  return (
    <button className="generate" disabled={disabled || loading} onClick={onClick}>
      {loading ? "Generating…" : "Try it on"}
    </button>
  );
}
