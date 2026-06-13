import { useCallback, useRef, useState } from "react";
import { ensureFalConfigured } from "../lib/fal";

export type LucyStatus = "idle" | "connecting" | "live" | "error";

export interface GarmentPayload {
  prompt?: string;
  reference_image_url?: string;
}

/** Server messages emitted by the realtime model over the signaling channel. */
interface RealtimeMessage {
  type: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  iceservers?: RTCIceServer[];
  iceServers?: RTCIceServer[];
  ice_servers?: RTCIceServer[];
  success?: boolean;
  error?: string;
}

const MODEL_ID = "decart/lucy2-vton/realtime";

/**
 * Drives a Decart Lucy2 VTON realtime session.
 *
 * The fal SDK owns the signaling channel; we own the RTCPeerConnection. The
 * negotiation below mirrors fal's canonical example for this model: on the
 * first `iceservers` message we build the peer connection, push the webcam
 * tracks, create an offer, and exchange ICE candidates over `connection.send`.
 * The transformed stream arrives via `pc.ontrack` and is attached to the
 * caller-provided output <video> element.
 */
export function useLucyRealtime(getOutputVideo: () => HTMLVideoElement | null) {
  const [status, setStatus] = useState<LucyStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const connectionRef = useRef<{ send: (m: unknown) => void; close: () => void } | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const teardown = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    try {
      connectionRef.current?.close();
    } catch {
      // connection may already be closed
    }
    connectionRef.current = null;
  }, []);

  const stop = useCallback(() => {
    teardown();
    setStatus("idle");
    setError(null);
  }, [teardown]);

  const start = useCallback(
    (stream: MediaStream, payload: GarmentPayload) => {
      const fal = ensureFalConfigured();
      streamRef.current = stream;
      setError(null);
      setStatus("connecting");

      const connection = fal.realtime.connect(MODEL_ID, {
        connectionKey: `session-${Date.now()}`,
        throttleInterval: 0,
        onError: (err: unknown) => {
          setError(err instanceof Error ? err.message : "Realtime connection error.");
          setStatus("error");
        },
        onResult: async (result: RealtimeMessage) => {
          try {
            await handleResult(result);
          } catch (e) {
            setError(e instanceof Error ? e.message : "WebRTC negotiation failed.");
            setStatus("error");
          }
        },
      });
      connectionRef.current = connection;

      async function handleResult(result: RealtimeMessage) {
        switch (result.type) {
          case "iceservers":
          case "iceServers": {
            const raw = result.iceservers || result.iceServers || result.ice_servers || [];
            const servers: RTCIceServer[] = raw.map((s) => ({
              urls: s.urls,
              username: s.username,
              credential: s.credential,
            }));
            const pc = new RTCPeerConnection({ iceServers: servers });
            pcRef.current = pc;

            streamRef.current?.getTracks().forEach((track) => pc.addTrack(track, streamRef.current!));

            pc.ontrack = (e) => {
              const video = getOutputVideo();
              if (video) video.srcObject = e.streams[0];
            };
            pc.onicecandidate = (e) => {
              if (e.candidate) {
                connection.send({
                  type: "icecandidate",
                  candidate: {
                    candidate: e.candidate.candidate,
                    sdpMid: e.candidate.sdpMid,
                    sdpMLineIndex: e.candidate.sdpMLineIndex,
                  },
                });
              }
            };

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            connection.send({ type: "offer", sdp: offer.sdp });
            break;
          }
          case "answer":
            await pcRef.current?.setRemoteDescription({ type: "answer", sdp: result.sdp });
            break;
          case "icecandidate":
            await pcRef.current?.addIceCandidate(new RTCIceCandidate(result.candidate));
            break;
          case "generation_started":
            setStatus("live");
            break;
          case "prompt_ack":
            if (!result.success) setError(result.error || "Prompt was rejected.");
            break;
          case "set_image_ack":
            if (!result.success) setError(result.error || "Reference image was rejected.");
            break;
          case "error":
            setError(result.error || "Server error.");
            setStatus("error");
            break;
        }
      }

      // Kick off the session with the initial garment instructions.
      connection.send(cleanPayload(payload));
    },
    [getOutputVideo],
  );

  // Update prompt / garment mid-session without renegotiating.
  const update = useCallback((payload: GarmentPayload) => {
    connectionRef.current?.send(cleanPayload(payload));
  }, []);

  return { status, error, start, stop, update };
}

function cleanPayload(payload: GarmentPayload): GarmentPayload {
  const out: GarmentPayload = {};
  if (payload.prompt && payload.prompt.trim()) out.prompt = payload.prompt.trim();
  if (payload.reference_image_url) out.reference_image_url = payload.reference_image_url;
  return out;
}
