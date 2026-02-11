import { useLang } from "../hooks/useLang";

export function Footer() {
  const { t } = useLang();
  return (
    <footer className="glass px-6 py-3 border-t border-gold-200 text-xs text-gray-600">
      {t.footerDisclaimer}
    </footer>
  );
}
