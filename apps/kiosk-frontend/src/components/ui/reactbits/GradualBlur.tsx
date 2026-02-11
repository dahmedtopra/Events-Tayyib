import { useEffect, useState, type ReactNode } from "react";

interface GradualBlurProps {
  children: ReactNode;
  duration?: number; // milliseconds
  initialBlur?: number; // pixels
  delay?: number; // milliseconds
  className?: string;
}

/**
 * GradualBlur - Progressively un-blurs content creating a cinematic reveal
 * Perfect for transitioning from INTRO_WAVE to SEARCH_READY
 * - Touch-safe: no interaction required
 * - Lightweight: CSS filter transitions
 * - Apple-like premium feel
 */
export function GradualBlur({
  children,
  duration = 1200,
  initialBlur = 20,
  delay = 0,
  className = "",
}: GradualBlurProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsRevealed(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={className}
      style={{
        filter: isRevealed ? "blur(0px)" : `blur(${initialBlur}px)`,
        opacity: isRevealed ? 1 : 0,
        transform: isRevealed ? "scale(1)" : "scale(0.95)",
        transition: `filter ${duration}ms cubic-bezier(0.4, 0, 0.2, 1),
                     opacity ${duration}ms cubic-bezier(0.4, 0, 0.2, 1),
                     transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      }}
    >
      {children}
    </div>
  );
}
