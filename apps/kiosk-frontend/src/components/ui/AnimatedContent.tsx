import { useEffect, useState } from "react";
import type { ReactNode } from "react";

interface AnimatedContentProps {
  children: ReactNode;
  direction?: "up" | "down" | "left" | "right";
  distance?: number;
  duration?: number;
  delay?: number;
  className?: string;
  trigger?: boolean;
}

/**
 * AnimatedContent - Wrapper that animates children on mount
 * Based on ReactBits AnimatedContent component pattern
 * - Touch-safe: no hover dependencies
 * - Light CPU: uses CSS transitions only
 * - Configurable direction, distance, duration, and delay
 */
export function AnimatedContent({
  children,
  direction = "up",
  distance = 30,
  duration = 800,
  delay = 0,
  className = "",
  trigger = true,
}: AnimatedContentProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (trigger) {
      const timer = setTimeout(() => setIsVisible(true), delay);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [trigger, delay]);

  const getTransform = () => {
    if (isVisible) return "translate(0, 0)";

    switch (direction) {
      case "up":
        return `translate(0, ${distance}px)`;
      case "down":
        return `translate(0, -${distance}px)`;
      case "left":
        return `translate(${distance}px, 0)`;
      case "right":
        return `translate(-${distance}px, 0)`;
      default:
        return `translate(0, ${distance}px)`;
    }
  };

  const style = {
    opacity: isVisible ? 1 : 0,
    transform: getTransform(),
    transition: `opacity ${duration}ms cubic-bezier(0.4, 0, 0.2, 1), transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
  };

  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}
