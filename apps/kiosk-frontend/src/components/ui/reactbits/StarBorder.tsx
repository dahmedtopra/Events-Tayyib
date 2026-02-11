import { useEffect, useRef, type ReactNode } from "react";

interface StarBorderProps {
  children: ReactNode;
  color?: string;
  starCount?: number;
  speed?: number;
  className?: string;
}

/**
 * StarBorder - Animated star/sparkle border orbiting content with twinkle pulses
 * Perfect for premium Saudi gold aesthetic
 * - Touch-safe: decorative only, pointer-events:none
 * - Lightweight: CSS animations
 * - Customizable: color, star count, speed
 */
export function StarBorder({
  children,
  color = "#d4a92a", // Gold default
  starCount = 20,
  speed = 3, // seconds per orbit
  className = "",
}: StarBorderProps) {
  const borderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!borderRef.current) return;

    const stars = borderRef.current.querySelectorAll(".star");
    stars.forEach((star, i) => {
      const delay = (i / stars.length) * speed;
      (star as HTMLElement).style.animationDelay = `-${delay}s`;
    });
  }, [starCount, speed]);

  const stars = Array.from({ length: starCount }, (_, i) => ({
    id: i,
    angle: (360 / starCount) * i,
  }));

  return (
    <div className={`relative ${className}`}>
      {/* Star border container */}
      <div
        ref={borderRef}
        className="absolute inset-[-2px] pointer-events-none overflow-visible"
      >
        {stars.map((star) => (
          <div
            key={star.id}
            className="star absolute"
            style={{
              left: "50%",
              top: "50%",
              width: "4px",
              height: "4px",
              borderRadius: "50%",
              backgroundColor: color,
              transformOrigin: "0 0",
              animation: `starOrbit ${speed}s linear infinite, starTwinkle 1.5s ease-in-out infinite`,
              "--star-angle": `${star.angle}deg`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10">{children}</div>

      <style>{`
        @keyframes starOrbit {
          0% {
            transform: translate(-50%, -50%)
                       rotate(var(--star-angle))
                       translateX(calc(50% + 10px))
                       scale(1);
          }
          100% {
            transform: translate(-50%, -50%)
                       rotate(calc(var(--star-angle) + 360deg))
                       translateX(calc(50% + 10px))
                       scale(1);
          }
        }

        @keyframes starTwinkle {
          0%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
      `}</style>
    </div>
  );
}
