import { useTayyibDebug } from "../hooks/useTayyibDebug";

export function DevTayyibControls() {
  const { enabled, forcedState, setState, disable, stateOptions } = useTayyibDebug();
  if (!enabled) return null;

  return (
    <div className="absolute bottom-3 right-3 bg-black/80 text-white text-xs rounded-lg px-3 py-2 space-y-2">
      <div className="font-semibold">Tayyib Debug</div>
      <select
        className="text-black text-xs rounded px-2 py-1"
        value={forcedState ?? ""}
        onChange={(e) => {
          const value = e.target.value as typeof forcedState;
          setState(value || null);
        }}
      >
        <option value="">(auto)</option>
        {stateOptions.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button className="text-xs underline" onClick={disable}>
        disable
      </button>
    </div>
  );
}
