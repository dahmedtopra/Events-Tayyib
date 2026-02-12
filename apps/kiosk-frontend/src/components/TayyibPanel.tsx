import { useEffect, useRef, useState, useCallback } from "react";
import { TAYYIB_ASSETS, TAYYIB_STATES, buildAssetUrl } from "../tayyib/loops";
import type { TayyibState } from "../tayyib/loops";

type Props = {
  state: TayyibState;
  variant?: "hero" | "compact";
  objectPosition?: string;
  objectFit?: "cover" | "contain";
  objectScale?: number;
  onError?: (state: TayyibState) => void;
};

// Global video cache: each state gets one persistent <video> element.
const videoCache = new Map<TayyibState, HTMLVideoElement>();

function getCandidates(state: TayyibState): string[] {
  const raw = TAYYIB_ASSETS[state] ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of raw) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

function loadCandidate(vid: HTMLVideoElement, candidates: string[], idx: number): boolean {
  if (idx < 0 || idx >= candidates.length) return false;
  vid.dataset.candidateIndex = String(idx);
  vid.dataset.candidateCount = String(candidates.length);
  vid.dataset.exhausted = "0";
  vid.src = buildAssetUrl(candidates[idx]);
  vid.load();
  return true;
}

function tryNextCandidate(vid: HTMLVideoElement, candidates: string[]): boolean {
  const currentIdx = Number(vid.dataset.candidateIndex ?? "0");
  const nextIdx = currentIdx + 1;
  if (nextIdx >= candidates.length) {
    vid.dataset.exhausted = "1";
    return false;
  }
  return loadCandidate(vid, candidates, nextIdx);
}

function getOrCreateVideo(state: TayyibState): HTMLVideoElement | null {
  if (videoCache.has(state)) return videoCache.get(state)!;

  const candidates = getCandidates(state);
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

  // Advance through candidate files until a playable one is found.
  vid.addEventListener("error", () => {
    tryNextCandidate(vid, candidates);
  });

  loadCandidate(vid, candidates, 0);
  videoCache.set(state, vid);
  return vid;
}

let preloaded = false;
function preloadAll() {
  if (preloaded) return;
  preloaded = true;
  for (const s of TAYYIB_STATES) {
    getOrCreateVideo(s);
  }
}

export function TayyibPanel({
  state,
  variant,
  objectPosition = "center center",
  objectFit = "cover",
  objectScale = 1,
  onError
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);

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

    if (activeVideoRef.current === vid) {
      vid.style.objectFit = objectFit;
      vid.style.objectPosition = objectPosition;
      vid.style.transformOrigin = "50% 10%";
      vid.style.transform = `scale(${objectScale})`;
      vid.play().catch(() => {});
      return;
    }

    if (activeVideoRef.current) {
      activeVideoRef.current.pause();
    }

    container.innerHTML = "";
    container.appendChild(vid);
    activeVideoRef.current = vid;
    vid.style.objectFit = objectFit;
    vid.style.objectPosition = objectPosition;
    vid.style.transformOrigin = "50% 10%";
    vid.style.transform = `scale(${objectScale})`;

    if (vid.dataset.exhausted === "1") {
      setReady(false);
      onError?.(state);
      return;
    }

    if (vid.readyState >= 3) {
      setReady(true);
      vid.play().catch(() => {});
      return;
    }

    setReady(false);
    const onLoaded = () => {
      setReady(true);
      vid.play().catch(() => {});
      vid.removeEventListener("loadeddata", onLoaded);
      vid.removeEventListener("error", onErr);
    };
    const onErr = () => {
      if (vid.dataset.exhausted === "1") {
        setReady(false);
        vid.removeEventListener("loadeddata", onLoaded);
        vid.removeEventListener("error", onErr);
        onError?.(state);
      }
    };

    vid.addEventListener("loadeddata", onLoaded);
    vid.addEventListener("error", onErr);
  }, [state, objectFit, objectPosition, objectScale, onError]);

  useEffect(() => {
    attachVideo();
  }, [attachVideo]);

  const panelClass = variant === "hero" ? "h-full" : "h-full";

  return (
    <aside className={`tayyib-panel pointer-events-none w-full relative ${panelClass} rounded-xl bg-white/70 shadow-sm flex items-center justify-center overflow-hidden`}>
      <div className="relative w-full h-full">
        {!ready && (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-gold-50/30 animate-pulse rounded-xl" />
        )}
        <div
          ref={containerRef}
          className={`w-full h-full ${ready ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
        />
      </div>
    </aside>
  );
}
