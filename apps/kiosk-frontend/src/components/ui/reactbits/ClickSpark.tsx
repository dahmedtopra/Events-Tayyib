import { useState, useCallback, useRef, type ReactNode } from "react";

interface Spark {
  id: number;
  x: number;
  y: number;
  angle: number;
  velocity: number;
}

interface ClickSparkProps {
  children: ReactNode;
  color?: string;
  sparkCount?: number;
  sparkSize?: number;
  sparkVelocity?: number;
}

/**
 * ClickSpark - Touch-safe particle spark bursts at click/tap position
 * Creates satisfying visual feedback for kiosk interactions
 * - Touch-safe: works with both mouse and touch events
 * - Lightweight: CSS animations only, no canvas
 * - Customizable: color, count, size, velocity
 */
export function ClickSpark({
  children,
  color = "#d4a92a", // Gold default
  sparkCount = 8,
  sparkSize = 4,
  sparkVelocity = 150,
}: ClickSparkProps) {
  const [sparks, setSparks] = useState<Spark[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const sparkIdRef = useRef(0);

  const handleInteraction = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      let clientX: number;
      let clientY: number;

      if ("touches" in e) {
        // Touch event
        const touch = e.touches[0] || e.changedTouches[0];
        clientX = touch.clientX;
        clientY = touch.clientY;
      } else {
        // Mouse event
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const newSparks: Spark[] = [];
      for (let i = 0; i < sparkCount; i++) {
        const angle = (Math.PI * 2 * i) / sparkCount;
        newSparks.push({
          id: sparkIdRef.current++,
          x,
          y,
          angle,
          velocity: sparkVelocity,
        });
      }

      setSparks((prev) => [...prev, ...newSparks]);

      // Remove sparks after animation completes
      setTimeout(() => {
        setSparks((prev) => prev.filter((s) => !newSparks.some((ns) => ns.id === s.id)));
      }, 600);
    },
    [sparkCount, sparkVelocity]
  );

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseDown={handleInteraction}
      onTouchStart={handleInteraction}
      style={{ touchAction: "manipulation" }}
    >
      {children}

      {/* Sparks container */}
      <div className="absolute inset-0 pointer-events-none overflow-visible">
        {sparks.map((spark) => {
          const distance = spark.velocity;
          const endX = spark.x + Math.cos(spark.angle) * distance;
          const endY = spark.y + Math.sin(spark.angle) * distance;

          return (
            <div
              key={spark.id}
              className="absolute rounded-full"
              style={{
                left: spark.x,
                top: spark.y,
                width: sparkSize,
                height: sparkSize,
                backgroundColor: color,
                transform: `translate(-50%, -50%)`,
                animation: `sparkBurst 0.6s ease-out forwards`,
                "--spark-end-x": `${endX - spark.x}px`,
                "--spark-end-y": `${endY - spark.y}px`,
              } as React.CSSProperties}
            />
          );
        })}
      </div>

      <style>{`
        @keyframes sparkBurst {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(
              calc(-50% + var(--spark-end-x)),
              calc(-50% + var(--spark-end-y))
            ) scale(0);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
