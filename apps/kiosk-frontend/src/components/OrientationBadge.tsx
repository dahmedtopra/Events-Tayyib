import { useOrientation } from "../hooks/useOrientation";

export function OrientationBadge() {
  const { orientation } = useOrientation();
  if (!import.meta.env.DEV) return null;
  return (
    <div className="absolute top-3 right-3 text-[10px] px-2 py-1 rounded-full bg-black/70 text-white tracking-wide">
      {orientation.toUpperCase()}
    </div>
  );
}
