import { useLang } from "../hooks/useLang";

export function LanguageLock({ segmented = false }: { segmented?: boolean }) {
  const { lang, setLang, t } = useLang();
  const buttonClass = (code: string, pos: "left" | "mid" | "right") => {
    const base = "px-5 py-3 text-sm min-h-[48px]";
    const active = lang === code ? "bg-emerald-900 text-white" : "bg-white text-emerald-900";
    const radius = segmented
      ? pos === "left" ? "rounded-l-2xl" : pos === "right" ? "rounded-r-2xl" : ""
      : "rounded-2xl";
    return `${base} ${active} ${radius} border border-emerald-800`;
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 rtl-text">{t.languageLabel}</span>
      <div className="inline-flex overflow-hidden rounded-2xl shadow-soft">
        <button className={buttonClass("EN", "left")} onClick={() => setLang("EN")}>EN</button>
        <button className={buttonClass("AR", "mid")} onClick={() => setLang("AR")}>AR</button>
        <button className={buttonClass("FR", "right")} onClick={() => setLang("FR")}>FR</button>
      </div>
    </div>
  );
}
