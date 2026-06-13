import { fal } from "@fal-ai/client";

// Route every fal SDK call (realtime token issuance + storage uploads) through
// our backend proxy so FAL_KEY never reaches the browser. The proxy lives at
// /api/fal/proxy and is reached via the Vite dev proxy in development.
let configured = false;

export function ensureFalConfigured(): typeof fal {
  if (!configured) {
    fal.config({ proxyUrl: "/api/fal/proxy" });
    configured = true;
  }
  return fal;
}

export { fal };
