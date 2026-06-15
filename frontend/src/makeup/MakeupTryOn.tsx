import { MakeupGenerative } from "./MakeupGenerative";

/**
 * Makeup try-on. The crude procedural 2D AR was removed; makeup now uses the
 * high-fidelity generative path (Stable-Makeup via RunPod). A proper real-time
 * AR makeup (face-parsing masks + PBR finish shaders) is the planned rebuild —
 * see handoff.md.
 */
export function MakeupTryOn() {
  return (
    <div className="ar-page">
      <p className="subtitle">
        Generative makeup transfer (Stable-Makeup via RunPod) — upload a face + a reference look.
        High fidelity, not real-time. Requires the makeup endpoint configured in the backend.
      </p>
      <MakeupGenerative />
    </div>
  );
}
