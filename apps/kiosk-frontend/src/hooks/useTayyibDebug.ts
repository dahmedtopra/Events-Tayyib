import { useEffect, useMemo, useState } from "react";
import { TAYYIB_STATES } from "../tayyib/loops";
import type { TayyibState } from "../tayyib/loops";

const STORAGE_KEY = "tayyib_debug_state";
const ENABLE_KEY = "tayyib_debug";

export function useTayyibDebug() {
  const [enabled, setEnabled] = useState(false);
  const [forcedState, setForcedState] = useState<TayyibState | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasQuery = params.get("tayyib") === "1";
    const hasStorage = localStorage.getItem(ENABLE_KEY) === "1";
    if (hasQuery) localStorage.setItem(ENABLE_KEY, "1");
    const nextEnabled = hasQuery || hasStorage;
    setEnabled(nextEnabled);

    if (nextEnabled) {
      const stored = localStorage.getItem(STORAGE_KEY) as TayyibState | null;
      if (stored && TAYYIB_STATES.includes(stored)) {
        setForcedState(stored);
      }
    }
  }, []);

  const setState = (state: TayyibState | null) => {
    if (state) {
      localStorage.setItem(STORAGE_KEY, state);
      setForcedState(state);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      setForcedState(null);
    }
  };

  const disable = () => {
    localStorage.removeItem(ENABLE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    setEnabled(false);
    setForcedState(null);
  };

  const stateOptions = useMemo(() => TAYYIB_STATES, []);

  return { enabled: import.meta.env.DEV && enabled, forcedState, setState, disable, stateOptions };
}
