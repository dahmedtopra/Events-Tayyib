import type { CSSProperties } from "react";

interface NoiseProps {
  opacity?: number;
  tint?: string;
  className?: string;
}

/**
 * Noise - Animated film grain overlay for subtle texture
 * Based on ReactBits Noise component pattern
 * - Touch-safe: pointer-events:none by default
 * - Light CPU: uses CSS animation only
 * - Decorative layer for premium aesthetic
 */
export function Noise({ opacity = 0.15, tint = "#2fa987", className = "" }: NoiseProps) {
  const overlayStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    opacity,
    mixBlendMode: "overlay",
    backgroundImage: `
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        ${tint} 2px,
        ${tint} 4px
      ),
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 2px,
        ${tint} 2px,
        ${tint} 4px
      )
    `,
    backgroundSize: "3px 3px",
    animation: "noise-grain 0.5s steps(10) infinite",
  };

  return (
    <>
      <div className={className} style={overlayStyle} />
      <style>{`
        @keyframes noise-grain {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-1%, -1%); }
          20% { transform: translate(-2%, 2%); }
          30% { transform: translate(2%, -2%); }
          40% { transform: translate(-2%, 1%); }
          50% { transform: translate(1%, 2%); }
          60% { transform: translate(2%, -1%); }
          70% { transform: translate(-1%, 1%); }
          80% { transform: translate(1%, -2%); }
          90% { transform: translate(-2%, -1%); }
        }
      `}</style>
    </>
  );
}
