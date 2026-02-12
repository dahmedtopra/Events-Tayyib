import { useState } from "react";
import { TayyibPanel } from "../components/TayyibPanel";
import { KioskLayout } from "../layouts/KioskLayout";
import { useLang } from "../hooks/useLang";
import { useOrientation } from "../hooks/useOrientation";
import type { TayyibState } from "../tayyib/loops";
import { useTayyibDebug } from "../hooks/useTayyibDebug";

export function PosePage() {
  const { t } = useLang();
  const { isVertical } = useOrientation();
  const { forcedState } = useTayyibDebug();
  const [poseState, setPoseState] = useState<TayyibState>("pose_a");

  const effectiveState = forcedState ?? poseState;

  return (
    <KioskLayout>
      <div className={isVertical ? "h-full grid grid-rows-[1fr_auto] gap-6 p-6" : "h-full grid grid-cols-[1fr_320px] gap-6 p-6"}>
        <section className="glass rounded-3xl p-6 flex flex-col gap-4">
          <div className="text-xl font-semibold">{t.poseTitle}</div>
          <div className="flex-1 rounded-3xl border border-gold-200 bg-white/80 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-5 left-5 h-10 w-10 border-t-2 border-l-2 border-gold-400" />
              <div className="absolute top-5 right-5 h-10 w-10 border-t-2 border-r-2 border-gold-400" />
              <div className="absolute bottom-5 left-5 h-10 w-10 border-b-2 border-l-2 border-gold-400" />
              <div className="absolute bottom-5 right-5 h-10 w-10 border-b-2 border-r-2 border-gold-400" />
              <div className="absolute bottom-5 right-8 text-xs text-gold-700">ICHS</div>
            </div>
            <div className="flex flex-col items-center justify-center h-full text-gray-600">
              <div className="text-lg">{t.poseFrame}</div>
              <div className="text-xs mt-2">{t.countdown}: --</div>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{t.watermark}</span>
            <span className="text-gold-700">{t.countdown}: --</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="min-h-[52px] px-6 rounded-2xl bg-emerald-800 text-white"
              onClick={() => setPoseState(poseState === "pose_a" ? "pose_b" : "pose_a")}
            >
              {t.poseTap}
            </button>
            <button className="min-h-[52px] px-6 rounded-2xl glass">{t.countdownToggle}</button>
          </div>
        </section>
        <aside className="rounded-3xl border border-gold-200 bg-white/70 p-4">
          <TayyibPanel state={effectiveState} variant={isVertical ? "hero" : "compact"} objectPosition="50% 8%" />
        </aside>
      </div>
    </KioskLayout>
  );
}
