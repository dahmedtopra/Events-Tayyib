import { useLang } from "../hooks/useLang";
import { LanguageLock } from "./LanguageLock";

export function Header() {
  const { t } = useLang();
  return (
    <header className="glass px-6 py-4 border-b border-gold-200 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-emerald-900 text-white flex items-center justify-center text-xs shadow-soft">
          ICHS
        </div>
        <div className="text-lg font-semibold tracking-wide">{t.headerTitle}</div>
      </div>
      <div className="flex items-center gap-4">
        <LanguageLock segmented />
      </div>
    </header>
  );
}
