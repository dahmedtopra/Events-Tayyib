import { useEffect, useState } from "react";

type Orientation = "vertical" | "horizontal";

function getOrientation(): Orientation {
  return window.innerHeight >= window.innerWidth ? "vertical" : "horizontal";
}

export function useOrientation() {
  const [orientation, setOrientation] = useState<Orientation>(() => getOrientation());

  useEffect(() => {
    const onResize = () => setOrientation(getOrientation());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return {
    orientation,
    isVertical: orientation === "vertical",
    isHorizontal: orientation === "horizontal"
  };
}
