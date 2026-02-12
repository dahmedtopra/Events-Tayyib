import { useEffect, useRef, useState } from "react";
import { TayyibPanel } from "../components/TayyibPanel";
import { KioskLayout } from "../layouts/KioskLayout";
import { useLang } from "../hooks/useLang";
import { useOrientation } from "../hooks/useOrientation";
import type { TayyibState } from "../tayyib/loops";
import { useTayyibDebug } from "../hooks/useTayyibDebug";

export function GuidePage() {
  const { t } = useLang();
  const { isVertical } = useOrientation();
  const { forcedState } = useTayyibDebug();
  const [state, setState] = useState<TayyibState>("idle");
  const explainToggle = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (forcedState) setState(forcedState);
  }, [forcedState]);

  const simulateGenerate = () => {
    if (forcedState) return;
    setState("searching");
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      explainToggle.current = !explainToggle.current;
      setState(explainToggle.current ? "explaining_a" : "explaining_b");
    }, 800);
  };

  return (
    <KioskLayout>
      <div className={isVertical ? "h-full grid grid-rows-[1fr_auto] gap-6 p-6" : "h-full grid grid-cols-[1fr_320px] gap-6 p-6"}>
        <section className="rounded-xl border border-amber-200 bg-white/70 p-6 flex flex-col gap-4 overflow-hidden">
          <div className="text-xl font-semibold">{t.guideTitle}</div>
          <div className="rounded-lg border border-amber-200 p-4 bg-white">
            <div className="text-sm font-semibold mb-2">{t.wizardTitle}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border border-amber-200 p-3 text-sm">Step 1</div>
              <div className="rounded border border-amber-200 p-3 text-sm">Step 2</div>
              <div className="rounded border border-amber-200 p-3 text-sm">Step 3</div>
              <div className="rounded border border-amber-200 p-3 text-sm">Step 4</div>
            </div>
            <button className="mt-4 px-4 py-2 rounded-lg bg-emerald-900 text-white" onClick={simulateGenerate}>
              Generate checklist
            </button>
          </div>
          <div className="rounded-lg border border-amber-200 p-4 bg-white">
            <div className="text-sm font-semibold mb-2">{t.checklistTitle}</div>
            <div className="space-y-2">
              <details className="rounded border border-amber-200 p-3">
                <summary className="text-sm">Section A</summary>
                <div className="text-xs text-gray-600 mt-2">Placeholder items</div>
              </details>
              <details className="rounded border border-amber-200 p-3">
                <summary className="text-sm">Section B</summary>
                <div className="text-xs text-gray-600 mt-2">Placeholder items</div>
              </details>
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 p-4 bg-white">
            <div className="text-sm font-semibold mb-2">{t.qrPlaceholder}</div>
            <div className="h-24 rounded bg-amber-50" />
          </div>
        </section>
        <aside className="rounded-xl border border-amber-200 bg-white/70 p-4">
          <TayyibPanel state={forcedState ?? state} variant="compact" objectPosition="50% 8%" />
        </aside>
      </div>
    </KioskLayout>
  );
}
