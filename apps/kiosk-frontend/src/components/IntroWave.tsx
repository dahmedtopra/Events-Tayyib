import { useEffect, useRef, useState } from "react";

interface IntroWaveProps {
  onComplete: () => void;
}

const INTRO_DURATION_MS = 1500; // 1.5 seconds max duration

// Premium mode configuration for background treatment
const PREMIUM_CONFIG = {
  // Radial gradient intensity (0-1)
  radialGradientIntensity: 0.4,
  // Vignette strength (0-1)
  vignetteStrength: 0.6,
  // Islamic geometry pattern opacity (0-1)
  geometryOpacity: 0.08,
  // Glow behind Tayyib intensity (0-1)
  glowIntensity: 0.3,
};

/**
 * IntroWave - Plays the intro wave video once and transitions to SEARCH_READY
 * - Full-screen Tayyib video with emerald background
 * - Plays once (no loop)
 * - Auto-advances after video ends OR 4 seconds (whichever comes first)
 * - Zoom-out animation on exit
 */
export function IntroWave({ onComplete }: IntroWaveProps) {
  const [isZoomingOut, setIsZoomingOut] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  // Handle video end or max duration
  useEffect(() => {
    // Max duration timeout
    timeoutRef.current = window.setTimeout(() => {
      handleComplete();
    }, INTRO_DURATION_MS);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleComplete = () => {
    if (isZoomingOut) return; // Already transitioning

    setIsZoomingOut(true);

    // Wait for zoom-out animation, then call onComplete
    setTimeout(() => {
      onComplete();
    }, 800); // Match animation duration
  };


  return (
    <section
      className="w-full h-full relative overflow-hidden cursor-pointer"
      onClick={handleComplete}
      style={{
        background: "linear-gradient(135deg, #0b4a3a 0%, #156f58 50%, #0f5a46 100%)",
        transform: isZoomingOut ? "scale(0.85)" : "scale(1)",
        opacity: isZoomingOut ? 0 : 1,
        transition: "transform 800ms cubic-bezier(0.4, 0, 0.2, 1), opacity 800ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Premium ambient light - top */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 20%, rgba(212, 169, 42, ${PREMIUM_CONFIG.radialGradientIntensity * 0.15}) 0%, transparent 50%)`,
          pointerEvents: "none",
        }}
      />

      {/* Premium ambient light - center glow */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(255, 255, 255, ${PREMIUM_CONFIG.radialGradientIntensity * 0.08}) 0%, transparent 60%)`,
          pointerEvents: "none",
        }}
      />

      {/* Subtle shimmer overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: `
            linear-gradient(125deg, transparent 40%, rgba(212, 169, 42, 0.1) 50%, transparent 60%),
            radial-gradient(circle at 30% 40%, rgba(212, 169, 42, 0.05) 0%, transparent 50%),
            radial-gradient(circle at 70% 60%, rgba(47, 169, 135, 0.05) 0%, transparent 50%)
          `,
          pointerEvents: "none",
        }}
      />

      {/* Vignette - darker edges for depth */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, transparent 30%, rgba(0, 0, 0, ${PREMIUM_CONFIG.vignetteStrength * 0.6}) 100%)`,
          pointerEvents: "none",
        }}
      />
    </section>
  );
}
