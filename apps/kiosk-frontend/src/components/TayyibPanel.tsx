import { useEffect, useRef, useState, useCallback } from "react";
import { TAYYIB_ASSETS, TAYYIB_STATES, buildAssetUrl } from "../tayyib/loops";
import type { TayyibState } from "../tayyib/loops";

type Props = {
  state: TayyibState;
  variant?: "hero" | "compact";
  onError?: (state: TayyibState) => void;
};

/**
 * Global video cache — each state gets one <video> element that persists
 * across renders so the browser never has to re-fetch or re-decode.
 */
const videoCache = new Map<TayyibState, HTMLVideoElement>();

function getOrCreateVideo(state: TayyibState): HTMLVideoElement | null {
  if (videoCache.has(state)) return videoCache.get(state)!;

  const candidates = TAYYIB_ASSETS[state] ?? [];
  if (!candidates.length) return null;

  const vid = document.createElement("video");
  vid.autoplay = false;
  vid.loop = true;
  vid.muted = true;
  vid.playsInline = true;
  vid.preload = "auto";
  vid.style.width = "100%";
  vid.style.height = "100%";
  vid.style.objectFit = "cover";

  // Fallback: if the first format (webm) fails, try the second (mp4)
  if (candidates.length > 1) {
    vid.addEventListener("error", () => {
      vid.src = buildAssetUrl(candidates[1]);
      vid.load();
    }, { once: true });
  }

  vid.src = buildAssetUrl(candidates[0]);
  vid.load();
  videoCache.set(state, vid);
  return vid;
}

/** Preload all state videos on first call. */
let preloaded = false;
function preloadAll() {
  if (preloaded) return;
  preloaded = true;
  for (const s of TAYYIB_STATES) {
    getOrCreateVideo(s);
  }
}

export function TayyibPanel({ state, variant, onError }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);

  // Preload every video once on mount
  useEffect(() => {
    preloadAll();
  }, []);

  const attachVideo = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const vid = getOrCreateVideo(state);
    if (!vid) {
      onError?.(state);
      return;
    }

    // If the same video is already attached, just make sure it's playing
    if (activeVideoRef.current === vid) {
      vid.play().catch(() => {});
      return;
    }

    // Pause the previous video
    if (activeVideoRef.current) {
      activeVideoRef.current.pause();
    }

    // Clear container and attach the new video
    container.innerHTML = "";
    container.appendChild(vid);
    activeVideoRef.current = vid;

    // If already loaded, show immediately
    if (vid.readyState >= 3) {
      setReady(true);
      vid.play().catch(() => {});
    } else {
      setReady(false);
      const onLoaded = () => {
        setReady(true);
        vid.play().catch(() => {});
        vid.removeEventListener("loadeddata", onLoaded);
      };
      vid.addEventListener("loadeddata", onLoaded);
      // Also handle error — try mp4 fallback
      const onErr = () => {
        vid.removeEventListener("error", onErr);
        const candidates = TAYYIB_ASSETS[state] ?? [];
        if (candidates.length > 1) {
          vid.src = buildAssetUrl(candidates[1]);
          vid.load();
        } else {
          onError?.(state);
        }
      };
      vid.addEventListener("error", onErr, { once: true });
    }
  }, [state, onError]);

  useEffect(() => {
    attachVideo();
  }, [attachVideo]);

  const panelClass =
    variant === "hero"
      ? "h-full"
      : "h-full";

  return (
    <aside className={`tayyib-panel pointer-events-none w-full relative ${panelClass} rounded-xl bg-white/70 shadow-sm flex items-center justify-center overflow-hidden`}>
      <div className="relative w-full h-full">
        {/* Subtle shimmer placeholder while video loads */}
        {!ready && (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-gold-50/30 animate-pulse rounded-xl" />
        )}
        {/* Video container — videos are attached via DOM for caching */}
        <div
          ref={containerRef}
          className={`w-full h-full ${ready ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
        />
      </div>
    </aside>
  );
}
